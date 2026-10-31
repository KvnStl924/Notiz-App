# Notiz-App – Konzept

Eine Notiz-App, primär als **Rezepte-App** für Kevin (Android) und Isabelle (iPhone).
Es gibt **eine** installierbare Web-App (PWA). Beide nutzen dieselbe App, sie sieht überall identisch aus.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Technologie | **Native Web-Technik (TypeScript, Preact, Vite) als installierbare App (PWA)**. Kein App-Store, kein Apple-Developer-Account nötig. Von Flutter umgestellt, weil nur echtes HTML/CSS die echte iPhone-Schrift (SF), das iOS-Scrollen, die Tastatur und Glas-Unschärfe nutzt |
| Optik | iOS-26/27-Stil: Liquid-Glass-Karten, schwebende Tab-Leiste, große Titel, Push-Animation mit Wisch-zurück, Hell/Dunkel folgt dem Gerät. iPhone nutzt die echte SF-Schrift, Android die ähnliche Schrift Inter |
| Installation | Android: Chrome → „App installieren“. iPhone: Safari → Teilen → „Zum Home-Bildschirm“. Beide öffnen im Vollbild ohne Browser-Leiste |
| Hosting | Firebase Hosting (kostenlos, HTTPS) |
| Offline | eigener Service Worker (Netz zuerst, sonst zuletzt geladene Version) |
| Live-Sync | **Firebase Firestore** (Echtzeit, Offline-Cache, Live-Anzeige des Partners) |
| Ablage / Backup | **Google Drive**: jede Notiz wird als lesbare **Markdown-Datei** in einen gemeinsamen Drive-Ordner geschrieben |
| KI | **Keine KI in der App.** Claude bearbeitet Notizen von außen über die Markdown-Dateien in Google Drive |
| Anmeldung | Google-Login (derselbe Account wie für Drive) |

## Funktionen (Version 1)

- Notizen anlegen, bearbeiten, löschen, durchsuchen
- Notiz = Liste von **Blöcken**:
  - Text (Überschriften, fett/kursiv, Listen)
  - **Checkliste** (abhakbar)
  - **Tabelle** (nativ, z. B. Zutatenliste mit Spalten Menge / Einheit / Zutat)
  - **Bild**
  - **Rezept-Vorlage**: Titel, Portionen, Zutaten-Tabelle, Schritt-für-Schritt-Anleitung
- **Live-Bearbeitung**: Änderungen des Partners erscheinen sofort, mit Anzeige, wer gerade welchen Block bearbeitet
- Offline nutzbar, Abgleich sobald wieder Internet da ist

## Wie Claude Notizen bearbeitet

Weil die App keine KI enthält, läuft das so:

1. Die App sichert jede Notiz als `<Titel>.md` in den Drive-Ordner `Notiz-App`.
2. Du schickst mir im Chat einen Rezept-Link. Ich lege die Datei im Drive-Ordner an (Zutaten als Markdown-Tabelle, Schritte als nummerierte Liste).
3. Die App erkennt neue oder geänderte Dateien im Drive-Ordner und übernimmt sie als Notiz.

Deshalb muss das Markdown-Format fest definiert sein (siehe unten).

### Markdown-Format einer Notiz

```markdown
---
id: 7c1f...            # wird von der App vergeben, bei neuen Dateien weglassen
typ: rezept
portionen: 4
---
# Spaghetti Carbonara

## Zutaten
| Menge | Einheit | Zutat |
|---|---|---|
| 400 | g | Spaghetti |
| 150 | g | Guanciale |

## Zubereitung
1. Wasser salzen und Spaghetti kochen.
2. Guanciale knusprig braten.

## Einkaufsliste
- [ ] Eier
- [x] Pecorino
```

## Architektur

```
src/
  model.ts       Note und Block-Typen (Text, Überschrift, Checkliste, Tabelle, Schritte, Bild)
  markdown.ts    Notiz <-> Markdown (Parser und Writer, getestet)
  store.ts       lokaler Speicher; später Firestore-Abgleich und Drive-Sync
  app.tsx        Navigation, Push-Animation, Wisch-zurück
  screens.tsx    Liste und Editor mit allen Blöcken
  ui.tsx         Textfeld, Kontextmenü, Aktionsblatt, Wisch-Zeile
  styles.css     Design-System (Farben, Glas, Typografie)
public/          Manifest, Service Worker (offline), App-Icons
```

- **Local-first**: Die App liest und schreibt zuerst lokal, Firestore gleicht im Hintergrund ab.
- **Live-Merge**: Änderungen werden pro Block gespeichert. Zwei Personen in verschiedenen Blöcken überschreiben sich nie. Im selben Block gewinnt die zuletzt gespeicherte Änderung.
- **Drive-Sync**: Ein Hintergrund-Job schreibt geänderte Notizen als Markdown nach Drive und prüft alle paar Minuten auf Änderungen von außen.

## Was du einrichten musst (kann ich nicht für dich tun)

1. **Firebase-Projekt** anlegen (kostenlos), Firestore und Google-Login aktivieren. Dazu brauche ich später die Firebase-**Web-App-Konfiguration** (ein kurzer Block mit `apiKey`, `projectId` usw. aus den Projekteinstellungen unter „Web-App hinzufügen“).
2. **Google-Cloud-Projekt** (dasselbe wie Firebase): Google Drive API aktivieren.
3. **Installation**: Kein Developer-Account nötig. Die Web-Adresse wird einmal im Browser geöffnet und dann als App zum Startbildschirm hinzugefügt.

Grenzen einer PWA auf dem iPhone: Push-Benachrichtigungen gibt es erst nach der Installation (ab iOS 16.4); nach längerer Nichtnutzung kann iOS lokal zwischengespeicherte Daten entfernen. Deshalb liegen die Notizen immer zusätzlich in Firestore und Drive.

## Bauplan

1. Projekt-Gerüst, Datenmodell, Markdown-Parser mit Tests (fertig)
2. Notizliste und Editor im iOS-Stil mit allen Block-Typen, lokal (fertig; Bilder fehlen noch)
3. Firebase-Login und Live-Sync
4. Drive-Backup und Import von außen
5. Veröffentlichung auf Firebase Hosting, App-Icon

## Grenzen beim iOS-Look im Browser

- **Lichtbrechung des Glases** (verzerrte Ränder) gibt es im Browser nur in Chromium, nicht in Safari. Umgesetzt sind Unschärfe, Farbsättigung, Lichtkante und Schatten.
- **SF Symbols** dürfen nicht im Web verwendet werden. Die Icons sind Lucide (frei lizenziert, ähnlicher Strich).
- Apple-Logos und -Marken werden nicht kopiert.
- Für iOS 27 gibt es noch keine Apple-Unterlagen im Repository. Der Stil folgt dem, was von Liquid Glass bekannt ist, und dem Beispiel-Screenshot.
