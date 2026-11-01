# AGENTS.md – Übergabe an Codex (und andere Coding-Agenten)

Dieses Dokument erklärt, was die Notiz-App ist, wie sie gebaut ist, was fertig und was offen ist und
welche Fallen es gibt. Gelesen wird zuerst „Erste Schritte“ und „Zusammenarbeit mit Kevin“.
Ergänzend: `README.md`, `docs/KONZEPT.md` (Entscheidungen), `docs/REZEPT-IMPORT.md` (Import-Anleitung für Chats),
`docs/FIREBASE-EINRICHTUNG.md`. `CLAUDE.md` enthält dieselben Absprachen für Claude.

> Stand dieser Übergabe: 2026-11-01. Bis hierher hat Claude (Anthropic) das Projekt gebaut.
> Alles, was hier als „getestet“ steht, wurde nur im Testbrowser (Chromium, Handy-Größe) und mit dem
> Firestore-Emulator geprüft, **nicht auf einem echten Samsung oder iPhone**.

---

## 1. Worum es geht

- **Auftraggeber:** Kevin (Android, Samsung). Zweite Nutzerin: Isabelle (iPhone). Sie nutzen die App privat zu zweit.
- **Zweck:** Notizen und vor allem **Rezepte**: Zutaten-Tabelle, Schritt-für-Schritt-Anleitung, Einkaufsliste daraus.
  Beide sehen Änderungen **live**; man sieht, wer gerade in welchem Block schreibt.
- **Plattform:** installierbare **Web-App (PWA)**, kein App-Store. Android: Chrome → „App installieren“.
  iPhone: Safari → Teilen → „Zum Home-Bildschirm“. Gründe: kein Apple-Developer-Account (99 USD/Jahr) nötig.
- **Optik:** Soll aussehen und sich anfühlen wie eine native Apple-App im iOS-26/27-Stil (Liquid Glass): große Titel,
  Glas-Karten, schwebende Tab-Leiste, iOS-Animationen, Wisch-zurück, Hell/Dunkel nach Gerät. Auf beiden Handys
  **gleich** (auf Android mit der Schrift Inter statt SF).
- **Keine KI in der App.** Claude arbeitet „von außen“ (siehe Rezept-Eingang, Abschnitt 8).
- **Kosten:** alles muss **kostenlos** bleiben (Firebase Spark-Tarif, GitHub Pages, keine Blaze-Funktionen).

## 2. Erste Schritte (in dieser Reihenfolge)

```bash
git clone https://github.com/KvnStl924/Notiz-App.git && cd Notiz-App
git checkout ccr-29b1054a-cmhsxu       # Entwicklungszweig (siehe Abschnitt 10)
npm ci
npx tsc --noEmit                        # Typen prüfen
npm test                                # 39 Tests (+7 übersprungene Emulator-Tests)
npm run dev                             # Entwicklungsserver, auch im WLAN (--host)
npm run build                           # tsc + vite build -> dist/
```

Voraussetzungen: Node 22, npm. Für die Emulator-Tests zusätzlich Java 11+:

```bash
npx firebase-tools emulators:start --only firestore --project demo-notiz   # Port 8180 (firebase.json)
NOTIZ_EMULATOR=127.0.0.1:8180 npm test                                     # führt auch die 7 Firestore-Tests aus
```

**Vor jeder Änderung:** `npx tsc --noEmit && npm test` muss grün sein. CI (`.github/workflows/veroeffentlichen.yml`)
führt `npm ci`, `npm test`, `npm run build` aus und veröffentlicht nur bei Erfolg.

**Zuerst prüfen (Abschnitt 11):** Ob die Live-Seite https://kvnstl924.github.io/Notiz-App/ auf dem neuesten Stand ist und
die letzten Läufe unter Actions grün sind.

## 3. Zusammenarbeit mit Kevin (wichtig, hat mehrfach Ärger gegeben)

- **Sprache:** Deutsch, kurz, einfach, **ohne Fachchinesisch**. Kevin ist kein Entwickler.
- **Er arbeitet fast nur am Handy** (Samsung, Chrome), oft **ohne Computer**. Anleitungen für ihn müssen mit dem
  Handy machbar sein: **ein Schritt nach dem anderen**, kein Terminal, keine CLI-Befehle von ihm verlangen.
  Er schickt gern Screenshots; das ist der beste Weg, ihn zu unterstützen.
- **Nicht um Erlaubnis fragen** für Dinge, die zum Bauen der App gehören. Nachfragen nur bei echter Unklarheit
  oder wenn eine Entscheidung wirklich bei ihm liegt (z. B. Kosten, Sichtbarkeit von Daten).
- **Tempo:** Lieber schnell ein Ergebnis liefern als viele Tests. Nur das Wichtige prüfen. Er hat das ausdrücklich verlangt.
- **Ehrlich berichten:** Immer sagen, was getestet wurde und was nicht (z. B. „nur im Testbrowser, nicht auf echten Handys“).
  Frühere Fehler kamen daher, dass Dinge zu spät angesprochen wurden (z. B. die Apple-Kosten, Pages nur für öffentliche Projekte).
  Bei Entscheidungen mit Folgen **vorher** die Folgen nennen.
- **Keine Pull Requests** ohne Aufforderung. Commits mit sprechender deutscher Beschreibung.
- Er ist optisch anspruchsvoll („wie von Apple gebaut“). Kleine Abweichungen vom iOS-Look sind für ihn echte Fehler.
- Kevins Wünsche, die schon umgesetzt sind, nicht ungefragt ändern (z. B. erledigte Einkaufs-Zeilen werden **ausgegraut,
  nicht durchgestrichen** und wandern **nicht nach unten**; Rezepte öffnen im **Lesemodus**).

## 4. Technik-Überblick

- **TypeScript (strict), Preact 10, Vite.** Kein Router, keine UI-Bibliothek. Icons: `lucide-preact` (SF Symbols sind im Web
  nicht erlaubt). Schrift: `@fontsource-variable/inter`; auf iOS greift `-apple-system` (echte SF).
- **Firebase JS SDK** (nur Firestore, kein Auth, kein Hosting). Wird erst bei Bedarf per `import()` geladen
  (eigener Chunk `firestore-backend-*.js`).
- **Tests:** Vitest (Node-Umgebung, keine DOM-Tests). Browser-Tests wurden bisher **manuell mit Playwright-Skripten**
  gemacht, die nicht im Repo liegen (siehe Abschnitt 12 – das ist eine Lücke).
- **Hosting:** GitHub Pages (Zweig `gh-pages`), URL mit Unterordner `/Notiz-App/` → **alle Pfade müssen relativ sein**
  (`vite.config.ts: base: './'`, `fetch('./…')`, `register('./sw.js')`, Manifest `start_url: "./"`).
- **Daten:** lokal in `localStorage` (local-first), Abgleich über Firestore.

### Dateien

| Datei | Inhalt |
|---|---|
| `src/model.ts` | Typen `Note`, `Block` (heading, text, checklist, table, steps, image), `ShopItem`; Fabriken `mk.*`, `newRecipe()` |
| `src/markdown.ts` | Notiz ⇄ Markdown (`parseMarkdown`, `writeMarkdown`). Format siehe `docs/KONZEPT.md` und `docs/REZEPT-IMPORT.md` |
| `src/store.ts` | `Collection`-Basisklasse, `NoteStore`, `ShopStore` (jeweils mit `hooks` für den Sync), Hooks `useNotes`, `useNote`, `useShopping` |
| `src/shopping.ts` | `ingredientsOf(note)` (Zutaten aus der Tabelle), `mergeRecipe(...)` (ohne Doppelte) |
| `src/import.ts` | `importMarkdown(text, fallbackType)` → neue Notiz (immer neue ID) |
| `src/inbox.ts` | Rezept-Eingang (Google-Tabelle), CSV-Parser, deterministische IDs, Polling |
| `src/update.ts` | „Neue Version verfügbar“-Hinweis (vergleicht laufende und online liegende Bundle-Datei) |
| `src/app.tsx` | Tab-Leiste, Push-Animation (`translate3d`, Parallax 0.3), Wisch-zurück vom Rand, Verlauf über `#note-<id>` |
| `src/screens.tsx` | `ListScreen`, `EditorScreen` (Lese-/Bearbeiten-Modus), Blockeditoren `ChecklistView`, `StepsView`, `TableView` |
| `src/shop-screen.tsx` | Einkaufsliste (Pillen „Zuhause“/„Gekauft“, Gruppen je Rezept, Wisch-Löschen) |
| `src/ui.tsx` | `AutoText` (wachsende Textarea), `ReadOnlyCtx`, `Menu`, `Sheet`, `SwipeRow`, `Toast`, `useScrolled` |
| `src/sync-ui.tsx`, `src/import-ui.tsx`, `src/inbox-ui.tsx` | Fenster für Sync-Einrichtung, „Aus Text einfügen“, Rezept-Eingang |
| `src/sync/backend.ts` | Schnittstelle `Backend` (`listen`, `commit`) |
| `src/sync/engine.ts` | `SyncEngine`: der eigentliche Live-Abgleich (Abschnitt 6) |
| `src/sync/firestore-backend.ts` | Firestore-Umsetzung (mit Offline-Cache im Browser) |
| `src/sync/memory-backend.ts` | Speicher-Server für Tests |
| `src/sync/manager.ts` | `SyncManager`: Konfiguration, Bereich anlegen/beitreten/verlassen, Name, Einladungslink; `parseFirebaseConfig`, `parseSpaceCode` |
| `src/styles.css` | Gesamtes Design-System (Variablen, Glas, Komponenten) |
| `public/sw.js` | Service Worker (Offline, Vorladen, Netz zuerst) |
| `public/firebase-config.json` | Öffentliche Firebase-Web-Konfiguration (Projekt `notiz-app-98dd6`) |
| `firestore.rules` | Sicherheitsregeln (müssen von Hand in der Firebase-Konsole eingetragen werden, siehe 7) |
| `tools/rezept-senden.py` | Schickt ein Rezept per REST direkt in Firestore (für Chats mit Internet) |
| `src/demo.ts` | Beispieldaten, nur mit `VITE_DEMO=1` (für die Vorschau-Seite) |

### localStorage-Schlüssel

`notiz.notes.v2` (Notizen), `notiz.shopping.v1` (Einkaufsliste), `notiz.sync.v1` (Bereichs-Code, Name, clientId),
`notiz.sync.v1.dismissed` (Einrichtungsfenster weggeklickt), `notiz.firebase.v1` (in der App eingefügte Firebase-Konfiguration),
`notiz.inbox.v1` (Rezept-Eingang: Tabellen-ID und schon übernommene Zeilen). Ändert sich ein Datenformat, Schlüssel-Version hochzählen
und migrieren.

## 5. Datenmodell

- `Note { id, title, type: 'note'|'recipe', servings|null, blocks: Block[], updatedAt (ISO) }`
- Blöcke haben **eigene IDs** (Grundlage für den Block-Abgleich):
  `heading{text,level}`, `text{text}`, `checklist{items:[{id,text,done}]}`, `table{header[],rows[][]}`,
  `steps{steps[], done?: boolean[]}` (`done` = Koch-Fortschritt, **nicht** im Markdown), `image{source,caption}`
  (Bild-Block existiert im Modell und wird angezeigt, kann aber **noch nicht angelegt** werden).
- `ShopItem { id, name, amount, recipeId|null, recipeTitle, home, bought, addedAt, rev? }`. „Erledigt“ = `home || bought`.
- **Zutaten-Erkennung:** `ingredientsOf` nimmt die **erste Tabelle unter einer Überschrift mit „Zutat“** (sonst die erste Tabelle),
  Spalten per Kopfzeile (`Zutat|Artikel|Produkt|Name`, `Menge|Anzahl`), Fallback: letzte Spalte = Name. Menge = Zahl und Einheit in einer Zelle (`2 TL`); Umrechnung in Gramm in `src/units.ts` (feste Formel, Dichten als Richtwerte). Altes Format `Menge | Einheit | Zutat` wird beim Laden automatisch umgestellt (`src/migrate.ts`).
  Rezepte brauchen deshalb **genau eine** Zutaten-Tabelle mit den Köpfen `Menge | Zutat`.

## 6. Live-Sync (src/sync/engine.ts) – so funktioniert er

Firestore-Pfade (alle unter `spaces/{bereichs-code}/`):

- `notes/{noteId}`: `{title, type, servings, order: string[], updatedAt: ms, deleted?: true, by}` (Löschen = **Tombstone**)
- `blocks/{blockId}`: `{noteId, data: JSON-String des Blocks, rev: ms, by}` – **Block als JSON-String**, weil Firestore keine
  verschachtelten Arrays erlaubt (Tabellen!).
- `shop/{itemId}`: flache Felder + `rev` + `deleted`
- `presence/{clientId}`: `{name, noteId, blockId, ts}`

Regeln der Zusammenführung (nicht ohne Tests ändern; `engine.test.ts` deckt sie ab):

1. **Block-Ebene, jüngere Änderung (`rev`) gewinnt.** Verschiedene Blöcke überschreiben sich nie.
2. **Welche Blöcke es gibt, bestimmen die Block-Dokumente** (`noteId`), **nicht** `order`. `order` ist nur die Reihenfolge.
   Damit gehen gleichzeitig angelegte Blöcke nie verloren. Ausnahme-Logik: `knownOrder` (lokal gelöscht, noch nicht gesendet) und
   `sentJson` (lokal neu, noch nicht gesendet).
3. **Wer gerade tippt, wird nicht überschrieben:** Ein Block gilt nach eigener Änderung `ACTIVE_MS` (2,5 s) als „in Arbeit“;
   fremde Änderungen daran werden zurückgestellt und danach neu geprüft (kein Cursor-Springen).
4. Eigene Änderungen werden `FLUSH_MS` (350 ms) gebündelt und als **ein Batch** geschrieben (Blöcke + Notiz).
5. Beim Start wird erst der erste Server-Stand abgewartet (`ready`, max. 4 s), dann hochgeladen, was lokal neuer ist.
6. Fremde/kaputte Dokumente (falsche Felder) werden **ignoriert** (`isMeta`, `isBlock`, `isShop`), nie abstürzen.
7. Anwesenheit: `setFocus(noteId, blockId)`, Heartbeat 12 s, gilt 30 s. Angezeigt als „Kevin ist hier“ + farbiger Rahmen/Name am Block.

Bekannte Grenzen: Zwei Personen, die **im selben Moment im selben Block** schreiben, überschreiben sich (jüngere gewinnt);
gleichzeitiges Abhaken verschiedener Einträge **innerhalb einer Checkliste** oder verschiedener Schritte (`done`) im selben Block
kann ein Häkchen verlieren (Block-Granularität). Tombstones werden nie aufgeräumt. Kein Text-Cursor der anderen Person, nur Block-Anzeige.

## 7. Zugriffsschutz, Firebase und Regeln (**kein Login**)

- Kevin wollte **ausdrücklich keinen Login**. Der gemeinsame Bereich ist durch einen **langen Zufallscode** (32 Hex-Zeichen) im Pfad
  geschützt, der im **Einladungslink** (`…/Notiz-App/#join-<code>`) steht. Wer den Link kennt, kann **alles lesen und schreiben**.
- `firestore.rules` erlaubt nur `spaces/{space}/{collection}/{doc}` mit `space.size() >= 24`, Sammlungen
  `notes|blocks|shop|presence`, ≤ 20 Felder, `data` < 200 000 Zeichen; **kein** Auflisten von `/spaces`.
  Getestet im Emulator **und** gegen das echte Projekt (REST).
- **Die Regeln wurden von Kevin von Hand in der Firebase-Konsole eingefügt** (Firestore → Regeln → Veröffentlichen). Es gibt keinen
  Deploy-Zugang aus dem Projekt. **Jede Änderung an `firestore.rules` (z. B. neue Sammlung) muss Kevin wieder von Hand einfügen**
  (Text im Chat geben) – oder es wird ein Deploy per Service-Account in der CI eingerichtet.
- Firebase-Projekt: `notiz-app-98dd6`, Datenbank `(default)`, Standort `eur3`, Tarif **Spark (kostenlos)**, Firestore-Edition **Standard**.
  Die Web-Konfiguration (`public/firebase-config.json`) ist bei Firebase-Web-Apps **nicht geheim**.
- Nie Geheimnisse ins (öffentliche!) Repo: keine Einladungscodes, keine Tokens. **Ausnahme auf Wunsch von Kevin:** Die ID der Rezept-Eingangs-Tabelle
  steht bewusst im Quellcode (`DEFAULT_SHEET_ID` in `src/inbox.ts`), damit sich die App ohne Einrichtung verbindet. Folge: Wer das Projekt
  liest, kann die Rezepte in dieser Tabelle lesen (nur lesen, nicht ändern). Das sind Rezepte, keine privaten Daten; trotzdem nichts Privates dort ablegen.
- Das Repository ist **öffentlich** (nötig für kostenloses GitHub Pages). In Dateien stehen Vornamen (Kevin, Isabelle).

## 8. Rezept-Eingang und Import (wie Claude Rezepte in die App bringt)

Drei Wege, Details in `docs/REZEPT-IMPORT.md` (diese Anleitung ist für **andere Chats** geschrieben):

1. **Google-Tabelle** „Notiz-App Rezept-Eingang“ (liegt in Kevins Drive, Spalten `Zeit | Titel | Rezept`, Rezept = komplettes Markdown in einer Zelle).
   Die App kennt die Tabelle fest und braucht keine Einrichtung pro Gerät. Der Link steht im öffentlichen Quellcode, weil Kevin die automatische Verbindung ausdrücklich wünscht. Die App (`src/inbox.ts`) liest die Tabelle über
   `https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv` (Google sendet CORS-Header für freigegebene Tabellen; vorab
   mit einer öffentlichen Beispieltabelle geprüft), ungefähr **jede Sekunde** solange sichtbar (winzige Abfrage `select count(C)`; nur bei geänderter Zeilenanzahl, sonst alle 60 s, wird die ganze Tabelle geladen), sofort beim Öffnen/Wiederkehren und auf Knopfdruck; im Hintergrund pausiert. Voraussetzung: Kevin stellt die
   Tabelle auf **„Jeder mit dem Link: Betrachter“**.
   **Doppelte verhindern:** Notiz-ID und Block-IDs sind aus dem Zeileninhalt abgeleitet (SHA-256), und die App prüft lokale Notizen,
   `engine.knows(id)` (auch gelöschte) und die lokale Liste `imported`.
   **Stand (01.11.2026):** Funktioniert mit der **echten** Tabelle. Die Tabelle ist freigegeben, Google liefert `text/csv` mit CORS-Header,
   und ein anderer Chat hat bereits echte Rezepte eingetragen (Zitronen-Kichererbsen-Pfanne, Cremige Tomaten-Orzo-Pfanne); `rowsFromCsv` und
   `noteFromRow` lesen sie korrekt (Zutaten-Tabelle, Schritte). In der Tabelle steht außerdem noch die Test-Zeile „Test-Rezept“, die Kevin
   löschen kann. **Nicht getestet:** das Verhalten auf echten Handys und bei beiden Geräten gleichzeitig.
2. **„Aus Text einfügen“** (Plus-Menü): Markdown einfügen → neue Notiz (`src/import.ts`).
3. **`tools/rezept-senden.py`**: schreibt direkt per Firestore-REST in den Bereich (braucht den Einladungslink und Internet).
   Die Anleitung enthält das Programm als Kopie; `src/import-guide.test.ts` prüft, dass beide **identisch** sind –
   wer das Programm ändert, muss `docs/REZEPT-IMPORT.md` mit aktualisieren (und umgekehrt).

## 9. Design-System (src/styles.css) und UI-Regeln

- Variablen: `--bg`, `--label(-2/-3)`, `--tint`, `--fill`, `--glass*`, `--ease: cubic-bezier(0.32, 0.72, 0, 1)` (iOS-Kurve).
  Hell/Dunkel über `prefers-color-scheme`. Hintergrund: weiche Farbflächen in `#app::before` (auch in `.screen.top`).
- **Glas:** Klasse `.glass` (+ `.strong`): Unschärfe, Sättigung, Lichtkante per `::after`-Maske. Echte Lichtbrechung (verzerrte Ränder)
  geht im Browser nur in Chromium, nicht in Safari → bewusst nicht umgesetzt.
- Layout: `#app` ist auf 430 px begrenzt und mittig (Vorschau am Computer); Menüs/Blätter sind **absolut in `#app`** positioniert
  (nicht `fixed`). Breiten immer über `document.getElementById('app')` messen, nicht `window.innerWidth`.
- Navigation: Root-Screen + optional Editor-Screen darüber. Der Editor erzeugt einen Verlaufseintrag `#note-<id>`, damit die
  **Android-Zurück-Geste/-Taste** den Editor schließt. Der Zurück-Knopf oben links und die Randwisch-Geste (iOS) räumen den Eintrag auf.
- Rezepte öffnen **schreibgeschützt** (`ReadOnlyCtx`), „Bearbeiten“ → „Speichern“ (räumt leere Zeilen/Blöcke weg, `tidy()`).
  Neue Rezepte starten im Bearbeiten-Modus. Notizen (`type: 'note'`) sind immer bearbeitbar. Im Lesemodus: Schritt antippen = abgehakt
  (grau, gut lesbar, graues Häkchen), „Fortschritt zurücksetzen“.
- Einkaufsliste: erledigte Zeile komplett grau hinterlegt, Text auf 50 %, die beiden Pillen bleiben farbig; **Reihenfolge bleibt**.
- Tab-Leiste: Rezepte, Notizen, Einkauf (rotes Abzeichen = offene Posten). Oben links: Personen-Symbol (Sync), oben rechts: Plus-Menü.

## 10. Entwicklung, Zweige, Veröffentlichung

- Entwicklungszweig: **`ccr-29b1054a-cmhsxu`** (so benannt von Claudes Umgebung). Der Workflow läuft bei Push auf diesen Zweig **und auf `main`**.
  `main` enthält nur den Initial-Commit. Wenn ihr den Zweig wechselt: `branches:` im Workflow anpassen.
- Ablauf der Veröffentlichung: Workflow baut → schreibt `dist/` per `git push -f` in den Zweig **`gh-pages`** → GitHub Pages
  („Deploy from a branch“, `gh-pages`, `/`) liefert aus. Adresse: **https://kvnstl924.github.io/Notiz-App/**.
  (`netlify.toml` ist eine ungenutzte Alternative; `firebase.json` enthält nur Emulator-/Regeln-Konfiguration, Hosting wird nicht genutzt.)
- **Zwischenspeicher:** GitHub Pages liefert mit `max-age=600`. Deshalb holt der Service Worker `index.html`, `*.json`, `*.webmanifest`
  mit `cache: 'no-cache'`, und die App zeigt „Neue Version verfügbar – Aktualisieren“. Ändert sich die Logik in `public/sw.js`,
  **`CACHE`-Namen hochzählen** (aktuell `notiz-v5`).
- Die **Vorschau-Seite** (Claude-Artifact, abgeschotteter Rahmen ohne Netz/Service-Worker) ist ein Claude-spezifischer Weg
  (siehe `CLAUDE.md`) und für Codex **nicht nötig**.

## 11. GitHub-Pages-Auslieferung (Stand 01.11.2026: läuft wieder)

- Zwischenzeitlich hing die Auslieferung: Eine frühere Pages-Auslieferung blieb bei GitHub auf „in progress“ und blockierte neue
  (*„Deployment request failed … due to in progress deployment. Please cancel … first“*). Aus der Claude-Umgebung ist die Pages-API
  gesperrt, Abbrechen war nicht möglich. Behoben wurde es offenbar durch **Unpublish site** und erneutes Einstellen von
  `gh-pages` unter Settings → Pages (durch Kevin). Seitdem liefert GitHub wieder aus; live ist die Version mit automatischem Rezept-Eingang.
- **Falls es wieder hängt:** Settings → Pages → „⋯“ → Unpublish site → danach Source „Deploy from a branch“ → `gh-pages` → `/ (root)` → Save,
  dann den fehlgeschlagenen Lauf „pages build and deployment“ erneut ausführen.
- **Dauerhaft besser (empfohlen):** Auf `actions/upload-pages-artifact` + `actions/deploy-pages` umstellen (Settings → Pages → Source:
  **GitHub Actions**), mit `concurrency: { group: pages, cancel-in-progress: false }`; der Zweig `gh-pages` entfällt.
- **Wichtig:** Der Workflow veröffentlicht nur, wenn `npm test` grün ist. Ein roter Test (z. B. wegen CRLF, siehe Abschnitt 13) blockiert die
  Veröffentlichung stillschweigend; die Seite bleibt dann auf dem alten Stand. Nach jedem Push den Lauf unter Actions prüfen.
- Live prüfen: `curl -s https://kvnstl924.github.io/Notiz-App/ | grep -o 'assets/index-[^"]*\.js'`, dann in dieser Datei nach einem neuen Text suchen.

## 12. Offene Aufgaben (Reihenfolge nach Nutzen)

1. Auf **echten Geräten** testen (Kevin: Samsung/Chrome; Isabelle: iPhone/Safari).
   Besonders prüfen:
   - iOS-Standalone: Statusleiste (`black-translucent`), Safe Areas (`env(safe-area-inset-*)`), Tastatur verdeckt Eingabefelder nicht,
     Textfeld-Zoom (Felder sind ≥ 16 px), Rubber-Band-Scrollen, Wisch-zurück vom Rand (kann mit der Systemgeste kollidieren).
   - **iOS trennt den Speicher von Safari und Home-Bildschirm-App.** Nach „Zum Home-Bildschirm“ kann die App leer starten →
     Einladungslink dort erneut einfügen. Eine bessere Lösung wäre z. B. den Bereichs-Code über die Manifest-`start_url` mitzugeben
     (nicht umgesetzt, **Annahme ungetestet**).
   - Glas-Optik in Safari (`-webkit-backdrop-filter`), Inter vs. SF, Dunkel/Hell.
   - Sync über zwei echte Geräte, Offline-Betrieb, Neuaufbau nach langer Pause.
2. **Rezept-Eingang auf echten Handys** abnehmen (läuft mit der echten Tabelle, siehe Abschnitt 8). Gemessen (01.11.): Eine Änderung in der Tabelle ist für `gviz` nach ca. 0,4 s abrufbar, 15 Abfragen kurz hintereinander liefen ohne Drosselung. Kevin will
   eine **sofortige** Aktualisierung (5 s waren ihm zu lang); deshalb Sekundentakt mit leichter Abfrage. Auf Akku/Datenvolumen auf echten Handys achten. Zellen, die
   mit `=`, `+`, `-` beginnen, sind bisher unproblematisch (Rezepte beginnen mit `---`). Die Test-Zeile aus der Tabelle entfernen lassen.
3. **Browser-Tests ins Repo holen.** Die bisherigen Playwright-Prüfungen lagen nur in `/tmp` und sind veraltet (z. B. öffnet das Plus
   jetzt ein Menü statt direkt ein Rezept anzulegen). Empfehlung: `@playwright/test` mit Emulator, Handy-Viewport (390×844, `isMobile`, `hasTouch`),
   Szenarien: Rezept anlegen/Lesemodus/Speichern; Einkaufsliste inkl. Zuhause/Gekauft; zwei Browser-Kontexte (Kevin/Isabelle) mit Live-Sync und
   Anwesenheit; Rezept-Eingang mit gemockter Google-Antwort; Update-Hinweis (zwei Builds tauschen); Offline-Start unter `/Notiz-App/`.
   Nützliche Selektoren: `.nav-btn[aria-label="Neu"]`, `.menu-item`, `.row`, `.tbl textarea`, `.cta`, `.toast`, `.shop-wrap`,
   `.pill.home|.bought`, `.li.tappable`, `.tab`, `.sync-btn`, `.panel`. Hinweise: Mit aktivem Firestore wird der Browser nie „networkidle“
   (immer `waitUntil: 'load'` + auf Elemente warten); `page.goBack()` hängt in iframes → `history.back()` auswerten; `pkill -f` kann die eigene Shell treffen.
4. **Bilder** einfügen (Block `image` existiert). Speicherort klären: Firebase Storage verlangt inzwischen den Bezahltarif (Blaze) → kostenlos eher
   verkleinerte Bilder (≈ 100–150 KB) als Base64 in `blocks` (Grenze `data` < 200 000 Zeichen in `firestore.rules`, ggf. in Teile splitten)
   oder Google Drive. Entscheidung gehört zu Kevin (Kosten!).
5. **Formatierung** in Textblöcken (fett, kursiv, Listen). Kevin hat „Formatierung/Bilder“ ursprünglich gewünscht.
6. **Portionen umrechnen** (Zutatenmengen skalieren) und **gleiche Zutaten aus mehreren Rezepten zusammenfassen** in der Einkaufsliste.
7. **Rückgängig/Papierkorb** für gelöschte Notizen, Rückfrage beim Löschen von Zeilen mit Inhalt (Spalten fragen schon).
8. **Backup/Export:** „Alles als Markdown kopieren/herunterladen“. Die ursprünglich geplante **Drive-Anbindung** (Notizen als `.md` in einen
   Drive-Ordner) ist **nicht gebaut**; sie würde Google-OAuth brauchen und wurde durch den Rezept-Eingang ersetzt. Nur angehen, wenn Kevin es will.
9. **Stil-Frage offen:** Abgehakte **Checklisten in normalen Notizen** sind noch durchgestrichen, Schritte und Einkauf sind ausgegraut.
   Kevin wurde gefragt, ob das angeglichen werden soll (keine Antwort). Nicht ungefragt ändern.
10. Aufräumen: Tombstones, `firebase.json`-Hosting-Teil und `netlify.toml` entfernen, falls nicht gebraucht; `sw.js`-Precache bei neuen Assets prüfen.
11. Sicherheit: Einladungslink-Rotation (neuer Bereich + Daten umziehen), falls der Link nach außen gelangt; Limits gegen Missbrauch prüfen
    (Regeln begrenzen nur Dokumentgröße und Feldzahl).

## 13. Fallen, die schon Zeit gekostet haben

- **Preact (diese Version) hängt bei Zahlen in `style={{…}}` kein `px` an.** `borderRadius: 22` wird verworfen → immer Strings (`'22px'`).
- **CSS-Minimierer entfernt `backdrop-filter`, wenn `-webkit-backdrop-filter` danach steht.** Reihenfolge: **erst `-webkit-…`, dann die Standard-Eigenschaft**
  (sonst fehlt das Glas in Chrome/Android im gebauten Stand, im Dev-Modus fällt es nicht auf).
- Vite erzeugt für den Firestore-Teil einen **eigenen Chunk**. Wer die App in eine Einzeldatei einbettet, bettet nur den Hauptteil ein
  (der Sync-Teil wird dann nicht geladen; für die Vorschau-Seite gewollt).
- **Service Worker:** Beim ersten Besuch wird sonst nichts zwischengespeichert, weil die Seite vor dem Worker geladen wurde → `precache()` bei `install`.
  Flutters Worker war nur noch ein Abschalter (Altlast, nicht mehr relevant).
- **Firestore:** keine verschachtelten Arrays; `undefined` ist verboten (JSON-Rundlauf); Offline-Cache nur im Browser (`persistent: true`),
  in Node-Tests `persistent: false`. Erster Snapshot kann aus dem Cache kommen → `ready` wartet auf `fromCache === false` (max. 4 s).
- **Wettlauf bei Hooks:** Änderungen zwischen dem ersten Zeichnen und dem Anmelden im `useEffect` gingen verloren → die Hooks (`useSync`,
  `useCollection`, `useInbox`, `usePresence`) stoßen nach dem Anmelden einmal ein Neuzeichnen an. Beibehalten.
- **`AutoText`:** Eingaben sind `<textarea>` mit Auto-Höhe (echte iOS-Tastatur/Lupe/Rechtschreibung). Im Lesemodus `readOnly` über Kontext.
- `history`/`localStorage` können in eingebetteten Rahmen fehlen → überall `try/catch` bzw. Arbeitsspeicher-Rückfall (`store.ts`, `manager.ts`).
- Playwright kann `context.setOffline` nicht zuverlässig mit Service Workern → Server beenden statt offline schalten.
- Das Textfeld-Verhalten `Enter` = neuer Eintrag, `Backspace` im leeren Feld = Eintrag löschen ist gewollt (Checklisten, Schritte).

- **Zeilenenden:** Dateien müssen **LF** haben (`.gitattributes: * text=auto eol=lf`). Ein Werkzeug auf Windows hat einmal sechs Dateien auf CRLF
  umgestellt; dadurch fand `src/import-guide.test.ts` die Textstellen in `docs/REZEPT-IMPORT.md` nicht mehr, der Test schlug fehl und
  **die Veröffentlichung wurde stillschweigend blockiert**. Der Test ist jetzt tolerant (`lf()`), trotzdem LF behalten.
- Mehrfach hintereinander gepushte Commits brechen laufende Läufe ab (`concurrency: cancel-in-progress`): Nur der letzte Lauf zählt.
  Bleibt der letzte rot, ist **nichts** veröffentlicht, auch wenn frühere Läufe grün waren.

## 14. Definition of Done (für jede Änderung)

1. `npx tsc --noEmit` und `npm test` grün (bei Sync-Änderungen zusätzlich mit Emulator).
2. Browser-Prüfung im Handy-Viewport, Hell **und** Dunkel, wenn die Oberfläche betroffen ist.
3. Nichts Hartcodiertes mit Geheimnissen; alle Pfade relativ; neue Firestore-Sammlungen **zusätzlich** in `firestore.rules` **und** bei Kevin eintragen lassen.
4. Dokumentation anpassen (`README.md` Stand-Liste, `docs/KONZEPT.md`, diese Datei, bei Format-Änderungen `docs/REZEPT-IMPORT.md` samt Programm-Kopie).
5. Kevin knapp auf Deutsch berichten: was geändert ist, **was getestet wurde und was nicht**, und ob er etwas tun muss (am Handy machbar!).

## 15. Nachtrag: Änderungen nach der ersten Übergabe (Stand 01.11.2026, abends)

- **Mengen und Umrechnung** (`src/units.ts`, Tests `units.test.ts`): Die Spalte „Menge“ enthält Zahl **und** Einheit
  (`500 g`, `2 TL`). Im Editor ist die Menge ein Freitextfeld („2 TL“, „500 g“), ohne Einheiten-Auswahl.
  Umrechnung: Gewicht exakt; Volumen fest (TL = 5 ml, EL = 15 ml, Tasse = 250 ml) × Dichte der Zutat (`DENSITY`,
  Richtwerte: Salz, Zucker, Mehl, Butter, Öl, Honig, Milch, Wasser, Sahne, Reis). Ohne Dichte keine Umrechnung.
  Zutatenliste (Lesemodus) und Einkaufsliste zeigen „12 g (2 TL)“: Gramm zuerst, die Angabe aus dem Rezept in Klammern (`shopAmount`). Gramm bleibt ohne Klammern, Kilo und Volumen werden umgerechnet, Stück und Unbekanntes bleiben wie geschrieben. Im Lesemodus rechnet `convertInText` auch Mengen im Zubereitungstext um („2 TL Salz“ → „12 g (2 TL) Salz“); gespeichert bleibt der Text unverändert.
- **Altes Format migriert** (`src/migrate.ts`): `Menge | Einheit | Zutat` wird beim Laden, Importieren und Übernehmen
  vom Sync zu `Menge | Zutat`. Die Anleitung `docs/REZEPT-IMPORT.md` beschreibt das neue Format.
- **Papierkorb** (`src/trash.ts`, `src/trash-ui.tsx`): Gelöschte Rezepte und Notizen bleiben 30 Tage (lokal in
  `notiz.trash.v1`), danach automatisch weg (beim Öffnen geprüft). Löschen über `store.remove` (auch bei Sync-Löschungen
  vom anderen Gerät), leere Entwürfe über `store.discard` (ohne Papierkorb). Wiederherstellen ruft
  `sync.engine.forgetBlocks` auf, damit die Blöcke erneut gesendet werden (getestet in `engine.test.ts`).
  Einkaufs-Einträge haben (noch) keinen Papierkorb. Der Knopf steht neben dem Plus in der Kopfleiste.
- **Wischen zwischen Tabs** (`src/app.tsx`): Ein horizontaler Wisch (mind. 70 px, flach) wechselt zwischen Rezepte,
  Notizen, Einkauf; Start auf Zeilen, Feldern, Tabellen, Leisten wird ignoriert. Eine Variante mit Fingerfolge wurde
  auf Wunsch wieder zurückgenommen. Die aktuelle Version ist die einfache mit Einblend-Animation.
- **Tab-Leiste**: `bottom: calc(var(--safe-bottom) + 10px)` (Originalposition, auf Wunsch).
- **iPhone-Sonderfälle** (`src/main.tsx`, `src/styles.css`):
  - Klasse `ios` am `<html>` wird per User-Agent gesetzt. Dann läuft der obere Schimmer bis an die Kante
    (Statusleiste ist durchsichtig). Auf Android bleibt die Maske aus `#app::before` (oben einfarbig).
  - Zoom mit zwei Fingern wird per Ereignis verhindert (`gesturestart`, `touchmove`), `maximum-scale=1` im Viewport.
  - `#app` ist `position: fixed; inset: 0` (ohne feste Höhe, sonst ragt sie unten über den sichtbaren Bereich).
  - **Ungelöst:** Die installierte App auf dem iPhone endet bei etwa 804 pt, der Bildschirm ist etwa 874 pt hoch
    (Messung mit Anzeige in der App, inzwischen entfernt). Die unteren etwa 70 pt zeichnet iOS schwarz. Ursache liegt
    bei iOS; mögliche Wege: nativer Wrapper (Capacitor, braucht Apple-Konto) oder akzeptieren.
- **Rezept-Eingang**: Abruf ist jetzt etwa jede Sekunde leicht (`select count(C)`), bei Änderung volle Abfrage;
  volle Abfrage mindestens alle 60 s (`src/inbox.ts`). Die Tabellen-ID steht bewusst im Quellcode.
- **Service Worker**: Cache-Name `notiz-v6`, nach Änderungen an `public/sw.js` hochzählen.

**Vorgehen für die nächste Sitzung:** zuerst `git pull`, `npx tsc --noEmit`, `npm test`, dann ändern, testen
(Playwright-Skripte liegen nicht im Repo; siehe Abschnitt 12), committen und pushen. Der Workflow veröffentlicht nach
jedem Push auf GitHub Pages. Prüfen: Lauf unter Actions grün, und die Programmdatei auf der Live-Adresse ist die neue.
