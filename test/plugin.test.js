"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { parseSystemState } = require("../lib/hcu");
const { DeviceStore } = require("../lib/store");
const { Auth } = require("../lib/auth");

const STATE = {
  devices: {
    "3014F711A0000000000000A1": { id: "3014F711A0000000000000A1", label: "Fenster", modelType: "HmIP-SWDO-I", firmwareVersion: "1.18.10", functionalChannels: { 0: { groups: ["m1"] }, 1: { groups: ["s1"] } } },
    "3014F711A0000000000000A2": { id: "3014F711A0000000000000A2", label: "Ohne Raum", modelType: "HmIP-BSM", functionalChannels: { 0: { groups: [] } } },
    "plugin-x": { id: "plugin-x", label: "Fremd" },
  },
  groups: { m1: { id: "m1", type: "META", label: "Küche" }, s1: { id: "s1", type: "SECURITY", label: "Room" } },
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "hmip-"));

test("Systemzustand: SGTIN, Raum aus META-Gruppe, Fremdgeräte übersprungen", () => {
  const r = parseSystemState(STATE);
  assert.strictEqual(r.skipped, 1);
  assert.deepStrictEqual(r.devices[0], { sgtin: "3014F711A0000000000000A1", name: "Fenster", type: "HmIP-SWDO-I", fw: "1.18.10", room: "Küche" });
  assert.strictEqual(r.devices[1].room, "");
});

test("Speicher: Übernahme, eigene Eingaben bleiben, Bereinigung", () => {
  const dir = tmp(), s = new DeviceStore(dir);
  assert.deepStrictEqual(s.importHcu(parseSystemState(STATE).devices), { added: 2, updated: 0, removed: 0, changes: 0 });
  const d = s.list().find((x) => x.sgtin.endsWith("A1"));
  s.save({ ...d, room: "Eigener Raum", key: "0011-2233 4455 6677 8899 aabb ccdd eeff", fmt: "eq01", name: "<b>" });
  s.importHcu(parseSystemState(STATE).devices);
  const again = new DeviceStore(dir).list().find((x) => x.id === d.id);
  assert.strictEqual(again.room, "Eigener Raum");
  assert.strictEqual(again.key, "00112233445566778899AABBCCDDEEFF");
  assert.strictEqual(again.fmt, "EQ01");
  assert.throws(() => s.save({ id: "../x" }), /Ungültige Geräte-ID/);
  s.delete(d.id); assert.strictEqual(s.list().length, 1);
});

test("Passwort: festlegen, anmelden, Sperre nach Fehlversuchen", () => {
  const dir = tmp(), a = new Auth(dir);
  assert.throws(() => a.setPassword("kurz"), /mindestens 8/);
  a.setPassword("geheim123");
  assert.throws(() => a.setPassword("nochmal123"), /bereits gesetzt/);
  const t = new Auth(dir).login("geheim123", "1.2.3.4");
  assert.ok(a.check(t) === false, "Sitzungen gelten nur im eigenen Prozess");
  const b = new Auth(dir);
  for (let i = 0; i < 5; i++) assert.throws(() => b.login("falsch", "9.9.9.9"), /Passwort falsch/);
  assert.throws(() => b.login("geheim123", "9.9.9.9"), /Zu viele Versuche/);
  assert.ok(b.check(b.login("geheim123", "1.1.1.1")));
});

test("Abgleich: Änderungen und entfernte Geräte werden markiert", () => {
  const { pending } = require("../lib/store");
  const dir = tmp(), s = new DeviceStore(dir);
  const items = parseSystemState(STATE).devices;
  s.importHcu(items);
  const a1 = s.list().find((x) => x.sgtin.endsWith("A1"));
  s.save({ ...a1, name: "Eigener Name" });
  let r = s.importHcu(items);
  assert.strictEqual(r.changes, 1);
  s.save({ ...s.list().find((x) => x.id === a1.id), ack_name: "Fenster" });
  r = s.importHcu(items);
  assert.strictEqual(r.changes, 0);
  r = s.importHcu(items.filter((x) => !x.sgtin.endsWith("A2")));
  assert.strictEqual(r.removed, 1);
  assert.strictEqual(s.list().find((x) => x.sgtin.endsWith("A2")).missing, "1");
  assert.strictEqual(s.importHcu(items.filter((x) => !x.sgtin.endsWith("A2"))).removed, 0);
  assert.strictEqual(pending(s.list().find((x) => x.id === a1.id)), false);
});
