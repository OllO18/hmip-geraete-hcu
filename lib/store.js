"use strict";
/* Geräteliste als JSON-Datei im persistenten Plugin-Ordner (/data). Enthält die Geräteschlüssel. */
const fs = require("fs");
const path = require("path");

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const TEXT_FIELDS = ["raw", "sgtin", "key", "fmt", "name", "type", "room", "loc", "note", "fw", "created", "updated",
  "src_name", "src_room", "src_type", "ack_name", "ack_room", "missing"];
const norm = (v) => String(v ?? "").replace(/[\s-]+/g, "").toUpperCase();

class DeviceStore {
  constructor(dir) {
    this.file = path.join(dir, "devices.json");
    this.devices = {};
    fs.mkdirSync(dir, { recursive: true });
    try { this.devices = JSON.parse(fs.readFileSync(this.file, "utf8")).devices || {}; } catch (e) { if (e.code !== "ENOENT") console.error("devices.json nicht lesbar:", e.message); }
  }
  _persist() {
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ devices: this.devices }, null, 1), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }
  list() { return Object.values(this.devices); }
  save(device) {
    const id = String(device && device.id || "");
    if (!ID_RE.test(id)) { const e = new Error("Ungültige Geräte-ID"); e.code = "invalid_format"; throw e; }
    const r = { id };
    for (const k of TEXT_FIELDS) r[k] = String(device[k] ?? "").slice(0, 2000);
    r.sgtin = norm(r.sgtin);
    r.key = /^[0-9A-F]{32}$/.test(norm(r.key)) ? norm(r.key) : "";
    const f = r.fmt.trim().toUpperCase(); r.fmt = /^[A-Z0-9]{2,8}$/.test(f) ? f : "";
    this.devices[id] = r; this._persist();
  }
  delete(id) { if (this.devices[id]) { delete this.devices[id]; this._persist(); } }
  /* Geräte aus der HCU übernehmen; eigene Eingaben bleiben erhalten. Stand der HCU in src_*, fehlende Geräte missing="1". */
  importHcu(items) {
    const bySgtin = new Map(Object.values(this.devices).filter((d) => d.sgtin).map((d) => [norm(d.sgtin), d]));
    const now = new Date().toISOString(); let added = 0, updated = 0, removed = 0;
    const present = new Set();
    for (const it of items) {
      present.add(it.sgtin);
      const src = { src_name: it.name, src_room: it.room, src_type: it.type, missing: "" };
      const ex = bySgtin.get(it.sgtin);
      if (!ex) {
        const id = "hcu" + it.sgtin;
        this.devices[id] = { id, raw: "", key: "", fmt: "", loc: "", note: "", created: now, updated: now, ack_name: "", ack_room: "",
          sgtin: it.sgtin, name: it.name, type: it.type, fw: it.fw, room: it.room, ...src };
        added++; continue;
      }
      let ch = false;
      for (const k of ["name", "type", "room"]) if (!ex[k] && it[k]) { ex[k] = it[k]; ch = true; }
      if (it.fw && ex.fw !== it.fw) { ex.fw = it.fw; ch = true; }
      Object.assign(ex, src);
      if (ch) { ex.updated = now; updated++; }
    }
    for (const d of Object.values(this.devices)) {
      const known = d.src_name || d.src_type || String(d.id).startsWith("hcu");
      if (d.sgtin && !present.has(norm(d.sgtin)) && known && d.missing !== "1") { d.missing = "1"; removed++; }
    }
    this._persist();
    return { added, updated, removed, changes: Object.values(this.devices).filter(pending).length };
  }
}
/* Name oder Raum weicht in der HCU ab und wurde noch nicht bestätigt */
function pending(d) {
  return ["name", "room"].some((k) => { const s = d["src_" + k] || ""; return s && s !== (d[k] || "") && s !== (d["ack_" + k] || ""); });
}
module.exports = { DeviceStore, norm, pending };
