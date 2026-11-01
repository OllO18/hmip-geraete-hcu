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

let ws = null, ready = false;
const pending = new Map();

function connect() {
  let token;
  try { token = fs.readFileSync(tokenFile, "utf8").trim(); } catch (e) { log("Token nicht lesbar:", e.message); return setTimeout(connect, 10000); }
  ws = new WebSocket(WSS_URL, { rejectUnauthorized: false, headers: { authtoken: token, "plugin-id": pluginId } });
  ws.on("open", () => { ready = true; log("Mit der HCU verbunden"); sendState(crypto.randomUUID()); });
  ws.on("message", (data) => {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (m.type === "PLUGIN_STATE_REQUEST") return sendState(m.id);
    if (m.type === "HMIP_SYSTEM_RESPONSE" && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.t); p.res(m.body); }
  });
  ws.on("error", (e) => log("WebSocket-Fehler:", e.code || "", e.message || e));
  ws.on("close", () => { ready = false; for (const [id, p] of pending) { clearTimeout(p.t); p.rej(Object.assign(new Error("Verbindung zur HCU getrennt"), { code: "hcu_unavailable" })); pending.delete(id); } setTimeout(connect, 5000); });
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
  log(`Weboberfläche: https://${hosts[0]}:${PORT}`);
  connect();
})().catch((e) => { console.error(e); process.exit(1); });
