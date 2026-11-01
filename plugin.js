"use strict";
/* HmIP Geräteverwaltung – Plugin für die Homematic IP Home Control Unit (Connect API).
   Aufruf: node plugin.js <pluginId> <host> <tokenDatei>   (im Container: host.containers.internal und /TOKEN) */
const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DeviceStore } = require("./lib/store");
const { Auth } = require("./lib/auth");
const { createServer } = require("./lib/server");
const { parseSystemState } = require("./lib/hcu");

const [pluginId = "de.ollo18.hmip.geraeteverwaltung", host = "host.containers.internal", tokenFile = "/TOKEN"] = process.argv.slice(2);
const DATA_DIR = process.env.DATA_DIR || "/data";
const PORT = Number(process.env.WEB_PORT || 8443);
const WSS_URL = process.env.HCU_WSS || `wss://${host}:9001`;
const log = (...a) => console.log(new Date().toISOString(), ...a);

let ws = null, ready = false, webUrl = "";
const pending = new Map();

function connect() {
  let token;
  try { token = fs.readFileSync(tokenFile, "utf8").trim(); } catch (e) { log("Token nicht lesbar:", e.message); return setTimeout(connect, 10000); }
  ws = new WebSocket(WSS_URL, { rejectUnauthorized: false, headers: { authtoken: token, "plugin-id": pluginId } });
  ws.on("open", () => { ready = true; log("Mit der HCU verbunden"); sendState(crypto.randomUUID()); });
  ws.on("message", (data) => {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (m.type === "PLUGIN_STATE_REQUEST") return sendState(m.id);
    if (m.type === "CONFIG_TEMPLATE_REQUEST") return send(m.id, "CONFIG_TEMPLATE_RESPONSE", configTemplate((m.body && m.body.languageCode) || "de"));
    if (m.type === "CONFIG_UPDATE_REQUEST") return send(m.id, "CONFIG_UPDATE_RESPONSE", { status: "APPLIED" });
    if (m.type === "HMIP_SYSTEM_RESPONSE" && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.t); p.res(m.body); }
  });
  ws.on("error", (e) => log("WebSocket-Fehler:", e.code || "", e.message || e));
  ws.on("close", () => { ready = false; for (const [id, p] of pending) { clearTimeout(p.t); p.rej(Object.assign(new Error("Verbindung zur HCU getrennt"), { code: "hcu_unavailable" })); pending.delete(id); } setTimeout(connect, 5000); });
}
function send(id, type, body) { if (ws && ready) ws.send(JSON.stringify({ id, pluginId, type, body })); }
/* Konfigurationsseite in HCUweb: Link und QR-Code zur Weboberfläche (keine einstellbaren Werte) */
function configTemplate(lang) {
  const de = lang !== "en";
  return {
    groups: { web: { friendlyName: de ? "Weboberfläche" : "Web interface", order: 1 } },
    properties: {
      webLink: { dataType: "WEBLINK", friendlyName: de ? "Weboberfläche öffnen" : "Open web interface", currentValue: webUrl,
        defaultValue: de ? "Beim ersten Aufruf die Zertifikatswarnung bestätigen." : "Accept the certificate warning on first visit.", groupId: "web", order: 1 },
      webQr: { dataType: "QRCODE", friendlyName: de ? "Mit dem Smartphone öffnen" : "Open on smartphone", currentValue: webUrl, groupId: "web", order: 2 },
      hint: { dataType: "READONLY", friendlyName: de ? "Hinweis" : "Note", groupId: "web", order: 3,
        currentValue: de ? `Wird ${webUrl.replace(/^https:\/\/|:\d+$/g, "")} nicht gefunden, statt des Namens die IP-Adresse der HCU verwenden (Port ${PORT}).`
          : `If ${webUrl.replace(/^https:\/\/|:\d+$/g, "")} cannot be resolved, use the IP address of the HCU instead (port ${PORT}).` },
    },
  };
}
function sendState(id) {
  ws.send(JSON.stringify({ id, pluginId, type: "PLUGIN_STATE_RESPONSE", body: { pluginReadinessStatus: "READY" } }));
}
function systemRequest(p, body = {}) {
  return new Promise((res, rej) => {
    if (!ready) return rej(Object.assign(new Error("Keine Verbindung zur HCU"), { code: "hcu_unavailable" }));
    const id = crypto.randomUUID();
    const t = setTimeout(() => { pending.delete(id); rej(Object.assign(new Error("Die HCU hat nicht geantwortet"), { code: "hcu_unavailable" })); }, 20000);
    pending.set(id, { res, rej, t });
    ws.send(JSON.stringify({ id, pluginId, type: "HMIP_SYSTEM_REQUEST", body: { path: p, body } }));
  });
}
async function getHcuState() {
  const r = await systemRequest("/hmip/home/getSystemState");
  if (!r || r.code !== 200) throw Object.assign(new Error("Die HCU lieferte keinen Systemzustand (Code " + (r && r.code) + ")"), { code: "hcu_unavailable" });
  return parseSystemState(r.body);
}

(async () => {
  const store = new DeviceStore(DATA_DIR), auth = new Auth(DATA_DIR);
  let last4 = ""; try { last4 = fs.readFileSync("/SGTIN", "utf8").trim().slice(-4); } catch (e) { /* außerhalb der HCU */ }
  const hosts = ["localhost"]; if (last4) hosts.unshift(`hcu1-${last4}.local`);
  const start = createServer({ store, auth, www: path.join(__dirname, "www"), getHcuState, dir: DATA_DIR, hosts });
  await start(PORT);
  webUrl = `https://${hosts[0]}:${PORT}`;
  log(`Weboberfläche: ${webUrl}`);
  connect();
})().catch((e) => { console.error(e); process.exit(1); });
