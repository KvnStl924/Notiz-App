# Notiz-App – Arbeitsanweisungen für Claude

## Projekt
Notiz- und Rezepte-App für Kevin (Android/Samsung) und Isabelle (iPhone) als installierbare Web-App (PWA).
Technik: TypeScript, Preact, Vite. Konzept, Entscheidungen und Bauplan: `docs/KONZEPT.md`.

## Absprache mit Kevin (Auftraggeber)
- **Erlaubnis:** Kevin hat ausdrücklich erlaubt, alles zu tun, was zum Bauen der App nötig ist
  (Code ändern, bauen, testen, committen, pushen, Vorschau veröffentlichen). Dafür **nicht um
  Erlaubnis fragen**, sondern machen.
- **Nachfragen nur bei Unklarheit:** Wenn eine Anforderung unklar ist oder eine Entscheidung
  wirklich von Kevin abhängt, kurz und gezielt nachfragen.
- **Sprache:** Deutsch, kurz und klar, ohne Fachchinesisch.
- **Tempo:** Lieber schnell ein Ergebnis liefern als viele Tests. Nur das Wichtige prüfen.
- **Ehrlich berichten:** Sagen, was getestet wurde und was nicht (z. B. nur im Testbrowser,
  nicht auf echten Handys).
- Entwickelt wird auf dem Branch `ccr-29b1054a-cmhsxu`. Keine Pull Requests ohne Aufforderung.

## Vorschau veröffentlichen
Die Vorschau ist ein Artifact (Slug `b6d25283-c334-4dac-9d3c-1181168f3de2`), derzeit öffentlich geteilt.
Ablauf: `VITE_DEMO=1 npx vite build --outDir /tmp/demo-dist`, alles in eine HTML-Datei einbetten
(CSS, JS, Schrift als data:-URI), nach `dist/preview.html` kopieren und mit `publish_files`
(`shared_live: "public"`, aktuellem `base_version` und `artifact_title`) veröffentlichen.

## Stand und nächste Schritte
- Live-App: https://kvnstl924.github.io/Notiz-App/ (GitHub Pages, wird bei jedem Push auf den Branch
  automatisch gebaut, getestet und veröffentlicht: `.github/workflows/veroeffentlichen.yml`).
- Firebase-Projekt `notiz-app-98dd6` (Firestore, Regeln in `firestore.rules`), kein Login; Zugriff über den
  Bereichs-Code im Einladungslink.
- Rezept-Eingang: Google-Tabelle „Notiz-App Rezept-Eingang“ in Kevins Drive (Spalten Zeit, Titel, Rezept); Claude hängt Zeilen an,
  die App liest sie über `docs.google.com/.../gviz/tq?tqx=out:csv` (Tabelle muss „Jeder mit dem Link: Betrachter“ sein) und legt neue Rezepte an
  (`src/inbox.ts`). Die Tabellen-ID gehört nicht in dieses öffentliche Projekt.
- Rezept-Import aus anderen Chats: `docs/REZEPT-IMPORT.md` (Anleitung) und `tools/rezept-senden.py`.
  Die Anleitung enthält das Programm als Kopie; `src/import-guide.test.ts` prüft, dass beides übereinstimmt.
- Offen: Drive-Anbindung, Bilder, Formatierung; Test auf echten Handys.
