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
