# Notiz-App

Notiz- und Rezepte-App als installierbare Web-App (PWA, Flutter). Läuft auf Android und iPhone identisch, ohne App-Store.
Konzept, Entscheidungen und Bauplan: [docs/KONZEPT.md](docs/KONZEPT.md)

## Stand

- [x] Datenmodell mit Blöcken (Text, Überschrift, Checkliste, Tabelle, Schritte, Bild)
- [x] Markdown-Format für Drive-Dateien (Lesen und Schreiben, getestet)
- [x] Web-Build mit Manifest (Vollbild ohne Browser-Leiste) und Service Worker (offline)
- [x] Notizliste mit Suche, Editor, Rezept-Vorlage, lokale Speicherung
- [ ] Firebase-Login und Live-Sync
- [ ] Google-Drive-Backup und Import von außen
- [ ] Bilder einfügen

## Entwickeln

```bash
flutter pub get
flutter test
flutter run -d chrome
flutter build web --release --no-web-resources-cdn   # Ausgabe: build/web
```
