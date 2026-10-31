# Notiz-App – Konzept

Eine Notiz-App, primär als **Rezepte-App** für Kevin (Android) und Isabelle (iPhone).
Beide Apps sehen identisch aus und verhalten sich identisch.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Technologie | **Flutter** (eine Codebasis, native App für Android und iOS, identische Oberfläche) |
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
lib/
  main.dart
  models/        Note, Block-Typen (Text, Checkliste, Tabelle, Bild, Rezept)
  data/          lokale Datenbank, Firestore-Repository, Drive-Sync
  markdown/      Notiz <-> Markdown (Parser und Writer)
  ui/            Notizliste, Editor, Block-Widgets
```

- **Local-first**: Die App liest und schreibt zuerst lokal, Firestore gleicht im Hintergrund ab.
- **Live-Merge**: Änderungen werden pro Block gespeichert. Zwei Personen in verschiedenen Blöcken überschreiben sich nie. Im selben Block gewinnt die zuletzt gespeicherte Änderung.
- **Drive-Sync**: Ein Hintergrund-Job schreibt geänderte Notizen als Markdown nach Drive und prüft alle paar Minuten auf Änderungen von außen.

## Was du einrichten musst (kann ich nicht für dich tun)

1. **Firebase-Projekt** anlegen (kostenlos), Firestore und Google-Login aktivieren. Dazu brauche ich später die Dateien `google-services.json` (Android) und `GoogleService-Info.plist` (iOS).
2. **Google-Cloud-Projekt** (dasselbe wie Firebase): Google Drive API aktivieren.
3. **iPhone von Isabelle**: Für die Installation einer eigenen App auf dem iPhone braucht es einen Apple-Developer-Account (99 USD/Jahr) und einen Mac mit Xcode oder einen Cloud-Build-Dienst (z. B. Codemagic). Ohne Apple-Account lässt sich die App nur 7 Tage lang testweise installieren.
4. Android: Die APK kann ich dir bauen, du installierst sie direkt.

## Bauplan

1. Projekt-Gerüst, Datenmodell, Markdown-Parser mit Tests
2. Notizliste und Editor mit allen Block-Typen (lokal)
3. Firebase-Login und Live-Sync
4. Drive-Backup und Import von außen
5. Android-Build, iOS-Build einrichten
