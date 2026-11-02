"use strict";
/* HTTPS-Server (selbstsigniertes Zertifikat, damit der Browser die Kamera erlaubt) mit kleiner JSON-API und den statischen Panel-Dateien. */
const https = require("https");
const fs = require("fs");
const path = require("path");
const selfsigned = require("selfsigned");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

async function loadCert(dir, hosts) {
  const kf = path.join(dir, "cert.key"), cf = path.join(dir, "cert.pem");
  try {
    const cert = fs.readFileSync(cf, "utf8");
    if (new Date(new (require("crypto").X509Certificate)(cert).validTo) > new Date(Date.now() + 30 * 864e5)) return { key: fs.readFileSync(kf, "utf8"), cert };
  } catch (e) { /* neu erzeugen */ }
  const alt = hosts.map((h) => (/^[\d.]+$/.test(h) ? { type: 7, ip: h } : { type: 2, value: h }));
  const p = await selfsigned.generate([{ name: "commonName", value: hosts[0] }], {
    keySize: 2048, algorithm: "sha256", extensions: [{ name: "subjectAltName", altNames: alt }],
    notBeforeDate: new Date(Date.now() - 864e5), notAfterDate: new Date(Date.now() + 825 * 864e5),
  });
  fs.writeFileSync(kf, p.private, { mode: 0o600 }); fs.writeFileSync(cf, p.cert);
  return { key: p.private, cert: p.cert };
}

function createServer({ store, auth, www, getHcuState, dir, hosts, version }) {
  const readBody = (req) => new Promise((res, rej) => {
    let n = 0; const ch = [];
    req.on("data", (c) => { n += c.length; if (n > 2e6) { rej(Object.assign(new Error("Anfrage zu groß"), { code: "too_large" })); req.destroy(); } else ch.push(c); });
    req.on("end", () => { try { res(ch.length ? JSON.parse(Buffer.concat(ch).toString("utf8")) : {}); } catch (e) { rej(Object.assign(new Error("Ungültiges JSON"), { code: "invalid_format" })); } });
    req.on("error", rej);
  });
  const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(b); };
  const status = { invalid_format: 400, unauthorized: 401, forbidden: 403, rate_limited: 429, too_large: 413, hcu_unavailable: 503 };

  async function api(req, res, url) {
    const ip = req.socket.remoteAddress || "?";
    try {
      if (url === "/api/status" && req.method === "GET") return send(res, 200, { passwordSet: auth.isSet, version });
      if (url === "/api/setup" && req.method === "POST") { const b = await readBody(req); auth.setPassword(b.password); return send(res, 200, { token: auth.login(b.password, ip) }); }
      if (url === "/api/login" && req.method === "POST") { const b = await readBody(req); return send(res, 200, { token: auth.login(b.password, ip) }); }
      if (!auth.check(req.headers["x-token"])) return send(res, 401, { code: "unauthorized", message: "Bitte anmelden" });
      if (url === "/api/list" && req.method === "GET") return send(res, 200, store.list());
      if (url === "/api/password" && req.method === "POST") { const b = await readBody(req); return send(res, 200, { token: auth.changePassword(b.old, b.password, ip) }); }
      if (url === "/api/logout" && req.method === "POST") { auth.logout(req.headers["x-token"]); return send(res, 200, { ok: true }); }
      if (req.method !== "POST") return send(res, 405, { code: "method", message: "Nicht erlaubt" });
      const b = await readBody(req);
      if (url === "/api/save") { store.save(b.device); return send(res, 200, { ok: true }); }
      if (url === "/api/delete") { store.delete(String(b.device_id || "")); return send(res, 200, { ok: true }); }
      if (url === "/api/import") {
        const st = await getHcuState();
        return send(res, 200, { ...store.importHcu(st.devices), total: st.devices.length, skipped: st.skipped });
      }
      return send(res, 404, { code: "not_found", message: "Unbekannt" });
    } catch (e) { return send(res, status[e.code] || 500, { code: e.code || "error", message: e.message || String(e) }); }
  }

  const root = path.resolve(www);
  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url === "/" ? "/index.html" : url);
    const file = path.resolve(root, "." + rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end("Nicht gefunden"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    fs.createReadStream(file).pipe(res);
  }

  return async function start(port) {
    const tls = await loadCert(dir, hosts);
    const srv = https.createServer(tls, (req, res) => {
      const url = req.url.split("?")[0];
      if (url.startsWith("/api/")) return void api(req, res, url);
      if (req.method !== "GET") { res.writeHead(405); return res.end(); }
      serveStatic(req, res, url);
    });
    await new Promise((r) => srv.listen(port, "0.0.0.0", r));
    return srv;
  };
}
module.exports = { createServer };
