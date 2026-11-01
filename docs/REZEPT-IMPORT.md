# Anleitung für Claude: Rezept in die Notiz-App importieren

Diese Anleitung ist für einen Chat gedacht, in dem Kevin dir ein Rezept gibt (Link, Text, Foto oder Idee)
und du es in seine Notiz-App bringen sollst. Lies sie ganz, bevor du anfängst.

## Worum es geht
- Die **Notiz-App** ist eine installierbare Web-App für **Kevin** (Android) und **Isabelle** (iPhone):
  https://kvnstl924.github.io/Notiz-App/
- Sie hat Rezepte, Notizen und eine Einkaufsliste. Beide sehen Änderungen sofort (Live-Sync).
- Ein Rezept besteht aus **Titel, Portionen, einer Zutaten-Tabelle und nummerierten Schritten**.
- Die **Einkaufsliste** erzeugt die App selbst aus der Zutaten-Tabelle (Knopf „Zur Einkaufsliste hinzufügen“).
  Dafür musst du nichts tun, aber die Tabelle muss genau im Format unten stehen.

## Dein Ablauf
1. Rezept besorgen: Link abrufen, Text lesen oder Foto auswerten (siehe „Rezept von einem Link“).
2. Rezept **im Format der App** schreiben (siehe „Das Format“).
3. In die App bringen: **Weg 1** (Google-Tabelle, empfohlen), sonst **Weg 2** (Text zum Einfügen). **Weg 3** nur mit Programmausführung und Internet.
4. Kevin kurz bestätigen, was angelegt wurde, in zwei Sätzen.

Nachfragen nur, wenn wirklich etwas fehlt (z. B. Portionen unklar). Nichts erfinden.

## Das Format (genau einhalten)

```markdown
---
typ: rezept
portionen: 4
---
# Spaghetti Carbonara

## Zutaten
| Menge | Einheit | Zutat |
|---|---|---|
| 400 | g | Spaghetti |
| 150 | g | Guanciale |
| 4 | Stück | Eigelb |
| 80 | g | Pecorino |
|  |  | Pfeffer (nach Geschmack) |

## Zubereitung
1. Reichlich Wasser salzen und die Spaghetti nach Packungsangabe kochen.
2. Guanciale in einer Pfanne ohne Fett knusprig braten.
3. Eigelb mit geriebenem Pecorino verrühren.
4. Spaghetti abgießen, mit dem Guanciale mischen und vom Herd nehmen, dann die Eiercreme unterrühren.

Quelle: https://beispiel.de/carbonara
```

**Regeln**
- **Kopf:** `typ: rezept` und `portionen: <Zahl>`. Ohne Kopf und ohne Portionen legt die App 4 Portionen an.
- **Titel:** genau eine Zeile `# Titel` (kurz, ohne „Rezept für …“).
- **Zutaten:** **genau eine** Tabelle direkt unter der Überschrift `## Zutaten`, mit den Spaltenköpfen
  **`Menge | Einheit | Zutat`** (genau so geschrieben, sonst findet die Einkaufsliste die Spalten nicht).
  - Eine Zutat pro Zeile. Die Spalte „Zutat“ darf nie leer sein, sonst fehlt sie in der Einkaufsliste.
  - **Menge** nur als Zahl (`400`, `0,5`, `1,5`). Brüche als Dezimalzahl. Ohne Menge: leer lassen.
  - **Einheit** kurz: `g`, `kg`, `ml`, `l`, `EL`, `TL`, `Stück`, `Dose`, `Bund`, `Prise`, `Pck.`, `Zehe`. Ohne Einheit: leer.
  - „nach Geschmack“, „zum Braten“: Menge und Einheit leer, Zusatz in Klammern bei der Zutat.
  - Gruppen („Für den Teig“, „Für die Soße“): **keine zweite Tabelle**. Die Gruppe in Klammern bei der Zutat nennen, z. B. `Mehl (Teig)`.
  - US-Maße (cups, oz, lb) in **g/ml** umrechnen, sinnvoll runden. Im Zweifel das Original in Klammern dazu.
- **Zubereitung:** Überschrift `## Zubereitung`, darunter **nummerierte Liste** (`1.`, `2.` …).
  Ein Schritt = eine zusammenhängende Handlung. Zeiten, Temperaturen und Mengen aus der Vorlage behalten.
- **Optional:** `## Tipps` mit normalem Text, am Ende `Quelle: <Link>` als eigene Zeile.
- **Nicht verwenden:** Bilder, HTML, Fettdruck mit Sternchen, verschachtelte Listen, mehrere Zutaten-Tabellen, Emojis.
- Sprache: **Deutsch**, kurz und sachlich.

**Urheberrecht:** Zutaten und Mengen darfst du übernehmen. Die Schritte formulierst du **in eigenen Worten**
und kürzer. Keine Einleitungen, Geschichten oder Fließtexte der Seite kopieren. Die Quelle immer angeben.

## Rezept von einem Link
- Seite abrufen. Viele Rezeptseiten enthalten im Quelltext strukturierte Daten (`<script type="application/ld+json">`
  mit `"@type": "Recipe"`): Dort stehen `name`, `recipeYield` (Portionen), `recipeIngredient` und `recipeInstructions`.
  Das ist zuverlässiger als der sichtbare Text.
- Zutatenzeilen wie „400 g Spaghetti“ in `Menge | Einheit | Zutat` zerlegen.
- Lässt sich die Seite nicht lesen (Bezahlschranke, Fehler), sag das kurz und bitte Kevin, den Rezepttext einzufügen. Rate nicht.
- Bei einem Foto oder Screenshot: nur übernehmen, was du sicher lesen kannst, bei Unsicherheit nachfragen.

## Weg 1: Google-Tabelle „Notiz-App Rezept-Eingang“ (empfohlen)
Voraussetzung: In diesem Chat ist Kevins Google Drive bzw. Google Tabellen verbunden.
Die App liest diese Tabelle beim Öffnen und danach etwa jede Sekunde, solange sie sichtbar geöffnet ist. Im Hintergrund pausiert der Abruf; beim Zurückkehren prüft die App sofort. Jede **neue Zeile** wird als **neues Rezept** angelegt (auf beiden Handys per Live-Sync).

1. Die App ist fest mit der Rezept-Tabelle verbunden; eine Einrichtung auf jedem Gerät ist nicht nötig.
   Die Tabelle muss auf **„Jeder mit dem Link: Betrachter“** gestellt sein.
2. **Namen des Tabellenblatts** mit `get_spreadsheet` nachsehen. Er heißt oft `Untitled`, `Tabelle1` oder `Sheet1`.
3. **Genau eine Zeile anhängen** (`append_values`, Bereich `<Blattname>!A1`) mit drei Zellen:
   Zeit, Titel und das **komplette Rezept als Markdown** (Kopf `---`, `# Titel`, Zutaten-Tabelle, Schritte), Zeilenumbrüche als `\n`.

```json
[["2026-11-01 18:30", "Spaghetti Carbonara", "---\ntyp: rezept\nportionen: 4\n---\n# Spaghetti Carbonara\n\n## Zutaten\n| Menge | Einheit | Zutat |\n|---|---|---|\n| 400 | g | Spaghetti |\n| 150 | g | Guanciale |\n\n## Zubereitung\n1. Spaghetti kochen.\n2. Guanciale braten und alles mischen.\n"]]
```

4. **Nie ändern:** die Kopfzeile (`Zeit | Titel | Rezept`) und bestehende Zeilen. Nichts löschen.
   Eine Änderung ist eine **neue Zeile** (= neues Rezept); Kevin löscht das alte in der App.
5. **Kevin sagen:** „Das Rezept ist in der Tabelle. Es erscheint in der App fast sofort (etwa 1 bis 2 Sekunden), solange sie geöffnet ist. Du kannst auch Rezepte → Plus → *Rezept-Eingang* → *Jetzt prüfen* tippen.“

Die App kann in der Tabelle nichts ändern (nur lesen).

## Weg 2: Text zum Einfügen (funktioniert immer, auch auf dem Handy)
1. Gib das fertige Rezept in **genau einem Codeblock** aus (so kann Kevin es mit einem Fingertipp kopieren).
2. Schreibe darunter: *„In der App: Rezepte → Plus oben rechts → ‚Aus Text einfügen‘ → einfügen → ‚Importieren‘.“*
3. Die App legt immer ein **neues** Rezept an und überschreibt nichts.

## Weg 3: Direkt in die App schreiben (nur wenn du Programme ausführen und ins Internet kannst)
Das Rezept erscheint dann ohne weiteren Schritt in wenigen Sekunden auf beiden Handys.

1. Bitte Kevin um den **Einladungslink** seines gemeinsamen Bereichs (App → Personen-Symbol oben links →
   „Link kopieren“). Er sieht so aus: `https://kvnstl924.github.io/Notiz-App/#join-<lange Zeichenfolge>`.
   Der Link ist ein **Geheimnis** (wer ihn kennt, kann im Bereich lesen und schreiben):
   - Nicht in Dateien speichern, die bleiben, nicht anderswo posten, nicht erneut anzeigen.
   - Er steht nur in dem Befehl unten. Frage nur einmal danach.
2. Speichere das Programm aus dem Anhang als `rezept-senden.py` und das Rezept als `rezept.md`.
3. Erst **prüfen**: `python3 rezept-senden.py --bereich "<LINK>" --datei rezept.md --nur-pruefen`
   Das zeigt Titel, Portionen und die Blöcke an. Es sollten `table` und `steps` dabei sein.
4. Dann **senden**: derselbe Befehl ohne `--nur-pruefen`. Bei Erfolg steht dort „Fertig. … ist jetzt in der App“.
5. Mögliche Fehler:
   - `403`: Link oder Code ist falsch oder unvollständig. Kevin bitten, ihn erneut zu kopieren.
   - Verbindungsfehler oder Zeitüberschreitung: Dein Chat darf vermutlich nicht ins Internet. Nimm **Weg 1** oder **Weg 2**.
6. Das Programm legt **nur neue** Rezepte an. Es ändert oder löscht nie etwas Vorhandenes.
   Zum Ändern eines Rezepts: neues Rezept anlegen und Kevin sagen, dass er das alte löschen kann.

## Prüfliste vor dem Senden
- [ ] Kopf mit `typ: rezept` und Portionen
- [ ] Genau eine Zutaten-Tabelle mit den Köpfen `Menge | Einheit | Zutat`
- [ ] In jeder Zeile steht eine Zutat; Mengen sind Zahlen
- [ ] Schritte nummeriert, in eigenen Worten, mit Zeiten und Temperaturen
- [ ] Quelle angegeben
- [ ] Nichts erfunden, was nicht in der Vorlage steht

## Anhang: Programm `rezept-senden.py`
Nur Python 3, keine Zusatzpakete. Speichere den Inhalt unverändert als `rezept-senden.py`.

```python
#!/usr/bin/env python3
"""
Schickt ein Rezept (oder eine Notiz) direkt in den gemeinsamen Bereich von Kevin und Isabelle.
Es erscheint sofort in der App auf beiden Handys.

Nur Python 3, keine zusätzlichen Pakete. Beispiele:

  python3 rezept-senden.py --bereich "<Einladungslink oder Code>" --datei rezept.md
  python3 rezept-senden.py --bereich "<Einladungslink oder Code>" --datei rezept.md --nur-pruefen

Die Datei ist Markdown im Format der App (siehe REZEPT-IMPORT.md).
"""
import argparse
import json
import re
import secrets
import sys
import time
import urllib.error
import urllib.request

# Öffentliche Verbindungsdaten der Web-App (nicht geheim; Schutz ist der lange Bereichs-Code)
PROJEKT = "notiz-app-98dd6"
API_KEY = "AIzaSyBxC46kegF4-zGrz_OTndh21huCV9trTwM"


def neue_id() -> str:
    return secrets.token_hex(8)


# ───────── Markdown lesen (gleiche Regeln wie die App) ─────────
CHECK = re.compile(r"^[-*] \[([ xX])\] ?(.*)$")
STEP = re.compile(r"^\d+[.)] ?(.*)$")
HEAD = re.compile(r"^(#{1,6}) +(.*)$")
IMG = re.compile(r"^!\[(.*?)\]\((.*?)\)$")


def zellen(zeile: str):
    t = zeile.strip()
    t = t[1:] if t.startswith("|") else t
    t = t[:-1] if t.endswith("|") and not t.endswith("\\|") else t
    return [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", t)]


def passend(row, n):
    return row[:n] + [""] * (n - len(row))


def lesen(md: str):
    lines = md.replace("\r\n", "\n").split("\n")
    i, meta = 0, {}
    if lines and lines[0].strip() == "---":
        i = 1
        while i < len(lines) and lines[i].strip() != "---":
            if ":" in lines[i]:
                k, v = lines[i].split(":", 1)
                meta[k.strip()] = re.split(r"\s+#", v)[0].strip()
            i += 1
        i += 1
    titel, blocks = None, []
    leer = lambda l: not l.strip()  # noqa: E731
    while i < len(lines):
        l = lines[i]
        if leer(l):
            i += 1
            continue
        h = HEAD.match(l)
        if h:
            if len(h.group(1)) == 1 and titel is None:
                titel = h.group(2).strip()
            else:
                blocks.append({"kind": "heading", "id": neue_id(), "text": h.group(2).strip(), "level": len(h.group(1))})
            i += 1
        elif CHECK.match(l):
            items = []
            while i < len(lines) and CHECK.match(lines[i]):
                m = CHECK.match(lines[i])
                items.append({"id": neue_id(), "text": m.group(2).strip(), "done": m.group(1).lower() == "x"})
                i += 1
            blocks.append({"kind": "checklist", "id": neue_id(), "items": items})
        elif STEP.match(l):
            steps = []
            while i < len(lines) and STEP.match(lines[i]):
                steps.append(STEP.match(lines[i]).group(1).strip())
                i += 1
            blocks.append({"kind": "steps", "id": neue_id(), "steps": steps})
        elif l.lstrip().startswith("|"):
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                rows.append(zellen(lines[i]))
                i += 1
            sep = len(rows) >= 2 and all(re.fullmatch(r":?-+:?", c) for c in rows[1])
            kopf = rows[0]
            blocks.append({"kind": "table", "id": neue_id(), "header": kopf,
                           "rows": [passend(r, len(kopf)) for r in rows[2 if sep else 1:]]})
        elif IMG.match(l.strip()):
            m = IMG.match(l.strip())
            blocks.append({"kind": "image", "id": neue_id(), "source": m.group(2), "caption": m.group(1)})
            i += 1
        else:
            para = []
            while i < len(lines) and not leer(lines[i]) and not HEAD.match(lines[i]) and not CHECK.match(lines[i]) \
                    and not STEP.match(lines[i]) and not lines[i].lstrip().startswith("|"):
                para.append(lines[i])
                i += 1
            blocks.append({"kind": "text", "id": neue_id(), "text": "\n".join(para)})
    typ = "recipe" if meta.get("typ") == "rezept" else "note"
    portionen = int(meta["portionen"]) if meta.get("portionen", "").isdigit() else (4 if typ == "recipe" else None)
    return {"title": titel or "Ohne Titel", "type": typ, "servings": portionen, "blocks": blocks}


# ───────── Firestore (REST) ─────────
def kodieren(v):
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, list):
        return {"arrayValue": {"values": [kodieren(x) for x in v]}}
    raise TypeError(type(v))


def schreiben(basis, bereich, sammlung, doc_id, daten):
    url = f"{basis}/spaces/{bereich}/{sammlung}/{doc_id}"
    url += ("&" if "?" in url else "?") + f"key={API_KEY}" if basis.startswith("https") else ""
    body = json.dumps({"fields": {k: kodieren(v) for k, v in daten.items()}}).encode()
    req = urllib.request.Request(url, data=body, method="PATCH", headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=30).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"Fehler {e.code} beim Schreiben von {sammlung}/{doc_id}: {e.read().decode()[:300]}")


def bereich_code(text: str) -> str:
    m = re.search(r"([0-9a-f]{24,64})\s*$", text.strip(), re.I)
    if not m:
        sys.exit("Das ist kein gültiger Einladungslink oder Bereichs-Code (erwartet: 24 bis 64 Zeichen 0-9 a-f).")
    return m.group(1).lower()


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--bereich", required=True, help="Einladungslink oder Code des gemeinsamen Bereichs")
    p.add_argument("--datei", help="Markdown-Datei (sonst von der Standardeingabe lesen)")
    p.add_argument("--nur-pruefen", action="store_true", help="nichts senden, nur anzeigen, was gesendet würde")
    p.add_argument("--emulator", help="nur für Tests: host:port des Firestore-Emulators")
    p.add_argument("--projekt", default=PROJEKT)
    a = p.parse_args()

    md = open(a.datei, encoding="utf-8").read() if a.datei else sys.stdin.read()
    note = lesen(md)
    if not note["blocks"] and note["title"] == "Ohne Titel":
        sys.exit("In dem Text steht nichts, was sich importieren lässt.")
    code = bereich_code(a.bereich)

    print(f"{'Rezept' if note['type'] == 'recipe' else 'Notiz'}: {note['title']}"
          f" ({note['servings']} Portionen)" if note["servings"] else f"Notiz: {note['title']}")
    for b in note["blocks"]:
        info = {"table": lambda b: f"Tabelle {len(b['rows'])} Zeilen", "steps": lambda b: f"{len(b['steps'])} Schritte",
                "checklist": lambda b: f"Checkliste {len(b['items'])}", "heading": lambda b: b["text"],
                "text": lambda b: b["text"][:40], "image": lambda b: b["source"]}[b["kind"]](b)
        print(f"  - {b['kind']}: {info}")
    if a.nur_pruefen:
        print("Nur geprüft, nichts gesendet.")
        return

    basis = (f"http://{a.emulator}/v1/projects/{a.projekt}/databases/(default)/documents" if a.emulator
             else f"https://firestore.googleapis.com/v1/projects/{a.projekt}/databases/(default)/documents")
    note_id, jetzt = neue_id(), int(time.time() * 1000)
    # Erst die Blöcke, dann die Notiz: so erscheint sie vollständig
    for n, b in enumerate(note["blocks"]):
        schreiben(basis, code, "blocks", b["id"], {
            "noteId": note_id, "data": json.dumps(b, ensure_ascii=False), "rev": jetzt + n, "by": "claude-import"})
    schreiben(basis, code, "notes", note_id, {
        "title": note["title"], "type": note["type"], "servings": note["servings"],
        "order": [b["id"] for b in note["blocks"]], "updatedAt": jetzt + len(note["blocks"]), "by": "claude-import"})
    print(f"Fertig. '{note['title']}' ist jetzt in der App (Notiz-ID {note_id}).")


if __name__ == "__main__":
    main()
```
