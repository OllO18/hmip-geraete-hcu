/* HmIP Geräteverwaltung – Home-Assistant-Panel (Web Component).
   QR-Codes erzeugt die MIT-lizenzierte Bibliothek qrcode-generator (Kazuhiko Arase), siehe qrcode.mjs. */
import qrcode from "./qrcode.mjs";
import jsQR from "./jsqr.mjs";

/* ---------- Code-Format der HmIP-QR-Code-Aufkleber ----------
   Beobachtet: EQ01 + "SG" + SGTIN (24 Hex) + "DLK" + Geräteschlüssel (32 Hex). Alles andere gilt als unbekanntes Format. */
const CODE_RE = /^(EQ\d{2})SG([0-9A-F]{24})DLK([0-9A-F]{32})$/;
export const norm = (s) => String(s || "").replace(/[\s-]/g, "").toUpperCase();
export function parseCode(raw) {
  const n = norm(raw);
  const m = n.match(CODE_RE);
  if (m) return { fmt: m[1], sgtin: m[2], key: m[3], raw: "" };
  const g = n.match(/[0-9A-F]{24}/); // Notlösung für abweichende Formate: erste 24-stellige Hex-Folge
  return { fmt: "", sgtin: g ? g[0] : "", key: "", raw: String(raw || "").trim() };
}
const validSgtin = (s) => /^[0-9A-F]{24}$/.test(norm(s));

/* Der Geräteschlüssel (128 Bit) steht im QR-Code als 32 Hex-Zeichen und auf dem Aufkleber als Base32 mit
   eigenem Alphabet (ohne D, I, O, V) in Gruppen 5-5-5-5-6. Geprüft an zwei Original-Aufklebern. */
const KEY_CHARS = "0123456789ABCEFGHJKLMNPQRSTUWXYZ";
export function keyToPrinted(hex) {
  let n = BigInt("0x" + norm(hex)), out = "";
  for (let i = 25; i >= 0; i--) out += KEY_CHARS[Number((n >> BigInt(5 * i)) & 31n)];
  return [out.slice(0, 5), out.slice(5, 10), out.slice(10, 15), out.slice(15, 20), out.slice(20)].join("-");
}
/* Nimmt 32 Hex-Zeichen oder die gedruckte Schreibweise (26 Zeichen) und liefert 32 Hex-Zeichen, sonst "" */
export function keyFromInput(input) {
  const n = norm(input);
  if (/^[0-9A-F]{32}$/.test(n)) return n;
  if (n.length === 26 && [...n].every((c) => KEY_CHARS.includes(c))) {
    let v = 0n;
    for (const c of n) v = v * 32n + BigInt(KEY_CHARS.indexOf(c));
    if (v >> 128n === 0n) return v.toString(16).toUpperCase().padStart(32, "0");
  }
  return "";
}
const validKey = (s) => keyFromInput(s) !== "";
/* Inhalt des QR-Codes, den die Homematic-IP-App beim Scannen erwartet */
export function codeContent(d) {
  if (validSgtin(d.sgtin) && validKey(d.key)) return `${d.fmt || "EQ01"}SG${norm(d.sgtin)}DLK${keyFromInput(d.key)}`;
  return d.raw || "";
}
export const hasCode = (d) => !!(validKey(d.key) || d.raw);
/* Inhalt für einen erzeugten Aufkleber: vollständig (mit Key) oder, wenn kein Key erfasst ist, nur die SGTIN.
   Ohne Key reicht der Aufkleber nur für das normale Anlernen mit Internet (Schlüssel kommt vom eQ-3-Server).
   Format ohne Key: EQ01SG<SGTIN> (wie das Original, ohne den DLK-Teil). Nur die SGTIN allein lehnt die App ab. */
export function stickerContent(d) {
  const full = codeContent(d);
  if (full) return { text: full, full: true };
  if (validSgtin(d.sgtin)) return { text: `EQ01SG${norm(d.sgtin)}`, full: false }; // von der HmIP-App erkannt (getestet 01.11.2026)
  return null;
}

/* ---------- Gerätebezeichnungen ----------
   Deutsche Produktbezeichnungen zu den Typ-Kürzeln. Quellen: Download-Bereich und Datenblätter von eQ-3/Homematic IP;
   wo dort nichts zu finden war, die Standard-Gerätenamen, die die HCU beim Anlernen vergibt. Nicht verifizierte Kürzel
   fehlen absichtlich und werden als Kürzel angezeigt. Varianten mit Zusatz nach Leerzeichen (z. B. "HmIP-PS-2 9YM") zählen zum Grundtyp. */
const TYPE_NAMES = {
  "HmIP-HCU1": "Home Control Unit",
  "HmIP-SWDO-I": "Fenster- und Türkontakt – verdeckter Einbau",
  "HmIP-SWDO-2": "Fenster- und Türkontakt – optisch",
  "HmIP-SWDO-A": "Fenster- und Türkontakt – optisch",
  "HmIP-SWDO-PL-2": "Fenster- und Türkontakt – optisch, plus",
  "HmIP-SWDM": "Fenster- und Türkontakt mit Magnet",
  "HmIP-SWDM-2": "Fenster- und Türkontakt mit Magnet",
  "HmIP-WTH-1": "Wandthermostat mit Luftfeuchtigkeitssensor",
  "HmIP-BWTH": "Wandthermostat mit Schaltausgang – für Markenschalter, 230 V",
  "HmIP-BSL": "Schaltaktor für Markenschalter – mit Signalleuchte",
  "HmIP-BSM": "Schalt-Mess-Aktor für Markenschalter",
  "HmIP-FSM": "Schalt-Mess-Aktor – Unterputz",
  "HmIP-BBL-2": "Jalousieaktor für Markenschalter",
  "HmIP-SWSD-2": "Rauchwarnmelder mit Q-Label",
  "HmIP-eTRV-2": "Heizkörperthermostat",
  "HmIP-eTRV-3": "Heizkörperthermostat – pure",
  "HmIP-eTRV-B": "Heizkörperthermostat – basic",
  "HmIP-eTRV-E": "Heizkörperthermostat – Evo",
  "HmIP-FALMOT-C12": "Fußbodenheizungscontroller – 12 Kanäle, motorisch",
  "HmIP-WHS2": "Schaltaktor für Heizungsanlagen – 2-fach",
  "HmIP-SMI": "Bewegungsmelder mit Dämmerungssensor – innen",
  "HmIP-SMO-2": "Bewegungsmelder mit Dämmerungssensor – außen",
  "HmIP-SMO230": "Bewegungsmelder mit Schaltaktor – außen",
  "HmIP-SMO230-A": "Bewegungsmelder mit Schaltaktor – außen",
  "HmIP-WRC6": "Wandtaster – 6-fach",
  "HmIP-WRC6-230": "Wandtaster – 6-fach, 230 V",
  "HmIP-WGC": "Garagentortaster",
  "HmIP-WKP": "Keypad",
  "HmIP-DLP-A": "Türschlossantrieb – pro",
  "HmIP-PS-2": "Schaltsteckdose",
  "HmIP-PSMCO": "Schalt-Mess-Kabel – außen",
  "HmIP-STHD": "Temperatur- und Luftfeuchtigkeitssensor mit Display – innen",
  "HmIP-ASIR-O": "Alarmsirene – außen",
  "HmIP-SWD": "Wassersensor",
  "HmIP-FCI1": "Kontakt-Schnittstelle Unterputz – 1-fach",
  "HmIP-FCI6": "Kontakt-Schnittstelle Unterputz – 6-fach",
  "HmIP-ESI": "Schnittstelle für Energiesensoren",
  "ELV-SH-SB8": "ELV Smart Home Status-Board",
  "ELV-SH-CTV": "ELV Smart Home Neigungs- und Erschütterungssensor Kompakt",
};
/* Kategorien wie auf homematic-ip.com (Produktfilter, ausgelesen am 02.11.2026). Ein Gerät kann in mehreren Kategorien stehen. */
export const CATEGORIES = ["Access Points & Zentralen", "Heizen & Raumklima", "Licht", "Beschattung", "Sicherheit & Alarm", "Wetter & Umwelt", "Zutritt", "Energiemanagement"];
const [AP, HZ, LI, BE, SI, WE, ZU, EN] = CATEGORIES;
const CATS_BY_NAME = {
  "Home Control Unit": [AP],
  "Fenster- und Türkontakt – verdeckter Einbau": [HZ, SI],
  "Fenster- und Türkontakt – optisch": [HZ, SI],
  "Fenster- und Türkontakt – optisch, plus": [HZ, SI],
  "Fenster- und Türkontakt mit Magnet": [HZ, SI],
  "Wandthermostat mit Luftfeuchtigkeitssensor": [HZ],
  "Wandthermostat mit Schaltausgang – für Markenschalter, 230 V": [HZ],
  "Schaltaktor für Markenschalter – mit Signalleuchte": [HZ, LI, BE, SI],
  "Schalt-Mess-Aktor für Markenschalter": [LI],
  "Schalt-Mess-Aktor – Unterputz": [HZ, LI, EN],
  "Jalousieaktor für Markenschalter": [HZ, BE, SI],
  "Rauchwarnmelder mit Q-Label": [SI],
  "Heizkörperthermostat": [HZ],
  "Heizkörperthermostat – pure": [HZ],
  "Heizkörperthermostat – basic": [HZ],
  "Heizkörperthermostat – Evo": [HZ],
  "Fußbodenheizungscontroller – 12 Kanäle, motorisch": [HZ],
  "Schaltaktor für Heizungsanlagen – 2-fach": [HZ],
  "Bewegungsmelder mit Dämmerungssensor – innen": [LI, SI],
  "Bewegungsmelder mit Dämmerungssensor – außen": [LI, SI],
  "Bewegungsmelder mit Schaltaktor – außen": [LI, SI],
  "Wandtaster – 6-fach": [LI, BE, SI],
  "Wandtaster – 6-fach, 230 V": [LI, BE, SI],
  "Garagentortaster": [ZU],
  "Keypad": [LI, SI, ZU],
  "Türschlossantrieb – pro": [ZU],
  "Schaltsteckdose": [HZ, LI, SI],
  "Schalt-Mess-Kabel – außen": [LI, SI, EN],
  "Temperatur- und Luftfeuchtigkeitssensor mit Display – innen": [HZ],
  "Alarmsirene – außen": [SI],
  "Wassersensor": [SI],
  "Kontakt-Schnittstelle Unterputz – 1-fach": [HZ, LI, BE, SI, ZU],
  "Kontakt-Schnittstelle Unterputz – 6-fach": [HZ, LI, BE, SI, ZU],
  "Schnittstelle für Energiesensoren": [EN], // auf der Homepage als Sets für Gas-, Strom- und Smart-Meter-Zähler, alle unter Energiemanagement
};
export const typeCategories = (code) => CATS_BY_NAME[typeName(code)] || [];
const NOCAT = "\u0000ohne";
const TYPE_NAMES_UC = Object.fromEntries(Object.entries(TYPE_NAMES).map(([k, v]) => [k.toUpperCase(), v]));
export function typeName(code) {
  const c = String(code || "").trim().toUpperCase();
  return TYPE_NAMES_UC[c] || TYPE_NAMES_UC[c.split(/\s+/)[0]] || "";
}
/* Anzeige: "Bezeichnung (Kürzel)" bzw. nur das Kürzel */
export const typeLabel = (code) => (typeName(code) ? `${typeName(code)} (${code})` : String(code || ""));
const typeKey = (code) => typeName(code) || String(code || "");

/* ---------- QR-Code-Aufkleber (SVG) ---------- */
export function qrMatrix(text) {
  const mode = /^[0-9A-Z $%*+\-./:]+$/.test(text) ? "Alphanumeric" : "Byte";
  const qr = qrcode(0, "M");
  qr.addData(text, mode);
  qr.make();
  return { n: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}
const xml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function wrap(text, max, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines = [];
  let line = "";
  for (let w of words) {
    while (w.length > max) { if (line) { lines.push(line); line = ""; } lines.push(w.slice(0, max)); w = w.slice(max); }
    if ((line ? line + " " : "").length + w.length <= max) line = (line ? line + " " : "") + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*$/, "") + "…"; }
  return lines;
}
const cut = (s, n) => (String(s || "").length > n ? String(s).slice(0, n - 1) + "…" : String(s || ""));
const groups = (s) => norm(s).match(/.{1,4}/g) || [];

/* Nachempfunden dem Original-Aufkleber (Hochformat, Breite 50 mm; 1 Einheit = 0,1 mm). Name und Einbauort stehen nicht darauf, sie gehören
   auf den Dokumentationsbogen. Der Schlüssel steht als Text in der gedruckten Schreibweise und steckt zusätzlich im QR-Code. */
function stickerParts(d) {
  const sc = stickerContent(d);
  if (!sc) return null;
  const text = sc.text;
  const q = qrMatrix(text);
  const area = 370, quiet = 4, m = area / (q.n + 2 * quiet), ox = 65, oy = 108;
  let path = "";
  for (let r = 0; r < q.n; r++) for (let c = 0; c < q.n; c++) {
    if (q.dark(r, c)) path += `M${(ox + (c + quiet) * m).toFixed(2)} ${(oy + (r + quiet) * m).toFixed(2)}h${m.toFixed(2)}v${m.toFixed(2)}h${(-m).toFixed(2)}z`;
  }
  const mono = 'font-family="Courier New,monospace" font-size="28"';
  let y = 520, body = "";
  for (const l of wrap(d.type, 20, 2)) { y += 36; body += `<text x="26" y="${y}" font-size="32" font-weight="bold" fill="#000">${xml(l)}</text>`; }
  y += 14;
  if (!sc.full) {
    body += `<text x="26" y="${y + 34}" font-size="23" font-weight="bold" fill="#000">Ohne Key – nur Online-Anlernen</text>
  <text x="26" y="${y + 64}" font-size="20" fill="#444">Offline an der HCU wird der Original-Key gebraucht.</text>`;
    y += 82;
  } else if (validKey(d.key)) {
    const g = keyToPrinted(keyFromInput(d.key)).split("-");
    body += `<text x="26" y="${y + 38}" ${mono}>Key:${xml(g.slice(0, 3).join("-"))}-</text>
  <text x="26" y="${y + 74}" ${mono}>${xml(g.slice(3).join("-"))}</text>`;
    y += 92;
  }
  y += 8;
  body += `<line x1="26" y1="${y}" x2="474" y2="${y}" stroke="#000" stroke-width="3"/>`;
  const g = groups(d.sgtin);
  if (validSgtin(d.sgtin)) {
    const line1 = g.slice(0, 3).join("-") + (g.length > 3 ? "-" : "");
    const rest = g.slice(3);
    const last = rest.length ? rest[rest.length - 1] : "";
    const mid = rest.length > 1 ? rest.slice(0, -1).join("-") + "-" : "";
    body += `<text x="26" y="${y + 46}" ${mono}>SGTIN:${xml(line1)}</text>
  <text x="127" y="${y + 82}" ${mono}>${xml(mid)}<tspan font-weight="bold" font-size="31">${xml(last)}</tspan></text>`;
    y += 82;
  } else {
    body += `<text x="26" y="${y + 46}" ${mono}>SGTIN: ${xml(cut(d.sgtin, 22))}</text>`;
    y += 46;
  }
  const h = y + 34;
  const inner = `<rect x="3" y="3" width="494" height="${h - 6}" rx="22" fill="#fff" stroke="#9a9a9a" stroke-width="4"/>
  <text x="250" y="58" text-anchor="middle" font-size="38" fill="#444">QR-Code-Aufkleber</text>
  <text x="250" y="92" text-anchor="middle" font-size="21" font-weight="bold" text-decoration="underline" fill="#000">Aufkleber sorgfältig aufbewahren!</text>
  <rect x="${ox}" y="${oy}" width="${area}" height="${area}" fill="#fff"/>
  <path d="${path}" fill="#000" shape-rendering="crispEdges"/>
  ${body}`;
  return { h, inner };
}
export function stickerSvg(d) {
  const p = stickerParts(d);
  if (!p) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 ${p.h}" width="50mm" height="${(p.h / 10).toFixed(1)}mm" font-family="Arial,Helvetica,sans-serif">${p.inner}</svg>`;
}

function downloadBlob(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function svgToPng(svg, scale = 8) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/); const vw = vb ? +vb[1] : 500, vh = vb ? +vb[2] : 835;
      const c = document.createElement("canvas"); c.width = vw * scale / 2; c.height = vh * scale / 2;
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); c.toBlob((b) => (b ? res(b) : rej(new Error("PNG konnte nicht erzeugt werden"))), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Aufkleber konnte nicht gezeichnet werden")); };
    img.src = url;
  });
}
/* ---------- Bögen: Dokumentationsbogen nach dem Vorbild des Homematic-IP-Vordrucks und Aufkleber-Bogen ----------
   Seiten sind A4-SVGs (1 Einheit = 0,254 mm, also 827 x 1170). Daraus entstehen Druckseiten (PC) und ein PDF (Smartphone). */
const PW = 827, PH = 1170;
const pageSvg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="210mm" height="297mm" font-family="Arial,Helvetica,sans-serif"><rect width="${PW}" height="${PH}" fill="#fff"/>${inner}</svg>`;
function nestSticker(d, x, y, w) {
  const p = stickerParts(d), h = (p.h * w) / 500;
  return { h, svg: `<svg x="${x}" y="${y}" width="${w}" height="${h.toFixed(1)}" viewBox="0 0 500 ${p.h}">${p.inner}</svg>` };
}
const BOX = { x0: 63, dx: 366, y0: 188, dy: 321, w: 335, h: 291 };
export function docPages(devices, when = "", note = "", title = "") {
  const noteLines = wrap(note, 92, 2);
  const total = Math.max(1, Math.ceil(devices.length / 6)), pages = [];
  for (let p = 0; p < total; p++) {
    let s = `<rect width="${PW}" height="94" fill="#0C3358"/>
<text x="60" y="55" font-size="21" font-weight="bold" fill="#fff">Übersicht der Homematic IP Komponenten</text>
<text x="767" y="${title ? 44 : 55}" text-anchor="end" font-size="13" fill="#fff">${xml(when ? "Stand " + when + " · " : "")}Seite ${p + 1} von ${total}</text>${title ? `<text x="767" y="68" text-anchor="end" font-size="15" font-weight="bold" fill="#fff">${xml(cut(title, 34))}</text>` : ""}
<text x="63" y="131" font-size="17" fill="#484A4B">Notizen:</text>
<line x1="140" y1="132" x2="764" y2="132" stroke="#555" stroke-width="1"/><line x1="140" y1="160" x2="764" y2="160" stroke="#555" stroke-width="1"/>
${noteLines.map((l, k) => `<text x="144" y="${127 + k * 28}" font-size="12.5" fill="#0E324C">${xml(l)}</text>`).join("")}`;
    for (let i = 0; i < 6; i++) {
      const d = devices[p * 6 + i], x = BOX.x0 + (i % 2) * BOX.dx, y = BOX.y0 + Math.floor(i / 2) * BOX.dy;
      s += `<rect x="${x}" y="${y}" width="${BOX.w}" height="${BOX.h}" rx="5" fill="none" stroke="#88898A" stroke-width="1.2"/>
<line x1="${x + 164}" y1="${y}" x2="${x + 164}" y2="${y + BOX.h}" stroke="#88898A" stroke-width="1.2" stroke-dasharray="3 3"/>
<text x="${x + 10}" y="${y + 21}" font-size="14.5" font-weight="bold" fill="#484A4B">Gerätename:</text>
<text x="${x + 10}" y="${y + 117}" font-size="14.5" font-weight="bold" fill="#484A4B">Raum/Montageort:</text>
<text x="${x + 10}" y="${y + 215}" font-size="14.5" font-weight="bold" fill="#484A4B">Sonstiges:</text>
<text x="${x + 179}" y="${y + 21}" font-size="15.5" fill="#4E5051">QR-Code-Aufkleber</text>`;
      if (!d) continue;
      const put = (text, base) => wrap(text, 22, 4).forEach((l, k) => { s += `<text x="${x + 10}" y="${y + base + 19 + k * 17}" font-size="13" fill="#0E324C">${xml(l)}</text>`; });
      put(d.name, 21);
      put([d.room, d.loc].filter(Boolean).join(" · "), 117);
      put([typeLabel(d.type), d.note].filter(Boolean).join(" · "), 215);
      if (stickerContent(d)) {
        const p0 = stickerParts(d); const w = Math.min(160, (250 * 500) / p0.h);
        s += nestSticker(d, x + 164 + (171 - w) / 2, y + 30, w).svg;
      }
    }
    pages.push(pageSvg(s));
  }
  return pages;
}
export function stickerPages(devices, title = "", when = "") {
  const pages = [], cw = 189, gap = 30, x0 = (PW - (3 * cw + 2 * gap)) / 2, bottom = PH - 38, top = title ? 62 : 38;
  let s = "", y = top;
  for (let i = 0; i < devices.length; i += 3) {
    const row = devices.slice(i, i + 3).map((d, c) => nestSticker(d, x0 + c * (cw + gap), y, cw));
    const rh = Math.max(...row.map((r) => r.h));
    if (y + rh > bottom && s) { pages.push(s); s = ""; y = top; row.forEach((r, c) => { r.svg = nestSticker(devices[i + c], x0 + c * (cw + gap), y, cw).svg; }); }
    s += row.map((r) => r.svg).join(""); y += rh + 22;
  }
  if (s) pages.push(s);
  const n = pages.length;
  return pages.map((p, i) => pageSvg((title ? `<text x="${x0}" y="34" font-size="14" font-weight="bold" fill="#0E324C">${xml(cut(title, 50))}</text><text x="${PW - x0}" y="34" text-anchor="end" font-size="12" fill="#4F5054">${xml(when ? "Stand " + when + " · " : "")}Seite ${i + 1} von ${n}</text>` : "") + p));
}
/* Druckansicht für den PC: Seiten als Vektorgrafik */
export function sheetHtml(pages) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Homematic IP Komponenten</title>
<style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}.p{width:210mm;height:297mm;overflow:hidden;page-break-after:always;break-after:page}.p:last-child{page-break-after:auto;break-after:auto}.p svg{display:block}</style></head>
<body>${pages.map((p) => `<div class="p">${p}</div>`).join("")}</body></html>`;
}
function svgToJpeg(svg, w = 1654, h = 2339) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(async (b) => { try { res({ w, h, bytes: new Uint8Array(await b.arrayBuffer()) }); } catch (e) { rej(e); } }, "image/jpeg", 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Seite konnte nicht gezeichnet werden")); };
    img.src = url;
  });
}
/* Minimaler PDF-Schreiber: je Seite ein A4-JPEG, ohne Fremdbibliothek */
export async function pagesToPdf(pages) {
  const jpgs = []; for (const p of pages) jpgs.push(await svgToJpeg(p));
  const enc = new TextEncoder(), chunks = [], offs = []; let len = 0;
  const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const obj = (id, fn) => { offs[id] = len; push(`${id} 0 obj\n`); fn(); push("\nendobj\n"); };
  const n = jpgs.length;
  push("%PDF-1.4\n");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${jpgs.map((_, i) => `${3 + 3 * i} 0 R`).join(" ")}] >>`));
  jpgs.forEach((j, i) => {
    const pg = 3 + 3 * i, im = 4 + 3 * i, ct = 5 + 3 * i, c = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
    obj(pg, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`));
    obj(im, () => { push(`<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.bytes.length} >>\nstream\n`); push(j.bytes); push("\nendstream"); });
    obj(ct, () => push(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`));
  });
  const xref = len, size = 3 + 3 * n;
  push(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let id = 1; id < size; id++) push(String(offs[id]).padStart(10, "0") + " 00000 n \n");
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}

/* Mulish (SIL Open Font License, siehe fonts/OFL-Mulish.txt): freie Schrift, die der Schrift der Homematic-IP-App ähnelt */
(function loadFonts() {
  if (typeof document === "undefined" || document.getElementById("hmip-geraete-fonts")) return;
  const u = (f) => new URL("./fonts/" + f, import.meta.url).href;
  const st = document.createElement("style");
  st.id = "hmip-geraete-fonts";
  st.textContent = `@font-face{font-family:"Mulish";font-weight:400;font-style:normal;font-display:swap;src:url(${u("mulish-latin-400-normal.woff2")}) format("woff2")}
@font-face{font-family:"Mulish";font-weight:700;font-style:normal;font-display:swap;src:url(${u("mulish-latin-700-normal.woff2")}) format("woff2")}`;
  document.head.appendChild(st);
})();

const ICON = {
  scan: '<svg viewBox="0 0 24 24"><path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3v10.5H4z"/><circle cx="12" cy="13.5" r="3.4"/></svg>',
  photo: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2.2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17.5l5-4 4 3 3-2 4 3"/></svg>',
  manual: '<svg viewBox="0 0 24 24"><path d="M4 20l1-4.2L16.3 4.5l3.2 3.2L8.2 19z"/><path d="M14 6.8l3.2 3.2"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/></svg>',
};

const TEMPLATE = `
<style>
:host{display:block;height:100%;overflow:auto;box-sizing:border-box;
  --cyan:#01B7CD;--navy:#0E324C;--grey:#4F5054;--bg:#F3F2F7;--mut:#667180;--line:#E1E6EA;--bad:#C62828;
  background:var(--bg);color:var(--navy);font:400 16px/1.4 Mulish,"Segoe UI",system-ui,sans-serif;-webkit-text-size-adjust:100%}
*{box-sizing:border-box}
header{position:sticky;top:0;z-index:5;background:var(--navy);color:#fff;padding:10px 12px 14px;border-radius:0 0 22px 22px;box-shadow:0 2px 8px rgba(14,50,76,.35)}
header .top{display:flex;align-items:center;gap:8px;min-height:40px}
header .title{flex:1;text-align:center;min-width:0}
header h1{margin:0;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:.2px}
#count{font-size:13px;opacity:.85;font-weight:400}
header .spacer{width:36px;flex:none}
button{font:inherit;font-weight:700;display:inline-flex;align-items:center;justify-content:center;text-align:center;line-height:1.2;min-width:0;
  border:0;border-radius:14px;padding:12px 14px;background:#fff;color:var(--navy);cursor:pointer;overflow-wrap:anywhere;-webkit-tap-highlight-color:transparent}
header button.burger{background:transparent;color:#fff;padding:4px 6px;font-size:24px;line-height:1;width:36px;flex:none}
.tiles{display:flex;gap:10px;margin-top:10px}
.tile{flex:1 1 0;flex-direction:column;gap:3px;padding:9px 2px 7px;white-space:nowrap;overflow-wrap:normal;background:var(--cyan);color:#fff;border:3px solid #fff;border-radius:20px;font-size:11.5px;letter-spacing:0}
.tile svg{width:26px;height:26px;stroke:#fff;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.tile svg circle[r="1.5"]{fill:#fff}
button.pri{background:var(--navy);color:#fff}
button.bad{background:var(--bad);color:#fff}
button.ghost{background:#fff;color:var(--navy);border:2px solid var(--cyan)}
button:disabled{opacity:.5}
button:focus-visible{outline:3px solid var(--cyan);outline-offset:2px}
main{padding:14px 12px 28px;max-width:900px;margin:0 auto}
.tools{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
input,select,textarea{font:inherit;color:var(--navy);width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--line);border-radius:14px}
input:focus,select:focus,textarea:focus{outline:2px solid var(--cyan);outline-offset:0;background:#fff}
.tools input,.tools select{background:#fff}
.tools input{flex:2 1 160px}.tools select{flex:1 1 140px}
.tools button{flex:1 1 120px;padding:10px 12px;font-size:14px}
.tools button.on{background:var(--navy);color:#fff}
#fInfo{font-size:13px;color:var(--mut);margin:-4px 2px 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#fInfo button{padding:4px 10px;font-size:13px;border-radius:999px;background:#E9EDF1;color:var(--navy)}
.info{background:#fff;border-radius:20px;margin-bottom:12px;box-shadow:0 1px 3px rgba(14,50,76,.12);border-left:6px solid var(--cyan);overflow:hidden}
.info summary{cursor:pointer;padding:12px 14px;font-weight:700;color:var(--navy);list-style:none;display:flex;align-items:center;gap:10px}
.info summary::-webkit-details-marker{display:none}
.info summary .i{flex:none;width:26px;height:26px;border-radius:50%;background:var(--cyan);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px}
.info summary .tg{margin-left:auto;font-size:13px;color:var(--mut);font-weight:400}
.info[open] summary .tg::after{content:"ausblenden"}.info:not([open]) summary .tg::after{content:"anzeigen"}
.info .body{padding:0 14px 12px;font-size:14.5px;line-height:1.45}
.info .card{border-radius:14px;padding:10px 12px;margin:8px 0}
.info .card.full{background:#E6F7FA}.info .card.onl{background:#F3F2F7}
.info .card .h{display:block;margin-bottom:3px;font-weight:700}
.info ul{margin:4px 0 0 18px;padding:0}.info li{margin:2px 0}
.ver{display:block;text-align:center;color:var(--mut);margin-top:4px}
.help b{display:block;margin-top:8px}.help p{margin:2px 0 0;font-size:14.5px}
.row2{display:flex;gap:10px;position:sticky;bottom:0;background:#fff;padding:6px 0 4px}.row2>*{flex:1}
.chks{display:flex;flex-direction:column;max-height:28vh;overflow:auto;border:1px solid var(--line);border-radius:14px;padding:4px 10px;background:var(--bg)}
.chk{display:flex;align-items:center;gap:10px;padding:7px 2px;font-size:15px;cursor:pointer}
.chk input{width:20px;height:20px;flex:none;accent-color:var(--cyan);margin:0;padding:0}
.chk small.code{color:var(--mut);font-size:12px}
.chk .n{margin-left:auto;color:var(--mut);font-size:13px}
.cb{width:26px;height:26px;border-radius:8px;border:2px solid var(--cyan);flex:none;display:flex;align-items:center;justify-content:center;background:#fff}
.cb svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;display:none}
.item.sel .cb{background:var(--cyan)}.item.sel .cb svg{display:block}
.item.sel{box-shadow:0 0 0 2px var(--cyan)}
.item{background:#fff;border-radius:20px;padding:12px 14px;margin-bottom:10px;display:flex;gap:12px;align-items:center;box-shadow:0 1px 3px rgba(14,50,76,.12);cursor:pointer}
.ico{width:46px;height:46px;border-radius:14px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:13px;line-height:1;font-weight:700}
.ico svg{width:16px;height:16px;stroke:#fff;fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.ico.ok{background:var(--cyan);color:#fff;border:3px solid #fff;box-shadow:0 0 0 1px rgba(1,183,205,.55)}
.ico.miss{background:#E9EDF1;color:#8A93A0}
.item .main{min-width:0;flex:1}
.item .t{font-weight:700;color:var(--navy)}
.item .s{color:var(--mut);font-size:14px;word-break:break-word}
.chev{color:#C3CBD2;font-size:28px;line-height:1;flex:none}
.pill{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;margin:3px 4px 0 0}
.pill.chg{background:#FFE7B8;color:#5B4200}.pill.gone{background:#FBE1E1;color:#8A1C1C}
.pill.ok{background:var(--navy);color:#fff}.pill.miss{background:#E9EDF1;color:var(--grey)}.pill.room{background:#DDF4F7;color:var(--navy)}
.empty{text-align:center;color:var(--mut);padding:40px 10px}
dialog{border:0;border-radius:24px;padding:0;width:min(94vw,560px);max-height:92vh;overflow-y:auto;overscroll-behavior:contain;background:#fff;color:var(--navy)}
dialog::backdrop{background:rgba(14,50,76,.55)}
.dlg{padding:16px 16px 10px;display:flex;flex-direction:column;gap:12px}
.dlg h2{margin:0;font-size:22px;font-weight:700;color:var(--navy)}
label{font-size:13px;color:var(--grey);font-weight:700;display:block;margin-bottom:4px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}.row>*{flex:1 1 220px;min-width:0}
.keyrow{display:flex;gap:8px}.keyrow input{flex:1;min-width:0}.keyrow button{flex:none}
.actions{display:flex;flex-wrap:wrap;gap:8px;position:sticky;bottom:0;background:#fff;padding:10px 0 4px;border-top:1px solid var(--line);margin-top:4px}
.actions button{flex:1 1 auto;padding:13px 10px}
.btns{display:flex;flex-wrap:wrap;gap:8px}.btns button{flex:1 1 auto}
video{width:100%;border-radius:16px;background:#000;max-height:55vh}
.msg{padding:10px 12px;border-radius:14px;font-size:14px}
.msg.warn{background:#FFF3D6;color:#5B4200}
.msg.ok{background:#DDF4F7;color:var(--navy)}
#eSticker{background:#fff;border-radius:12px;padding:6px;align-self:flex-start;border:1px solid var(--line)}#eSticker svg{display:block;width:190px;height:auto}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--navy);color:#fff;padding:11px 18px;border-radius:999px;z-index:99;display:none;font-weight:700;max-width:92vw;text-align:center}
small{color:var(--mut)}
</style>
<header>
  <div class="top"><button class="burger" id="bBurger" style="display:none" aria-label="Menü">☰</button>
    <div class="title"><h1>HmIP Geräte</h1><div id="count"></div></div><span class="spacer"></span></div>
  <div class="tiles">
    <button class="tile" id="bScan">${ICON.scan}<span>Scannen</span></button>
    <button class="tile" id="bPhoto">${ICON.photo}<span>Foto</span></button>
    <button class="tile" id="bManual">${ICON.manual}<span>Manuell</span></button>
    <button class="tile" id="bMenu">${ICON.menu}<span>Menü</span></button>
  </div>
</header>
<main>
  <details class="info" id="help" open>
    <summary><span class="i">i</span>Original-Code und Online-Code: Was ist der Unterschied?<span class="tg"></span></summary>
    <div class="body">
      <div class="card full"><span class="h">Original-Code (mit Key) – „QR-Code-Aufkleber erfasst“</span>
        Der QR-Code des Original-Aufklebers enthält die Gerätenummer (SGTIN) <u>und</u> den Geräteschlüssel (Key).
        <ul><li>Reicht für jedes Anlernen, auch <b>offline an der HCU</b> ohne Internet (Anwenderhandbuch 5.3.6.2: dafür wird der „Local Key“ vom beiliegenden Aufkleber gebraucht).</li>
        <li>Den Key gibt es <b>nur auf dem Original-Aufkleber</b>. Weder die HCU noch Home Assistant geben ihn heraus. Deshalb jeden Original-Aufkleber einmal scannen.</li></ul></div>
      <div class="card onl"><span class="h">Online-Code (ohne Key) – „QR-Code-Aufkleber fehlt“</span>
        Ist kein Key erfasst, erzeugt die App den Aufkleber nur aus der SGTIN. Er trägt den Hinweis „Ohne Key – nur Online-Anlernen“.
        <ul><li>Reicht für das <b>normale Anlernen mit Internet</b>: Das Gerät wird dabei über den Homematic-IP-Server registriert; statt des QR-Codes genügen auch die letzten 4 Ziffern der SGTIN (Anwenderhandbuch 5.3.6.1).</li>
        <li>Reicht <b>nicht</b> für das Offline-Anlernen an der HCU.</li></ul></div>
      Tipp: Filter → „QR-Code-Aufkleber fehlt“ zeigt, welche Original-Aufkleber noch gescannt werden müssen. Bögen mit Original-Codes enthalten die Geräteschlüssel – sicher aufbewahren.
    </div>
  </details>
  <div class="tools">
    <input id="q" type="search" placeholder="Suchen …">
    <button type="button" class="ghost" id="bFilter">Filter</button>
    <button type="button" class="ghost" id="bSelect">Auswählen</button>
  </div>
  <div id="fInfo" hidden></div>
  <div id="list"></div>
</main>

<input type="file" id="filePhoto" accept="image/*" capture="environment" hidden>
<input type="file" id="fileImport" accept=".json,application/json" hidden>
<div class="toast" id="toast"></div>

<dialog id="dScan"><div class="dlg">
  <h2>QR-Code-Aufkleber scannen</h2>
  <video id="vid" playsinline muted></video>
  <div id="scanMsg" class="msg warn">Kamera wird gestartet …</div>
  <button class="ghost" id="scanClose">Abbrechen</button>
</div></dialog>

<dialog id="dEdit"><form class="dlg" id="fEdit" method="dialog">
  <h2 id="eTitle">Gerät</h2>
  <div id="eMsg"></div>
  <div><label>SGTIN / Gerätenummer <span id="eLast4"></span></label><input id="eSgtin" autocapitalize="characters" spellcheck="false"></div>
  <div><label>Geräteschlüssel (geheim; Hex oder gedruckte Schreibweise)</label>
    <div class="keyrow"><input id="eKey" type="password" autocomplete="off" spellcheck="false" autocapitalize="characters"><button type="button" class="ghost" id="eKeyShow">anzeigen</button></div></div>
  <div id="eRawWrap" hidden><label>Scan-Inhalt (Format unbekannt, unverändert gespeichert)</label><textarea id="eRaw" rows="2" readonly></textarea></div>
  <div class="row">
    <div><label>Name (wie in HmIP-App)</label><input id="eName"></div>
    <div><label>Gerätetyp</label><input id="eType" list="types" placeholder="z. B. HmIP-SWDO"></div>
  </div>
  <div class="row">
    <div><label>Raum</label><input id="eRoom" list="rooms"></div>
    <div><label>Einbauort</label><input id="eLoc" placeholder="z. B. Fenster links"></div>
  </div>
  <div><label>Firmware</label><input id="eFw"></div>
  <div><label>Notiz</label><textarea id="eNote" rows="2"></textarea></div>
  <div id="eStBox" hidden>
    <label>QR-Code-Aufkleber (aus den gespeicherten Daten erzeugt)</label>
    <button type="button" class="ghost" id="eStToggle">Aufkleber anzeigen</button>
    <div id="eStWrap" hidden style="margin-top:8px">
      <div id="eSticker"></div>
      <div class="btns" style="margin-top:8px">
        <button type="button" class="ghost" id="eStPng">PNG</button>
        <button type="button" class="ghost" id="eStSvg">SVG</button>
        <button type="button" class="ghost" id="eStPrint">Bogen-PDF</button>
      </div>
      <small>Der QR-Code enthält SGTIN und Geräteschlüssel und lässt sich mit der Homematic-IP-App scannen. Der Schlüssel steht auch als Text im Aufkleber, so wie beim Original.</small>
    </div>
  </div>
  <div class="actions">
    <button type="button" class="bad" id="eDel">Löschen</button>
    <button type="button" class="ghost" id="eCancel">Abbrechen</button>
    <button type="submit" class="pri" id="eSave">Speichern</button>
  </div>
  <datalist id="rooms"></datalist><datalist id="types"></datalist>
</form></dialog>

<dialog id="dFilter"><div class="dlg">
  <h2>Filter</h2>
  <label>Räume</label><div class="chks" id="fRooms"></div>
  <label>Kategorien (wie auf homematic-ip.com)</label><div class="chks" id="fCats"></div>
  <label>Gerätetypen</label><div class="chks" id="fTypes"></div>
  <label>QR-Code-Aufkleber</label>
  <select id="fStatus"><option value="">Alle Geräte</option><option value="missing">QR-Code-Aufkleber fehlt</option><option value="done">QR-Code-Aufkleber erfasst</option><option value="srcchg">In {{SRC}} geändert</option><option value="gone">Nicht mehr in {{SRC}}</option></select>
  <div class="row2"><button type="button" class="ghost" id="fReset">Zurücksetzen</button><button type="button" class="pri" id="fDone">Fertig</button></div>
</div></dialog>
<dialog id="dMenu"><div class="dlg">
  <h2>Übernahme, Aufkleber, Export</h2>
  <button class="pri" id="mHa">Geräte aus {{SRC}} übernehmen</button>
  <small>Liest alle eQ-3-Geräte mit Seriennummer aus {{SRC}} (Name, Typ, Raum, Firmware). Vorhandene Einträge und deine Eingaben bleiben erhalten. Der Abgleich läuft auch automatisch beim Öffnen dieser Seite; geänderte Namen und Räume sowie entfernte Geräte werden markiert.</small>
  <button class="pri" id="mPrint">Ausdrucke erstellen …</button>
  <small>Dokumentationsbogen (Nachbau des Homematic-IP-Vordrucks) oder nur QR-Code-Aufkleber, aufgeteilt nach Räumen, Funktion oder Alphabet. Jeder Bogen beginnt auf einer neuen Seite und lässt sich einzeln neu drucken und austauschen.</small>
  <button class="ghost" id="mCsv">CSV für Excel exportieren</button>
  <small>Die CSV enthält keine Geräteschlüssel.</small>
  <button class="ghost" id="mJson">Backup (JSON, enthält die Geräteschlüssel)</button>
  <button class="ghost" id="mImport">Backup importieren</button>
  <small>{{STORAGE_NOTE}} Backups aus früheren Versionen lassen sich importieren (Fotos werden nicht mehr übernommen).</small>
  <button class="ghost" id="mHelp">Anleitung</button>
  <button class="ghost" id="mPw" hidden>Passwort ändern</button>
  <button class="ghost" id="mLogout" hidden>Abmelden</button>
  <button class="ghost" id="mClose">Schließen</button>
  <small class="ver">HmIP Geräteverwaltung · Version <span class="vno"></span></small>
</div></dialog>
<dialog id="dPrint"><div class="dlg">
  <h2>Ausdrucke</h2>
  <label>Vorlage</label>
  <select id="pTpl"><option value="room">Nach Räumen (je Raum ein Bogen)</option><option value="func">Nach Funktion (je Kategorie ein Bogen; Geräte in allen ihren Kategorien)</option><option value="alpha">Alphabetisch (je Anfangsbuchstabe ein Bogen)</option><option value="sel">Aktueller Filter bzw. Auswahl (ein Bogen)</option></select>
  <label>Inhalt</label>
  <select id="pKind"><option value="doc">Dokumentationsbogen (6 Geräte je Seite)</option><option value="stk">Nur QR-Code-Aufkleber</option></select>
  <label>Bögen <small>(nur angehakte werden gedruckt)</small></label>
  <div class="row2" style="position:static;padding:0"><button type="button" class="ghost" id="pAll">Alle</button><button type="button" class="ghost" id="pNone">Keine</button></div>
  <div class="chks" id="pSecs" style="max-height:40vh"></div>
  <small>Jeder Bogen beginnt auf einer neuen Seite; Kopfzeile mit Bogenname, Stand und Seitenzahl. So lässt sich nach Änderungen nur der betroffene Bogen neu drucken und im Ordner austauschen. „Zuletzt geändert“ zeigt, wann sich ein Gerät des Bogens zuletzt geändert hat.</small>
  <div class="row2"><button type="button" class="ghost" id="pPrint">Drucken (PC)</button><button type="button" class="pri" id="pPdf">PDF erstellen</button></div>
  <button type="button" class="ghost" id="pClose">Schließen</button>
</div></dialog>
<dialog id="dHelp"><div class="dlg">
  <h2>Anleitung</h2>
  <div class="help">
  <b>1. Geräte übernehmen</b><p>Die Geräte kommen automatisch aus {{SRC}} (Name, Typ, Raum, Firmware, Seriennummer). Über Menü → „Geräte aus {{SRC}} übernehmen“ geht es auch von Hand.</p>
  <b>2. Original-Aufkleber scannen</b><p>„Scannen“ öffnet die Kamera, „Foto“ liest ein Bild aus. Der Code wird dem Gerät mit derselben Seriennummer zugeordnet; so wird der Geräteschlüssel (Key) gespeichert. Ohne Key erzeugt die App einen Online-Code (siehe Erklärung oben auf der Seite).</p>
  <b>3. Ergänzen</b><p>Gerät antippen: Einbauort und Notiz eintragen, speichern.</p>
  <b>4. Ausdrucken</b><p>Menü → „Ausdrucke erstellen“: Vorlage wählen (Räume, Funktion, Alphabet), Bögen anhaken, als PDF speichern oder am PC drucken. Ändert sich später etwas, nur den betroffenen Bogen neu drucken und austauschen.</p>
  <b>5. Änderungen</b><p>Werden Geräte in {{SRC}} umbenannt, verschoben oder entfernt, markiert die Liste sie. Im Gerät „Übernehmen“ oder „Beibehalten“ wählen.</p>
  <b>6. Sichern</b><p>Menü → „Backup (JSON)“ sichert alles inklusive Geräteschlüsseln. Bögen und Backups enthalten die Schlüssel – sicher aufbewahren.</p>
  {{HELP_EXTRA}}
  </div>
  <small class="ver">Version <span class="vno"></span></small>
  <button type="button" class="ghost" id="hClose">Schließen</button>
</div></dialog>
<dialog id="dPw"><form class="dlg" id="fPw" method="dialog">
  <h2>Passwort ändern</h2>
  <div><label>Bisheriges Passwort</label><input id="pwOld" type="password" autocomplete="current-password"></div>
  <div><label>Neues Passwort (mindestens 8 Zeichen)</label><input id="pwNew" type="password" autocomplete="new-password"></div>
  <div><label>Neues Passwort wiederholen</label><input id="pwNew2" type="password" autocomplete="new-password"></div>
  <div id="pwMsg"></div>
  <div class="row2"><button type="button" class="ghost" id="pwCancel">Abbrechen</button><button type="submit" class="pri">Ändern</button></div>
</form></dialog>
`;

const DEFAULT_CFG = {
  source: "Home Assistant",
  storageNote: "Die Daten liegen in Home Assistant (.storage) und sind in dessen Backups enthalten. Das Panel ist nur für Administratoren sichtbar.",
  /* Version aus dem Modul-Pfad (?v=<Version>-<Prüfsumme>), den die Integration setzt */
  version: (() => { try { return (new URL(import.meta.url).searchParams.get("v") || "").split("-")[0]; } catch (e) { return ""; } })(),
};
const FIELDS = ["id", "raw", "sgtin", "key", "fmt", "name", "type", "room", "loc", "note", "fw", "created", "updated",
  "src_name", "src_room", "src_type", "ack_name", "ack_room", "missing"];
/* Abgleich mit der Quelle: Name/Raum weichen ab und sind nicht bestätigt; Gerät gibt es in der Quelle nicht mehr */
const SRC_FIELDS = { name: "Name", room: "Raum" };
const pendingOf = (d, vals = d) => Object.keys(SRC_FIELDS).filter((k) => { const s = d["src_" + k] || ""; return s && s !== (vals[k] || "") && s !== (d["ack_" + k] || ""); });
const isGone = (d) => d.missing === "1";

function init(host) {
  const root = host.shadowRoot, cfg = host.cfg || DEFAULT_CFG;
  const $ = (id) => root.getElementById(id);
  const ws = (m) => host.hass.connection.sendMessagePromise(m);
  let devices = [], cur = null, stream = null, scanning = false, detector = null;

  /* ---------- Helfer ---------- */
  const errText = (e) => (e && (e.message || e.code)) || JSON.stringify(e);
  function toast(t) {
    const e = $("toast"); e.textContent = t; e.style.display = "block";
    clearTimeout(toast.t); toast.t = setTimeout(() => (e.style.display = "none"), 2800);
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const last4 = (s) => norm(s).slice(-4);
  const setLast4 = (s) => { $("eLast4").textContent = norm(s) ? `(letzte 4: ${last4(s)})` : ""; };
  function findDup(sgtin, raw, exceptId) {
    const ns = norm(sgtin);
    return devices.find((d) => d.id !== exceptId && ((ns && norm(d.sgtin) === ns) || (raw && d.raw && d.raw === raw)));
  }

  /* ---------- Server-API (Websocket) ---------- */
  const dbAll = () => ws({ type: "hmip_geraete/list" });
  function dbSave(d) {
    const device = {};
    FIELDS.forEach((k) => (device[k] = d[k] ?? ""));
    return ws({ type: "hmip_geraete/save", device });
  }
  const dbDel = (id) => ws({ type: "hmip_geraete/delete", device_id: id });

  /* ---------- Barcode ---------- */
  /* Erkennung: eingebauter BarcodeDetector (schnell), sonst jsQR (läuft in jedem Browser, nur QR-Codes) */
  function jsqrDetector() {
    const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
    return {
      async detect(src) {
        let w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
        if (!w || !h) return [];
        const k = Math.min(1, 1280 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        cv.width = w; cv.height = h; cx.drawImage(src, 0, 0, w, h);
        const r = jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" });
        return r ? [{ rawValue: r.data }] : [];
      },
    };
  }
  async function getDetector() {
    if (detector) return detector;
    if ("BarcodeDetector" in window) {
      try {
        const sup = await BarcodeDetector.getSupportedFormats();
        if (sup.includes("qr_code")) {
          const want = ["qr_code", "data_matrix", "code_128", "code_39", "ean_13", "ean_8", "itf", "pdf417", "aztec"];
          detector = new BarcodeDetector({ formats: want.filter((f) => sup.includes(f)) });
          return detector;
        }
      } catch (e) { /* weiter mit jsQR */ }
    }
    detector = jsqrDetector();
    return detector;
  }

  async function startScan() {
    const det = await getDetector();
    $("dScan").showModal();
    if (!navigator.mediaDevices?.getUserMedia) { $("scanMsg").textContent = "Kein Kamerazugriff (HTTPS nötig). Nimm „Foto“ oder „Manuell“."; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false });
      $("vid").srcObject = stream; await $("vid").play();
      $("scanMsg").textContent = "QR-Code-Aufkleber ins Bild halten …"; scanning = true; loop(det);
    } catch (e) { $("scanMsg").textContent = "Kamera nicht verfügbar: " + e.message + ". Nimm „Foto“ oder „Manuell“."; }
  }

  async function loop(det) {
    const v = $("vid");
    while (scanning) {
      try {
        if (v.readyState >= 2) {
          const r = await det.detect(v);
          if (r.length) {
            const raw = r[0].rawValue;
            stopScan();
            if (navigator.vibrate) navigator.vibrate(60);
            openFromScan(raw); return;
          }
        }
      } catch (e) { /* weiter versuchen */ }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  function stopScan() {
    scanning = false;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    $("vid").srcObject = null;
    if ($("dScan").open) $("dScan").close();
  }
  host._stopScan = stopScan;

  /* Foto wird nur ausgewertet und nicht gespeichert */
  async function fromPhoto(file) {
    if (!file) return;
    const det = await getDetector();
    let raw = "";
    if (det) { try { const bmp = await createImageBitmap(file); /* jsQR braucht ein Bild mit Breite/Höhe */ const r = await det.detect(bmp); if (r.length) raw = r[0].rawValue; } catch (e) { /* kein Code */ } }
    if (!raw) { openEdit(newDev(), det ? "Im Foto wurde kein QR-Code erkannt. SGTIN und Schlüssel bitte von Hand eintragen." : "Dieser Browser erkennt keine Codes im Foto. SGTIN und Schlüssel bitte von Hand eintragen."); return; }
    openFromScan(raw);
  }

  /* Gescannter Code: passt die SGTIN zu einem vorhandenen Gerät, wird dieses ergänzt statt ein neues anzulegen. */
  function openFromScan(raw) {
    const p = parseCode(raw);
    const m = p.sgtin ? devices.find((d) => norm(d.sgtin) === p.sgtin) : null;
    if (!m) {
      const d = newDev();
      Object.assign(d, { sgtin: p.sgtin, key: p.key, fmt: p.fmt, raw: p.raw });
      openEdit(d, p.key ? (devices.length ? "Dieses Gerät ist noch nicht in der Liste." : null)
        : "Das Format des Codes ist unbekannt. Er wird unverändert gespeichert, einen Aufkleber kann die App daraus nicht erzeugen.");
      return;
    }
    const d = { ...m };
    const had = hasCode(m);
    if (!validKey(m.key) && p.key) { d.key = p.key; d.fmt = p.fmt; }
    if (!hasCode(m) && p.raw) d.raw = p.raw;
    openEdit(d, `Gerät aus der Liste erkannt: ${m.name || m.type || "ohne Name"}.` + (had ? " Der QR-Code-Aufkleber war schon erfasst." : ""));
  }

  /* ---------- Datenmodell ---------- */
  function newDev() {
    return { id: uid(), raw: "", sgtin: "", key: "", fmt: "", name: "", type: "", room: "", loc: "", note: "", fw: "", created: new Date().toISOString(), isNew: true };
  }

  /* ---------- UI ---------- */
  /* Filter: mehrere Räume und Gerätetypen, Status, Suche. Handauswahl hat für die Bögen Vorrang. */
  const fRooms = new Set(), fTypes = new Set(), fCats = new Set(), picked = new Set();
  const catsOf = (d) => { const c = typeCategories(d.type); return c.length ? c : [NOCAT]; };
  let selMode = false;
  const NOROOM = "\u0000ohne";
  const roomOf = (d) => d.room || NOROOM;
  function refreshLists() {
    const rooms = [...new Set(devices.map((d) => d.room).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
    const types = [...new Set(devices.map((d) => d.type).filter(Boolean))].sort();
    const tkeys = new Set(devices.map((d) => d.type).filter(Boolean).map(typeKey));
    $("rooms").innerHTML = rooms.map((r) => `<option value="${esc(r)}">`).join("");
    $("types").innerHTML = types.map((r) => `<option value="${esc(r)}">`).join("");
    for (const r of [...fRooms]) if (r !== NOROOM && !rooms.includes(r)) fRooms.delete(r);
    for (const t of [...fTypes]) if (!tkeys.has(t)) fTypes.delete(t);
    for (const id of [...picked]) if (!devices.some((d) => d.id === id)) picked.delete(id);
  }
  function fillFilterDialog() {
    const cnt = (f) => devices.filter(f).length;
    const rooms = [...new Set(devices.map((d) => d.room).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
    if (devices.some((d) => !d.room)) rooms.push(NOROOM);
    const groups = new Map();
    for (const d of devices) if (d.type) { const k = typeKey(d.type); if (!groups.has(k)) groups.set(k, new Set()); groups.get(k).add(d.type.split(/\s+/)[0]); }
    const types = [...groups.keys()].sort((a, b) => a.localeCompare(b, "de"));
    const box = (set, v, label, n, sub) => `<label class="chk"><input type="checkbox" data-v="${esc(v)}"${set.has(v) ? " checked" : ""}><span>${esc(label)}${sub ? `<br><small class="code">${esc(sub)}</small>` : ""}</span><span class="n">${n}</span></label>`;
    $("fRooms").innerHTML = rooms.map((r) => box(fRooms, r, r === NOROOM ? "(ohne Raum)" : r, cnt((d) => roomOf(d) === r))).join("") || "<small>Keine Räume</small>";
    const catList = CATEGORIES.filter((c) => devices.some((d) => catsOf(d).includes(c)));
    if (devices.some((d) => catsOf(d).includes(NOCAT))) catList.push(NOCAT);
    $("fCats").innerHTML = catList.map((c) => box(fCats, c, c === NOCAT ? "(ohne Kategorie)" : c, cnt((d) => catsOf(d).includes(c)))).join("") || "<small>Keine Kategorien</small>";
    $("fTypes").innerHTML = types.map((t) => box(fTypes, t, t, cnt((d) => d.type && typeKey(d.type) === t), t === [...groups.get(t)][0] && groups.get(t).size === 1 ? "" : [...groups.get(t)].sort().join(", "))).join("") || "<small>Keine Typen</small>";
  }
  function filtered() {
    const q = $("q").value.trim().toLowerCase(), fs = $("fStatus").value;
    return devices.filter((d) => (!fRooms.size || fRooms.has(roomOf(d))) && (!fTypes.size || (d.type && fTypes.has(typeKey(d.type)))) && (!fCats.size || catsOf(d).some((c) => fCats.has(c))) &&
      (!fs || (fs === "srcchg" ? pendingOf(d).length > 0 : fs === "gone" ? isGone(d) : (fs === "done") === hasCode(d))) && (!q || [d.name, d.type, typeName(d.type), d.room, d.loc, d.sgtin, d.note].join(" ").toLowerCase().includes(q)))
      .sort(byRoom);
  }
  const byRoom = (a, b) => (!a.room - !b.room) || (a.room || "").localeCompare(b.room || "", "de") || (a.name || "").localeCompare(b.name || "", "de");
  /* Beschreibung der aktiven Filter (Liste und Notizzeile des Bogens) */
  function filterText() {
    const p = [], q = $("q").value.trim(), fs = $("fStatus").value;
    if (fRooms.size) p.push((fRooms.size > 1 ? "Räume: " : "Raum: ") + [...fRooms].map((r) => (r === NOROOM ? "ohne Raum" : r)).sort((a, b) => a.localeCompare(b, "de")).join(", "));
    if (fCats.size) p.push((fCats.size > 1 ? "Kategorien: " : "Kategorie: ") + CATEGORIES.concat([NOCAT]).filter((c) => fCats.has(c)).map((c) => (c === NOCAT ? "ohne Kategorie" : c)).join(", "));
    if (fTypes.size) p.push((fTypes.size > 1 ? "Gerätetypen: " : "Gerätetyp: ") + [...fTypes].sort((a, b) => a.localeCompare(b, "de")).join(", "));
    if (fs) p.push({ done: "QR-Code-Aufkleber erfasst", missing: "QR-Code-Aufkleber fehlt", srcchg: `In ${cfg.source} geändert`, gone: `Nicht mehr in ${cfg.source}` }[fs]);
    if (q) p.push(`Suche „${q}“`);
    return p.join(" · ");
  }
  /* Geräte für die Bögen: Handauswahl, sonst die gefilterte Liste */
  function sheetSet() {
    if (picked.size) { const l = devices.filter((d) => picked.has(d.id)).sort(byRoom); return { list: l, note: `Handauswahl: ${l.length} ${l.length === 1 ? "Gerät" : "Geräte"}` }; }
    const l = filtered(), f = filterText();
    return { list: l, note: f ? `Filter: ${f} (${l.length} ${l.length === 1 ? "Gerät" : "Geräte"})` : `Alle Geräte (${l.length})` };
  }

  /* ---------- Druckvorlagen: Bögen (Abschnitte), die jeweils auf einer neuen Seite beginnen ---------- */
  const TPL_NAMES = { room: "Nach Räumen", func: "Nach Funktion", alpha: "Alphabetisch", sel: "Filter/Auswahl" };
  /* Funktions-Bögen: nach Gerät (Bezeichnung bzw. Kürzel), dann Name */
  const byType = (a, b) => typeKey(a.type).localeCompare(typeKey(b.type), "de") || (a.type || "").localeCompare(b.type || "", "de") || byName(a, b);
  const byName = (a, b) => (a.name || a.type || "").localeCompare(b.name || b.type || "", "de");
  const initial = (d) => { const c = (d.name || d.type || "#").normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
  function sections(tpl) {
    const map = new Map(), add = (k, d) => { if (!map.has(k)) map.set(k, []); map.get(k).push(d); };
    if (tpl === "sel") { const s = sheetSet(); return [{ key: "sel", title: "Auswahl", note: s.note, list: s.list }]; }
    for (const d of devices) {
      if (tpl === "room") add(d.room || "(ohne Raum)", d);
      else if (tpl === "func") { const c = typeCategories(d.type); (c.length ? c : ["(ohne Kategorie)"]).forEach((k) => add(k, d)); } // in allen Kategorien laut Homepage
      else add(initial(d), d);
    }
    let keys = [...map.keys()];
    if (tpl === "func") keys.sort((a, b) => (CATEGORIES.indexOf(a) + 1 || 99) - (CATEGORIES.indexOf(b) + 1 || 99));
    else keys.sort((a, b) => (a.startsWith("(") - b.startsWith("(")) || (a === "#") - (b === "#") || a.localeCompare(b, "de"));
    return keys.map((k) => ({ key: k, title: tpl === "alpha" ? `Buchstabe ${k}` : k, note: `Bogen: ${tpl === "alpha" ? "Buchstabe " + k : k} · Vorlage: ${TPL_NAMES[tpl]}`,
      list: map.get(k).sort(tpl === "room" ? byName : tpl === "func" ? byType : (a, b) => (a.room || "~").localeCompare(b.room || "~", "de") || byName(a, b)) }));
  }
  const lastChange = (l) => l.map((d) => d.updated || d.created || "").sort().pop() || "";
  const fmtDate = (iso) => { const t = Date.parse(iso); return isNaN(t) ? "–" : new Date(t).toLocaleDateString("de-DE"); };
  let pSel = null;
  function fillPrint() {
    const tpl = $("pTpl").value, kind = $("pKind").value, secs = sections(tpl);
    if (!pSel || pSel.tpl !== tpl) pSel = { tpl, keys: new Set(secs.map((x) => x.key)) };
    $("pSecs").innerHTML = secs.map((x) => {
      const n = kind === "doc" ? x.list.length : x.list.filter((d) => stickerContent(d)).length;
      const pages = kind === "doc" ? Math.max(1, Math.ceil(x.list.length / 6)) : stickerPages(x.list.filter((d) => stickerContent(d))).length;
      return `<label class="chk"><input type="checkbox" data-k="${esc(x.key)}"${pSel.keys.has(x.key) ? " checked" : ""}><span>${esc(x.title)}<br><small class="code">${n} ${n === 1 ? "Gerät" : "Geräte"} · ${pages} ${pages === 1 ? "Seite" : "Seiten"} · zuletzt geändert ${fmtDate(lastChange(x.list))}</small></span></label>`;
    }).join("") || "<small>Keine Geräte</small>";
  }
  function printSet() {
    const tpl = $("pTpl").value, kind = $("pKind").value, when = today();
    const secs = sections(tpl).filter((x) => pSel && pSel.keys.has(x.key));
    const pages = [];
    for (const x of secs) {
      if (kind === "doc") pages.push(...docPages(x.list, when, x.note, x.title));
      else { const l = x.list.filter((d) => stickerContent(d)); if (l.length) pages.push(...stickerPages(l, x.title, when)); }
    }
    const name = (kind === "doc" ? "dokumentationsbogen" : "qr-code-aufkleber") + "-" + ({ room: "raeume", func: "funktion", alpha: "alphabetisch", sel: "auswahl" }[tpl]) + (secs.length === 1 && tpl !== "sel" ? "-" + secs[0].key.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "") + ".pdf";
    return { pages, name };
  }

  function render() {
    refreshLists();
    const list = filtered(), ft = filterText();
    $("bFilter").textContent = fRooms.size + fTypes.size + fCats.size + ($("fStatus").value ? 1 : 0) ? `Filter (${fRooms.size + fTypes.size + fCats.size + ($("fStatus").value ? 1 : 0)})` : "Filter";
    $("bFilter").classList.toggle("on", !!(fRooms.size || fTypes.size || fCats.size || $("fStatus").value));
    $("bSelect").textContent = selMode ? "Auswahl fertig" : "Auswählen"; $("bSelect").classList.toggle("on", selMode);
    let info = "";
    if (ft) info += `<span>${esc(ft)} – ${list.length} von ${devices.length}</span><button type="button" data-a="clearF">Filter löschen</button>`;
    if (selMode || picked.size) info += `<span><b>${picked.size} ausgewählt</b>${picked.size ? " – Bögen enthalten nur diese Geräte" : ""}</span>` +
      (selMode ? `<button type="button" data-a="all">Alle angezeigten</button>` : "") + (picked.size ? `<button type="button" data-a="none">Auswahl aufheben</button>` : "");
    const nChg = devices.filter((d) => pendingOf(d).length).length, nGone = devices.filter(isGone).length;
    if (nChg) info += `<span><b>${nChg} ${nChg === 1 ? "Gerät" : "Geräte"} in ${esc(cfg.source)} geändert</b> (Name oder Raum)</span><button type="button" data-a="showChg">Anzeigen</button><button type="button" data-a="takeAll">Alle übernehmen</button>`;
    if (nGone) info += `<span><b>${nGone} nicht mehr in ${esc(cfg.source)}</b></span><button type="button" data-a="showGone">Anzeigen</button>`;
    $("fInfo").innerHTML = info; $("fInfo").hidden = !info;
    $("count").textContent = `${devices.length} Geräte · QR-Code-Aufkleber ${devices.filter(hasCode).length}/${devices.length}`;
    $("list").innerHTML = list.length ? list.map((d) => {
      const ok = hasCode(d);
      return `
      <div class="item${picked.has(d.id) ? " sel" : ""}" data-id="${esc(d.id)}">
        ${selMode ? '<div class="cb"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' : ""}<div class="ico ${ok ? "ok" : "miss"}">QR${ok ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ""}</div>
        <div class="main">
          <div class="t">${esc(d.name || d.type || "(ohne Name)")}</div>
          <div class="s">${esc(typeLabel(d.type))}${d.type && d.sgtin ? " · " : ""}${d.sgtin ? "SGTIN …" + esc(last4(d.sgtin)) : ""}${d.fw ? " · FW " + esc(d.fw) : ""}</div>
          <div><span class="pill ${ok ? "ok" : "miss"}">${ok ? "QR-Code-Aufkleber erfasst" : "QR-Code-Aufkleber fehlt"}</span>${d.room ? `<span class="pill room">${esc(d.room)}</span>` : ""}${pendingOf(d).length ? `<span class="pill chg">In ${esc(cfg.source)} geändert</span>` : ""}${isGone(d) ? `<span class="pill gone">Nicht mehr in ${esc(cfg.source)}</span>` : ""}${d.loc ? `<span class="s">${esc(d.loc)}</span>` : ""}</div>
        </div><span class="chev">›</span></div>`;
    }).join("") :
      `<div class="empty">${devices.length ? "Keine Treffer." : "Noch keine Geräte.<br>Öffne das Menü (⋯) und übernimm die Geräte aus " + cfg.source + ", oder tippe auf „Scannen“."}</div>`;
  }

  function draft() {
    return { sgtin: norm($("eSgtin").value), key: keyFromInput($("eKey").value) || norm($("eKey").value), fmt: cur ? cur.fmt : "", raw: cur ? cur.raw : "",
      name: $("eName").value.trim(), type: $("eType").value.trim(), room: $("eRoom").value.trim(), loc: $("eLoc").value.trim() };
  }
  function updateSticker() {
    const d = draft();
    const svg = validSgtin(d.sgtin) ? stickerSvg(d) : "";
    $("eStBox").hidden = !svg;
    $("eSticker").innerHTML = $("eStWrap").hidden ? "" : svg;
    if (!svg) $("eStWrap").hidden = true;
  }

  function openEdit(d, msg) {
    cur = d;
    $("eTitle").textContent = d.isNew ? "Neues Gerät" : "Gerät bearbeiten";
    $("eSgtin").value = d.sgtin; setLast4(d.sgtin);
    $("eKey").value = d.key || ""; $("eKey").type = "password"; $("eKeyShow").textContent = "anzeigen";
    $("eRaw").value = d.raw || ""; $("eRawWrap").hidden = !d.raw;
    $("eName").value = d.name; $("eType").value = d.type; $("eRoom").value = d.room; $("eLoc").value = d.loc; $("eNote").value = d.note; $("eFw").value = d.fw || "";
    $("eStWrap").hidden = true; $("eStToggle").textContent = "Aufkleber anzeigen";
    updateSticker();
    $("eDel").style.display = d.isNew ? "none" : "";
    showMsg(msg);
    $("dEdit").showModal();
  }

  function showMsg(extra) {
    let h = "";
    if (extra) h += `<div class="msg warn">${esc(extra)}</div>`;
    if (cur) {
      const sg = norm($("eSgtin").value), k = norm($("eKey").value), kOk = keyFromInput($("eKey").value);
      const dup = findDup(sg, cur.raw, cur.id);
      const vals = { name: $("eName").value.trim(), room: $("eRoom").value.trim() };
      for (const k of pendingOf(cur, vals)) h += `<div class="msg warn">In ${esc(cfg.source)} lautet der ${SRC_FIELDS[k]} jetzt „${esc(cur["src_" + k])}“ (hier: „${esc(vals[k] || "leer")}“).
        <div class="row2" style="margin-top:6px;background:transparent;position:static"><button type="button" class="ghost" data-take="${k}">Übernehmen</button><button type="button" class="ghost" data-keep="${k}">Beibehalten</button></div></div>`;
      if (isGone(cur)) h += `<div class="msg warn">Dieses Gerät gibt es in ${esc(cfg.source)} nicht mehr. Wenn es endgültig entfernt wurde, kannst du es hier löschen.</div>`;
      if (dup) h += `<div class="msg warn">Achtung: Diese SGTIN ist schon erfasst als „${esc(dup.name || dup.type || "ohne Name")}“ (${esc(dup.room || "ohne Raum")}).</div>`;
      if (sg && !validSgtin(sg)) h += `<div class="msg warn">Eine SGTIN hat 24 Zeichen (0–9, A–F). Hier sind es ${sg.length}.</div>`;
      if (k && !kOk) h += `<div class="msg warn">Der Geräteschlüssel besteht aus 32 Zeichen (0–9, A–F) oder aus 26 Zeichen in der gedruckten Schreibweise (XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX). Hier sind es ${k.length}. Er wird so nicht gespeichert.</div>`;
    }
    $("eMsg").innerHTML = h;
  }

  $("eMsg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-take],button[data-keep]"); if (!b || !cur) return;
    if (b.dataset.take) { const k = b.dataset.take; $(k === "name" ? "eName" : "eRoom").value = cur["src_" + k]; }
    if (b.dataset.keep) cur["ack_" + b.dataset.keep] = cur["src_" + b.dataset.keep];
    showMsg("Mit „Speichern“ übernehmen.");
  });
  /* Alle offenen Änderungen aus der Quelle übernehmen */
  async function takeAll() {
    const list = devices.filter((d) => pendingOf(d).length);
    if (!list.length || !confirm(`Name bzw. Raum von ${list.length} ${list.length === 1 ? "Gerät" : "Geräten"} aus ${cfg.source} übernehmen? Deine bisherigen Werte werden dabei überschrieben.`)) return;
    try {
      for (const d of list) { const n = { ...d }; for (const k of pendingOf(d)) n[k] = d["src_" + k]; n.updated = new Date().toISOString(); await dbSave(n); }
      devices = await dbAll(); render(); toast(`${list.length} übernommen`);
    } catch (e) { alert("Übernehmen fehlgeschlagen: " + errText(e)); }
  }
  ["eSgtin", "eKey", "eName", "eType", "eRoom", "eLoc"].forEach((id) => $(id).addEventListener("input", () => {
    if (id === "eSgtin") setLast4($("eSgtin").value);
    showMsg(); updateSticker();
  }));
  $("eKeyShow").onclick = () => { const k = $("eKey"); const show = k.type === "password"; k.type = show ? "text" : "password"; $("eKeyShow").textContent = show ? "verbergen" : "anzeigen"; };
  $("eStToggle").onclick = () => { const w = $("eStWrap"); w.hidden = !w.hidden; $("eStToggle").textContent = w.hidden ? "Aufkleber anzeigen" : "Aufkleber verbergen"; updateSticker(); };
  const stName = () => `qr-code-aufkleber-${last4($("eSgtin").value) || "geraet"}`;
  const curSvg = () => stickerSvg(draft());
  $("eStSvg").onclick = () => downloadBlob(stName() + ".svg", new Blob([curSvg()], { type: "image/svg+xml" }));
  $("eStPng").onclick = async () => { try { downloadBlob(stName() + ".png", await svgToPng(curSvg())); } catch (e) { alert(errText(e)); } };
  $("eStPrint").onclick = () => outputPdf(docPages([draft()].filter((d) => stickerContent(d)), today()), "dokumentationsbogen.pdf");

  $("fEdit").addEventListener("submit", async (e) => {
    e.preventDefault();
    const k = keyFromInput($("eKey").value);
    if (norm($("eKey").value) && !k) { alert("Der Geräteschlüssel muss aus 32 Zeichen (0–9, A–F) oder aus 26 Zeichen in der gedruckten Schreibweise bestehen."); return; }
    Object.assign(cur, { sgtin: norm($("eSgtin").value), key: k, name: $("eName").value.trim(), type: $("eType").value.trim(),
      room: $("eRoom").value.trim(), loc: $("eLoc").value.trim(), note: $("eNote").value.trim(), fw: $("eFw").value.trim(), updated: new Date().toISOString() });
    if (k && !cur.fmt) cur.fmt = "EQ01";
    const dup = findDup(cur.sgtin, cur.raw, cur.id);
    if (dup && !confirm("Diese SGTIN existiert schon. Trotzdem speichern?")) return;
    try {
      await dbSave(cur);
      devices = await dbAll(); render(); $("dEdit").close(); toast("Gespeichert"); cur = null;
    } catch (err) { alert("Speichern fehlgeschlagen: " + errText(err)); }
  });
  $("eCancel").onclick = () => { $("dEdit").close(); cur = null; };
  $("eDel").onclick = async () => {
    if (!cur || !confirm("Gerät wirklich löschen?")) return;
    try { await dbDel(cur.id); devices = await dbAll(); render(); $("dEdit").close(); cur = null; toast("Gelöscht"); }
    catch (err) { alert("Löschen fehlgeschlagen: " + errText(err)); }
  };
  $("list").addEventListener("click", (e) => {
    const it = e.target.closest(".item"); if (!it) return;
    if (selMode) { const id = it.dataset.id; picked.has(id) ? picked.delete(id) : picked.add(id); render(); return; }
    const d = devices.find((x) => x.id === it.dataset.id); if (d) openEdit({ ...d });
  });
  $("q").addEventListener("input", render); $("fStatus").addEventListener("change", render);
  $("bFilter").onclick = () => { fillFilterDialog(); $("dFilter").showModal(); };
  const chkHandler = (set) => (e) => { const c = e.target.closest("input[data-v]"); if (!c) return; c.checked ? set.add(c.dataset.v) : set.delete(c.dataset.v); render(); };
  $("fRooms").addEventListener("change", chkHandler(fRooms)); $("fTypes").addEventListener("change", chkHandler(fTypes)); $("fCats").addEventListener("change", chkHandler(fCats));
  $("fReset").onclick = () => { fRooms.clear(); fTypes.clear(); fCats.clear(); $("fStatus").value = ""; fillFilterDialog(); render(); };
  $("fDone").onclick = () => $("dFilter").close();
  $("bSelect").onclick = () => { selMode = !selMode; render(); };
  try { if (localStorage.getItem("hmipHelpClosed") === "1") $("help").open = false; } catch (e) { /* kein Speicher */ }
  $("help").addEventListener("toggle", () => { try { localStorage.setItem("hmipHelpClosed", $("help").open ? "0" : "1"); } catch (e) { /* kein Speicher */ } });
  $("fInfo").addEventListener("click", (e) => {
    const a = e.target.closest("button[data-a]"); if (!a) return;
    if (a.dataset.a === "clearF") { fRooms.clear(); fTypes.clear(); fCats.clear(); $("fStatus").value = ""; $("q").value = ""; }
    if (a.dataset.a === "all") filtered().forEach((d) => picked.add(d.id));
    if (a.dataset.a === "none") picked.clear();
    if (a.dataset.a === "showChg") $("fStatus").value = "srcchg";
    if (a.dataset.a === "showGone") $("fStatus").value = "gone";
    if (a.dataset.a === "takeAll") { takeAll(); return; }
    render();
  });

  $("bBurger").onclick = () => host.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
  $("bScan").onclick = startScan;
  $("scanClose").onclick = stopScan;
  $("dScan").addEventListener("cancel", stopScan);
  $("bPhoto").onclick = () => $("filePhoto").click();
  $("bManual").onclick = () => openEdit(newDev());
  $("filePhoto").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try { await fromPhoto(f); } catch (err) { alert("Foto konnte nicht verarbeitet werden: " + errText(err)); }
  });

  /* ---------- Druck ---------- */
  const today = () => new Date().toLocaleDateString("de-DE");
  const touch = () => matchMedia("(pointer:coarse)").matches;
  async function outputPdf(pages, name) {
    if (!pages.length) { toast("Keine Geräte vorhanden"); return; }
    toast("PDF wird erstellt …");
    try {
      const blob = await pagesToPdf(pages), file = new File([blob], name, { type: "application/pdf" });
      if (touch() && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === "AbortError") return; }
      }
      downloadBlob(name, blob);
    } catch (e) { alert("PDF konnte nicht erstellt werden: " + errText(e)); }
  }
  function printPages(pages) {
    const html = sheetHtml(pages), f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { downloadBlob("dokumentationsbogen.html", new Blob([html], { type: "text/html" })); } setTimeout(() => f.remove(), 60000); };
    f.srcdoc = html; document.body.appendChild(f);
  }

  /* ---------- Export / Import ---------- */
  const stamp = () => new Date().toISOString().slice(0, 10);
  const csvCell = (v) => { v = String(v ?? ""); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  function exportCsv() {
    const head = ["Raum", "Einbauort", "Name", "Typ", "Firmware", "SGTIN", "Letzte 4", "QR-Code-Aufkleber", "Notiz", "Erfasst am"];
    const rows = [...devices].sort(byRoom)
      .map((d) => [d.room, d.loc, d.name, d.type, d.fw, d.sgtin, last4(d.sgtin), hasCode(d) ? "ja" : "nein", d.note, (d.created || "").slice(0, 10)].map(csvCell).join(";"));
    downloadBlob(`hmip-geraete-${stamp()}.csv`, new Blob(["﻿" + head.join(";") + "\r\n" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  }
  function exportJson() {
    const out = devices.map((d) => { const o = {}; FIELDS.forEach((k) => (o[k] = d[k] ?? "")); return o; });
    downloadBlob(`hmip-backup-${stamp()}.json`, new Blob([JSON.stringify({ app: "hmip-geraete", version: 2, devices: out }, null, 1)], { type: "application/json" }));
  }
  async function importJson(file) {
    try {
      const j = JSON.parse(await file.text());
      if (j.app !== "hmip-geraete" || !Array.isArray(j.devices)) throw new Error("Keine gültige Backup-Datei");
      let n = 0;
      for (const src of j.devices) {
        if (!src || !/^[A-Za-z0-9_-]{1,40}$/.test(String(src.id || ""))) continue;
        const d = {}; FIELDS.forEach((k) => (d[k] = src[k] ?? ""));
        if (!validKey(d.key) && d.raw) { const p = parseCode(d.raw); if (p.key) { Object.assign(d, { key: p.key, fmt: p.fmt, raw: "" }); if (!d.sgtin) d.sgtin = p.sgtin; } }
        if (!d.sgtin && d.raw) d.sgtin = parseCode(d.raw).sgtin;
        await dbSave(d); n++;
      }
      devices = await dbAll(); render(); toast(`${n} Geräte importiert`);
    } catch (e) { alert("Import fehlgeschlagen: " + errText(e)); }
  }
  $("bMenu").onclick = () => $("dMenu").showModal();
  $("mClose").onclick = () => $("dMenu").close();
  $("mHa").onclick = async () => {
    $("mHa").disabled = true;
    try {
      const r = await ws({ type: "hmip_geraete/import_ha" });
      devices = await dbAll(); render(); $("dMenu").close();
      toast(importText(r));
    } catch (e) { alert("Übernahme fehlgeschlagen: " + errText(e)); }
    $("mHa").disabled = false;
  };
  $("mPrint").onclick = () => { $("dMenu").close(); fillPrint(); $("dPrint").showModal(); };
  $("pTpl").onchange = fillPrint; $("pKind").onchange = fillPrint;
  $("pSecs").addEventListener("change", (e) => { const c = e.target.closest("input[data-k]"); if (!c) return; c.checked ? pSel.keys.add(c.dataset.k) : pSel.keys.delete(c.dataset.k); });
  $("pAll").onclick = () => { pSel.keys = new Set(sections($("pTpl").value).map((x) => x.key)); fillPrint(); };
  $("pNone").onclick = () => { pSel.keys.clear(); fillPrint(); };
  $("pPdf").onclick = () => { const r = printSet(); if (!r.pages.length) { toast("Keine Bögen ausgewählt"); return; } outputPdf(r.pages, r.name); };
  $("pPrint").onclick = () => { const r = printSet(); if (!r.pages.length) { toast("Keine Bögen ausgewählt"); return; } printPages(r.pages); };
  $("pClose").onclick = () => $("dPrint").close();
  $("mHelp").onclick = () => { $("dMenu").close(); $("dHelp").showModal(); };
  $("hClose").onclick = () => $("dHelp").close();
  root.querySelectorAll(".vno").forEach((e) => (e.textContent = cfg.version || "unbekannt"));
  /* Passwort ändern und Abmelden gibt es nur, wenn die Umgebung es anbietet (HCU-Plugin) */
  if (cfg.changePassword) {
    $("mPw").hidden = false; $("mLogout").hidden = false;
    $("mPw").onclick = () => { $("dMenu").close(); $("pwOld").value = $("pwNew").value = $("pwNew2").value = ""; $("pwMsg").innerHTML = ""; $("dPw").showModal(); };
    $("pwCancel").onclick = () => $("dPw").close();
    $("fPw").addEventListener("submit", async (e) => {
      e.preventDefault();
      if ($("pwNew").value !== $("pwNew2").value) { $("pwMsg").innerHTML = '<div class="msg warn">Die neuen Passwörter stimmen nicht überein.</div>'; return; }
      try { await cfg.changePassword($("pwOld").value, $("pwNew").value); $("dPw").close(); toast("Passwort geändert"); }
      catch (err) { $("pwMsg").innerHTML = `<div class="msg warn">${esc(errText(err))}</div>`; }
    });
    $("mLogout").onclick = () => { $("dMenu").close(); if (cfg.logout) cfg.logout(); };
  }
  $("mCsv").onclick = () => { exportCsv(); $("dMenu").close(); };
  $("mJson").onclick = () => { exportJson(); $("dMenu").close(); };
  $("mImport").onclick = () => $("fileImport").click();
  $("fileImport").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) { importJson(f); $("dMenu").close(); } });

  function importText(r) {
    const p = [`${r.added} neu`, `${r.updated} aktualisiert`];
    if (r.changes) p.push(`${r.changes} geändert`);
    if (r.removed) p.push(`${r.removed} nicht mehr vorhanden`);
    return `Aus ${cfg.source}: ${p.join(", ")}`;
  }
  /* ---------- Start: Liste laden, dann still mit der Quelle abgleichen ---------- */
  dbAll().then((l) => { devices = l; render(); }).catch((e) => { render(); alert("Daten konnten nicht geladen werden: " + errText(e)); })
    .then(async () => {
      try {
        const r = await ws({ type: "hmip_geraete/import_ha" });
        devices = await dbAll(); render();
        if (r.added || r.removed) toast(importText(r));
      } catch (e) { /* Abgleich beim Öffnen ist optional */ }
    });
  render();
}

class HmipGeraetePanel extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); this._ready = false; this._narrow = false; }
  set hass(h) {
    this._hass = h;
    if (!this._ready) { this._ready = true; const c = this.cfg || DEFAULT_CFG; this.shadowRoot.innerHTML = TEMPLATE.replaceAll("{{SRC}}", c.source).replaceAll("{{STORAGE_NOTE}}", c.storageNote).replaceAll("{{HELP_EXTRA}}", c.helpExtra || ""); this._applyNarrow(); init(this); }
  }
  get hass() { return this._hass; }
  set narrow(v) { this._narrow = !!v; this._applyNarrow(); }
  get narrow() { return this._narrow; }
  _applyNarrow() { const b = this.shadowRoot.getElementById("bBurger"); if (b) b.style.display = this._narrow ? "" : "none"; }
  disconnectedCallback() { if (this._stopScan) this._stopScan(); }
}
if (!customElements.get("hmip-geraete-panel")) customElements.define("hmip-geraete-panel", HmipGeraetePanel);
