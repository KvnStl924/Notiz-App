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
Siehe README. Offen für Version 1: Firebase-Login und Live-Sync, Veröffentlichung auf Firebase
Hosting, Test auf echten Handys; danach Drive-Anbindung, Bilder, Formatierung.
