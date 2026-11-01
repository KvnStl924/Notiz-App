import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mk, newRecipe, type Note } from '../model';
import { NoteStore, ShopStore } from '../store';
import { SyncEngine } from './engine';
import { MemoryServer } from './memory-backend';

let n = 0;
async function device(server: MemoryServer, name: string) {
  const id = ++n;
  const notes = new NoteStore(`t.notes.${id}`, false);
  const shop = new ShopStore(`t.shop.${id}`);
  const backend = server.backend();
  const engine = new SyncEngine(notes, shop, backend, { clientId: `c${id}`, name });
  const started = engine.start();
  await vi.advanceTimersByTimeAsync(50);
  await started;
  return { notes, shop, backend, engine };
}
const settle = () => vi.advanceTimersByTimeAsync(4000);
const edit = (notes: NoteStore, id: string, fn: (n: Note) => void) => {
  const note = notes.get(id)!;
  fn(note);
  notes.save(note);
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Live-Sync', () => {
  it('Blöcke, die später eintreffen, landen an der richtigen Stelle', async () => {
    const s = new MemoryServer();
    const d = await device(s, 'Isabelle');
    const note = newRecipe(); // Zutaten, Tabelle, Zubereitung, Schritte
    const [h1, tbl, h2, steps] = note.blocks;
    const doc = (b: (typeof note.blocks)[number], rev: number) => ({ noteId: note.id, data: JSON.stringify(b), rev, by: 'x' });
    const e = d.engine as unknown as {
      onNotes(c: unknown[]): void;
      onBlocks(c: unknown[]): void;
    };
    e.onNotes([{ id: note.id, data: { title: 'R', type: 'recipe', servings: 4, order: [h1.id, tbl.id, h2.id, steps.id], updatedAt: 1000, by: 'x' } }]);
    // Blöcke kommen in zwei Paketen, die Tabelle zuletzt
    e.onBlocks([{ id: h1.id, data: doc(h1, 1) }, { id: h2.id, data: doc(h2, 2) }, { id: steps.id, data: doc(steps, 3) }]);
    e.onBlocks([{ id: tbl.id, data: doc(tbl, 4) }]);
    expect(d.notes.get(note.id)!.blocks.map((b) => b.kind)).toEqual(['heading', 'table', 'heading', 'steps']);
  });

  it('neue Notiz und Änderungen erscheinen beim anderen Gerät', async () => {
    const s = new MemoryServer();
    const a = await device(s, 'Kevin');
    const b = await device(s, 'Isabelle');

    const r = newRecipe();
    r.title = 'Pfannkuchen';
    a.notes.save(r);
    await settle();
    expect(b.notes.get(r.id)?.title).toBe('Pfannkuchen');
    expect(b.notes.get(r.id)?.blocks).toHaveLength(4);

    edit(a.notes, r.id, (x) => ((x.blocks[1] as { rows: string[][] }).rows[0] = ['250', 'g', 'Mehl']));
    await settle();
    expect((b.notes.get(r.id)!.blocks[1] as { rows: string[][] }).rows[0]).toEqual(['250', 'g', 'Mehl']);
  });

  it('verschiedene Blöcke gleichzeitig bearbeiten: nichts geht verloren', async () => {
    const s = new MemoryServer();
    const a = await device(s, 'Kevin');
    const b = await device(s, 'Isabelle');
    const note = mk.note({ title: 'Plan', blocks: [mk.text('eins'), mk.text('zwei')] });
    a.notes.save(note);
    await settle();

    // beide ändern im selben Moment je einen anderen Block
    edit(a.notes, note.id, (x) => ((x.blocks[0] as { text: string }).text = 'eins von Kevin'));
    edit(b.notes, note.id, (x) => ((x.blocks[1] as { text: string }).text = 'zwei von Isabelle'));
    await settle();

    for (const d of [a, b]) {
      const t = d.notes.get(note.id)!.blocks.map((x) => (x as { text: string }).text);
      expect(t).toEqual(['eins von Kevin', 'zwei von Isabelle']);
    }
  });

  it('gleichzeitig neue Blöcke anlegen: beide bleiben erhalten', async () => {
    const s = new MemoryServer();
    const a = await device(s, 'Kevin');
    const b = await device(s, 'Isabelle');
    const note = mk.note({ title: 'Liste', blocks: [mk.text('start')] });
    a.notes.save(note);
    await settle();

    edit(a.notes, note.id, (x) => x.blocks.push(mk.text('von Kevin')));
    edit(b.notes, note.id, (x) => x.blocks.push(mk.text('von Isabelle')));
    await settle();

    for (const d of [a, b]) {
      const t = d.notes.get(note.id)!.blocks.map((x) => (x as { text: string }).text).sort();
      expect(t).toEqual(['start', 'von Isabelle', 'von Kevin']);
    }
  });

  it('Löschen wird übertragen', async () => {
    const s = new MemoryServer();
    const a = await device(s, 'Kevin');
    const b = await device(s, 'Isabelle');
    const note = mk.note({ title: 'Weg damit', blocks: [mk.text('x')] });
    a.notes.save(note);
    await settle();
    expect(b.notes.get(note.id)).toBeDefined();
    a.notes.remove(note.id);
    await settle();
    expect(b.notes.get(note.id)).toBeUndefined();
  });

  it('Einkaufsliste: Häkchen, neue Posten und Löschen werden übertragen', async () => {
    const s = new MemoryServer();
    const a = await device(s, 'Kevin');
    const b = await device(s, 'Isabelle');
    const r = newRecipe();
    r.title = 'Dal';
    (r.blocks[1] as { rows: string[][] }).rows = [['200', 'g', 'Linsen'], ['1', 'Dose', 'Kokosmilch']];
    a.notes.save(r);
    a.shop.addFromRecipe(r);
    await settle();
    expect(b.shop.all().map((i) => i.name)).toEqual(['Linsen', 'Kokosmilch']);

    const item = b.shop.all()[0];
    item.home = true;
    b.shop.save(item);
    await settle();
    expect(a.shop.get(item.id)?.home).toBe(true);

    a.shop.remove(item.id);
    await settle();
    expect(b.shop.get(item.id)).toBeUndefined();
  });

  it('Änderungen ohne Verbindung werden nachgeholt', async () => {
    const s = new MemoryServer();
    const a = await device(s, 'Kevin');
    const b = await device(s, 'Isabelle');
    const note = mk.note({ title: 'Offline', blocks: [mk.text('a')] });
    a.notes.save(note);
    await settle();

    b.backend.offline = true;
    edit(b.notes, note.id, (x) => ((x.blocks[0] as { text: string }).text = 'im Zug geschrieben'));
    await settle();
    expect((a.notes.get(note.id)!.blocks[0] as { text: string }).text).toBe('a');

    b.backend.goOnline();
    await settle();
    expect((a.notes.get(note.id)!.blocks[0] as { text: string }).text).toBe('im Zug geschrieben');
  });

  it('wer gerade tippt, wird nicht überschrieben; am Ende gewinnt die jüngere Änderung', async () => {
    const s = new MemoryServer();
    const a = await device(s, 'Kevin');
    const b = await device(s, 'Isabelle');
    const note = mk.note({ title: 'Zank', blocks: [mk.text('alt')] });
    a.notes.save(note);
    await settle();

    edit(a.notes, note.id, (x) => ((x.blocks[0] as { text: string }).text = 'Kevin tippt'));
    await vi.advanceTimersByTimeAsync(400); // Kevins Änderung ist unterwegs
    edit(b.notes, note.id, (x) => ((x.blocks[0] as { text: string }).text = 'Isabelle tippt'));
    // Isabelle tippt weiter, während Kevins Version bei ihr ankommt: ihr Text bleibt stehen
    expect((b.notes.get(note.id)!.blocks[0] as { text: string }).text).toBe('Isabelle tippt');
    await settle();

    const final = (d: typeof a) => (d.notes.get(note.id)!.blocks[0] as { text: string }).text;
    expect(final(a)).toBe(final(b)); // beide landen beim selben Stand
    expect(final(a)).toBe('Isabelle tippt'); // die jüngere Änderung
  });

  it('wiederhergestellte Notiz kommt mit allen Blöcken zurück', async () => {
    const s = new MemoryServer();
    const a = await device(s, 'Kevin');
    const b = await device(s, 'Isabelle');
    const note = mk.note({ title: 'Papierkorb', blocks: [mk.text('eins'), mk.text('zwei')] });
    a.notes.save(note);
    await settle();
    const copy = a.notes.get(note.id)!;
    a.notes.remove(note.id); // in den Papierkorb
    await settle();
    expect(b.notes.get(note.id)).toBeUndefined();

    a.engine.forgetBlocks(copy.blocks.map((x) => x.id)); // Wiederherstellen
    a.notes.save(copy);
    await settle();
    expect(b.notes.get(note.id)?.blocks.map((x) => (x as { text: string }).text)).toEqual(['eins', 'zwei']);
  });

  it('Anwesenheit: man sieht, wer in welchem Block ist', async () => {
    const s = new MemoryServer();
    const a = await device(s, 'Kevin');
    const b = await device(s, 'Isabelle');
    const note = mk.note({ title: 'Hier', blocks: [mk.text('x')] });
    a.notes.save(note);
    await settle();

    b.engine.setFocus(note.id, note.blocks[0].id);
    await settle();
    const others = a.engine.othersIn(note.id);
    expect(others.map((p) => [p.name, p.blockId])).toEqual([['Isabelle', note.blocks[0].id]]);
    expect(b.engine.othersIn(note.id)).toEqual([]); // sich selbst sieht man nicht

    b.engine.stop(); // Gerät verschwindet (App zu, Akku leer): keine Lebenszeichen mehr
    await vi.advanceTimersByTimeAsync(40_000);
    expect(a.engine.othersIn(note.id)).toEqual([]);
  });
});
