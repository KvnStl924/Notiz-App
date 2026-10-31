# Notiz-App

Notiz- und Rezepte-App als installierbare Web-App (PWA) im iOS-Stil mit Liquid-Glass-Optik.
Läuft auf Android und iPhone ohne App-Store, ohne Browser-Leiste.
Konzept, Entscheidungen und Bauplan: [docs/KONZEPT.md](docs/KONZEPT.md)

| Dunkel | Hell |
|---|---|
| ![Liste dunkel](docs/screens/liste-dunkel.png) | ![Liste hell](docs/screens/liste-hell.png) |
| ![Rezept dunkel](docs/screens/rezept-dunkel.png) | ![Rezept hell](docs/screens/rezept-hell.png) |

## Stand

- [x] Datenmodell mit Blöcken (Text, Überschrift, Checkliste, Tabelle, Schritte, Bild)
- [x] Markdown-Format für Drive-Dateien (Lesen und Schreiben, getestet)
- [x] iOS-Oberfläche: große Titel, Glas-Karten, schwebende Tab-Leiste, Kontextmenü, Wisch-zum-Löschen, Wisch-zurück, Hell/Dunkel
- [x] Rezepte und Notizen, Suche, Editor mit Tabellen, Checklisten und Schritt-für-Schritt
- [x] Installierbar (Manifest, Vollbild) und offline nutzbar (Service Worker)
- [ ] Firebase-Login und Live-Sync
- [ ] Google-Drive-Backup und Import von außen
- [ ] Bilder einfügen

## Entwickeln

```bash
npm install
npm run dev      # Entwicklungsserver, auch im WLAN erreichbar
npm test         # Tests (Markdown-Format)
npm run build    # Ausgabe: dist/
```
