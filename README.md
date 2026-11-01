# HmIP Geräteverwaltung – Plugin für die Home Control Unit

Plugin für die Homematic IP **Home Control Unit (HCU)** über die eQ-3 Connect API. Es bietet dieselbe Oberfläche wie die Home-Assistant-Integration [hmip-geraete-ha](https://github.com/OllO18/hmip-geraete-ha):

- **QR-Code-Aufkleber scannen** – live mit der Kamera oder per Foto. Erkannt werden SGTIN und Geräteschlüssel.
- **Geräte aus der HCU übernehmen** – Name, Typ, Firmware und Raum (wie in der Homematic-IP-App).
- **QR-Code-Aufkleber neu erzeugen** sowie den **Dokumentationsbogen** (Nachbau des Homematic-IP-Vordrucks) als PDF oder zum Drucken.
- **CSV-Export** (ohne Schlüssel) und **JSON-Backup** (mit Schlüssel).

## Installation

1. Entwicklermodus der HCU in HCUweb aktivieren (nötig für eigene Plugins).
2. Paket `hmip-geraeteverwaltung-<version>.tar.gz` aus den GitHub Actions („Plugin bauen“ → Artefakt) bzw. aus den Releases herunterladen und in HCUweb unter **Plugins** hochladen.
3. In HCUweb beim Plugin auf das Zahnrad tippen: Dort stehen Link und QR-Code zur Weboberfläche. Alternativ im Browser `https://hcu1-XXXX.local:8443` öffnen (XXXX = letzte vier Stellen der SGTIN der HCU). Die Zertifikatswarnung einmal bestätigen.
4. Beim ersten Aufruf ein Passwort (mindestens 8 Zeichen) festlegen.

## Warum HTTPS mit eigenem Zertifikat?

Browser geben die Kamera nur auf HTTPS-Seiten frei. Das Plugin erzeugt beim ersten Start ein selbstsigniertes Zertifikat (in `/data`). Klappt der Live-Scan trotzdem nicht, funktioniert **Foto** immer: Der QR-Code wird dann mit der mitgelieferten Bibliothek jsQR im Browser ausgelesen.

## Daten und Sicherheit

- Die Geräteliste liegt in `/data/devices.json` (bleibt bei Updates erhalten) und enthält die Geräteschlüssel.
- Zugriff nur mit Passwort (scrypt-Hash in `/data/auth.json`); nach 5 Fehlversuchen wird kurz gesperrt.
- Port: 8443 (änderbar über die Umgebungsvariable `WEB_PORT` im Dockerfile).

## Entwicklung

```
npm ci
npm test
DATA_DIR=./data WEB_PORT=18443 node plugin.js de.ollo18.hmip.geraeteverwaltung hcu1-XXXX.local token.txt
```

Ohne laufende HCU startet die Oberfläche trotzdem; nur die Übernahme aus der HCU meldet dann „Keine Verbindung zur HCU“.

## Lizenzen

- Plugin: MIT
- qrcode-generator (Kazuhiko Arase): MIT, `www/qrcode.mjs`
- jsQR (Cosmo Wolfe): Apache-2.0, `www/jsqr.mjs`, Lizenz in `www/LICENSE-jsQR.txt`
- Schrift Mulish: SIL Open Font License, `www/fonts/OFL-Mulish.txt`

Kein offizielles Produkt der eQ-3 AG. Nutzung nicht zertifizierter Plugins auf eigenes Risiko.
