"use strict";
/* Passwortschutz: Beim ersten Aufruf wird ein Passwort festgelegt (scrypt-Hash in /data/auth.json). Sitzungen liegen nur im Speicher. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class Auth {
  constructor(dir) {
    this.file = path.join(dir, "auth.json"); this.sessions = new Map(); this.fails = new Map(); this.cred = null;
    try { this.cred = JSON.parse(fs.readFileSync(this.file, "utf8")); } catch (e) { /* noch kein Passwort */ }
  }
  get isSet() { return !!this.cred; }
  _hash(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString("hex"); }
  setPassword(pw) {
    if (this.cred) throw Object.assign(new Error("Passwort ist bereits gesetzt"), { code: "forbidden" });
    if (typeof pw !== "string" || pw.length < 8) throw Object.assign(new Error("Das Passwort braucht mindestens 8 Zeichen"), { code: "invalid_format" });
    const salt = crypto.randomBytes(16).toString("hex");
    this.cred = { salt, hash: this._hash(pw, salt) };
    fs.writeFileSync(this.file, JSON.stringify(this.cred), { mode: 0o600 });
  }
  login(pw, ip) {
    const f = this.fails.get(ip) || { n: 0, until: 0 };
    if (Date.now() < f.until) throw Object.assign(new Error("Zu viele Versuche, bitte kurz warten"), { code: "rate_limited" });
    const ok = this.cred && typeof pw === "string" &&
      crypto.timingSafeEqual(Buffer.from(this._hash(pw, this.cred.salt), "hex"), Buffer.from(this.cred.hash, "hex"));
    if (!ok) { f.n++; f.until = f.n >= 5 ? Date.now() + 30000 * Math.min(f.n - 4, 10) : 0; this.fails.set(ip, f); throw Object.assign(new Error("Passwort falsch"), { code: "unauthorized" }); }
    this.fails.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    this.sessions.set(token, Date.now() + 12 * 3600 * 1000);
    return token;
  }
  /* Passwort ändern: altes Passwort prüfen, alle Sitzungen beenden, neue Sitzung zurückgeben */
  changePassword(oldPw, newPw, ip) {
    this.login(oldPw, ip);
    if (typeof newPw !== "string" || newPw.length < 8) throw Object.assign(new Error("Das neue Passwort braucht mindestens 8 Zeichen"), { code: "invalid_format" });
    const salt = crypto.randomBytes(16).toString("hex");
    this.cred = { salt, hash: this._hash(newPw, salt) };
    fs.writeFileSync(this.file, JSON.stringify(this.cred), { mode: 0o600 });
    this.sessions.clear();
    return this.login(newPw, ip);
  }
  /* Zurücksetzen (nur über HCUweb): Passwort löschen, alle Sitzungen beenden; beim nächsten Aufruf neu festlegen */
  reset() {
    try { fs.unlinkSync(this.file); } catch (e) { if (e.code !== "ENOENT") throw e; }
    this.cred = null; this.sessions.clear(); this.fails.clear();
  }
  logout(token) { this.sessions.delete(token); }
  check(token) {
    const exp = this.sessions.get(token);
    if (!exp) return false;
    if (exp < Date.now()) { this.sessions.delete(token); return false; }
    return true;
  }
}
module.exports = { Auth };
