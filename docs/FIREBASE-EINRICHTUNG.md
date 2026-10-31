# Firebase einrichten (einmalig, ca. 10 Minuten)

Ziel: Der Live-Sync zwischen Kevin und Isabelle läuft über ein kostenloses Firebase-Projekt.
Es gibt keinen Login. Der gemeinsame Bereich wird durch einen langen, zufälligen Code im Einladungslink geschützt.

1. **Projekt anlegen:** <https://console.firebase.google.com> → „Projekt hinzufügen“ → Name z. B. `notiz-app`.
   Google Analytics kann aus bleiben.
2. **Datenbank:** Build → **Firestore Database** → „Datenbank erstellen“ → Standort in Europa
   (z. B. `eur3` oder `europe-west3`) → **Produktionsmodus**. Die Sicherheitsregeln aus `firestore.rules`
   lade ich später hoch.
3. **Web-App:** Projekteinstellungen (Zahnrad) → Allgemein → ganz unten „Deine Apps“ → `</>` (Web) →
   Name `Notizen` → Registrieren. Es erscheint ein Block `firebaseConfig = { apiKey: …, projectId: … }`.
   **Diesen Block an Claude schicken** (der apiKey ist bei Firebase-Web-Apps nicht geheim).
4. **Hosting:** Build → **Hosting** → „Los geht’s“ (nur aktivieren, den Rest macht Claude).

Danach legt Claude die Datei `public/firebase-config.json` an, lädt die Regeln hoch und veröffentlicht die App.
Alles bleibt im kostenlosen Tarif (Spark): Firestore reicht für zwei Personen weit aus.

## So läuft es dann
- Kevin öffnet die App, tippt oben links auf das Personen-Symbol, gibt seinen Namen ein und legt den Bereich an.
- Er schickt Isabelle den **Einladungslink**. Sie öffnet ihn, gibt ihren Namen ein, tippt auf „Beitreten“.
- Ab dann sehen beide Änderungen sofort, und man sieht, wer gerade in welchem Block schreibt.
- Wer den Link kennt, hat Zugriff. Den Link also nicht weitergeben.

## Veröffentlichen ohne Computer (Netlify)
Das Projekt ist auf GitHub privat, deshalb nutzen wir Netlify (kostenlos, im Handy-Browser bedienbar):
1. <https://app.netlify.com> → mit **GitHub** anmelden.
2. „Add new site“ → „Import an existing project“ → **GitHub** → Zugriff auf das Projekt `Notiz-App` erlauben.
3. **Branch to deploy:** `ccr-29b1054a-cmhsxu`. Die Build-Einstellungen liest Netlify aus `netlify.toml`. → „Deploy“.
4. Optional: Site settings → „Change site name“ für eine schöne Adresse (z. B. `kevin-notizen.netlify.app`).

Danach veröffentlicht Netlify jede Änderung, die Claude auf diesen Branch schiebt, automatisch.

## Alternative: GitHub Pages (Projekt öffentlich)
1. GitHub → Projekt → **Settings → General → Danger Zone → Change visibility → Public**.
2. Warten, bis unter **Actions** der Lauf „App veröffentlichen“ grün ist (legt den Zweig `gh-pages` an).
3. **Settings → Pages → Source: „Deploy from a branch“ → Branch `gh-pages`, Ordner `/ (root)` → Save.**
4. Die Adresse lautet dann `https://<github-name>.github.io/Notiz-App/`.
