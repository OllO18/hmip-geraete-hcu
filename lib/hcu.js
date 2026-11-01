"use strict";
/* Auswertung der Antwort auf /hmip/home/getSystemState (Connect API): Geräte (id = SGTIN) und Räume (Gruppen vom Typ META). */
const SERIAL_RE = /^[0-9A-F]{24}$/;

function parseSystemState(body) {
  const devices = (body && body.devices) || {}, groups = (body && body.groups) || {};
  const out = []; let skipped = 0;
  for (const dev of Object.values(devices)) {
    const sgtin = String(dev.id || "").toUpperCase();
    if (!SERIAL_RE.test(sgtin)) { skipped++; continue; }
    let room = "";
    for (const ch of Object.values(dev.functionalChannels || {})) {
      for (const gid of ch.groups || []) {
        const g = groups[gid];
        if (g && g.type === "META" && g.label) { room = g.label; break; }
      }
      if (room) break;
    }
    out.push({ sgtin, name: dev.label || "", type: dev.modelType || "", fw: dev.firmwareVersion || "", room });
  }
  return { devices: out, skipped };
}
module.exports = { parseSystemState };
