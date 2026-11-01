# HmIP Geräteverwaltung – Plugin für die Homematic IP Home Control Unit (ARM64)
FROM --platform=linux/arm64 node:22-alpine

WORKDIR /app
# Abhängigkeiten sind reines JavaScript und werden vor dem Bau mit "npm ci --omit=dev" installiert
COPY package.json package-lock.json plugin.js ./
COPY node_modules ./node_modules
COPY lib ./lib
COPY www ./www

ENV NODE_ENV=production WEB_PORT=8443
EXPOSE 8443

ENTRYPOINT ["node", "plugin.js", "de.ollo18.hmip.geraeteverwaltung", "host.containers.internal", "/TOKEN"]

LABEL de.eq3.hmip.plugin.metadata=\
'{\
	"pluginId": "de.ollo18.hmip.geraeteverwaltung",\
	"issuer": "OllO18",\
	"version": "0.4.1",\
	"hcuMinVersion": "1.4.7",\
	"scope": "LOCAL",\
	"friendlyName": {\
		"de": "HmIP Geräteverwaltung",\
		"en": "HmIP device inventory"\
	},\
	"description": {\
		"de": "QR-Code-Aufkleber der Geräte scannen und verwalten, Aufkleber und Dokumentationsbogen drucken. Weboberfläche: https://hcu1-XXXX.local:8443",\
		"en": "Scan and manage the devices QR code stickers, print stickers and documentation sheets. Web UI: https://hcu1-XXXX.local:8443"\
	},\
	"changelog": "0.4.1: Konfigurationsseite wie beim WRC6-Plugin (Link, Adresse, QR-Code), Adresse mit IP der HCU. 0.4.0: Link und QR-Code zur Weboberfläche auf der Konfigurationsseite in HCUweb. 0.3.2: Hinweis auf übersprungene Geräte entfernt. 0.3.1: QR-Code ohne Key im Format EQ01SG+SGTIN (von der App erkannt). 0.3.0: Aufkleber auch ohne Key (nur SGTIN, nur Online-Anlernen). 0.2.0: Filter nach mehreren Räumen und Typen, Handauswahl, Auswahl auf dem Bogen. 0.1.0: Erste Version",\
	"logsEnabled": true\
}'
