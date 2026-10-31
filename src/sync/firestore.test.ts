import { describe, expect, it } from 'vitest';
import { getDocs, collection, setDoc, doc, getDoc, initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { mk, newRecipe } from '../model';
import { NoteStore, ShopStore } from '../store';
import { SyncEngine } from './engine';
import { createFirestoreBackend } from './firestore-backend';

// Läuft nur, wenn der Firestore-Emulator läuft:  NOTIZ_EMULATOR=127.0.0.1:8180 npm test
const EMU = process.env.NOTIZ_EMULATOR;
const cfg = { apiKey: 'x', projectId: 'demo-notiz', emulator: EMU };

async function waitFor(cond: () => boolean, ms = 8000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('Zeitüberschreitung');
    await new Promise((r) => setTimeout(r, 40));
  }
}

let n = 0;
async function device(space: string, name: string) {
  const id = ++n;
  const notes = new NoteStore(`fs.notes.${id}`, false);
  const shop = new ShopStore(`fs.shop.${id}`);
  const backend = createFirestoreBackend(cfg, space, { persistent: false, appName: `dev-${id}` });
  const engine = new SyncEngine(notes, shop, backend, { clientId: `c${id}`, name });
  await engine.start();
  return { notes, shop, engine };
}

describe.skipIf(!EMU)('Firestore-Emulator', () => {
  const space = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'; // 32 Zeichen

  it('Notiz und Einkaufsliste laufen live zwischen zwei Geräten', async () => {
    const a = await device(space, 'Kevin');
    const b = await device(space, 'Isabelle');

    const r = newRecipe();
    r.title = 'Carbonara';
    (r.blocks[1] as { rows: string[][] }).rows = [['400', 'g', 'Spaghetti'], ['4', 'Stück', 'Eigelb']];
    a.notes.save(r);
    await waitFor(() => b.notes.get(r.id)?.blocks.length === 4);
    expect(b.notes.get(r.id)?.title).toBe('Carbonara');

    // Isabelle ändert die Menge, Kevin sieht es
    const rb = b.notes.get(r.id)!;
    (rb.blocks[1] as { rows: string[][] }).rows[0][0] = '500';
    b.notes.save(rb);
    await waitFor(() => (a.notes.get(r.id)!.blocks[1] as { rows: string[][] }).rows[0][0] === '500');

    // Einkaufsliste
    a.shop.addFromRecipe(a.notes.get(r.id)!);
    await waitFor(() => b.shop.all().length === 2);
    const it = b.shop.all()[0];
    it.bought = true;
    b.shop.save(it);
    await waitFor(() => a.shop.get(it.id)?.bought === true);

    // Anwesenheit
    b.engine.setFocus(r.id, r.blocks[0].id);
    await waitFor(() => a.engine.othersIn(r.id).length === 1);
    expect(a.engine.othersIn(r.id)[0].name).toBe('Isabelle');

    // Löschen
    a.notes.remove(r.id);
    await waitFor(() => b.notes.get(r.id) === undefined);
    a.engine.stop();
    b.engine.stop();
  }, 30000);

  it('neues Gerät bekommt beim Beitritt alle vorhandenen Daten', async () => {
    const a = await device(space + 'x', 'Kevin');
    const note = mk.note({ title: 'Schon da', blocks: [mk.text('Hallo')] });
    a.notes.save(note);
    await new Promise((r) => setTimeout(r, 800));
    const c = await device(space + 'x', 'Isabelle');
    await waitFor(() => c.notes.get(note.id)?.title === 'Schon da');
    a.engine.stop();
    c.engine.stop();
  }, 30000);

  describe('Zugriffsschutz (ohne Login)', () => {
    const app = initializeApp({ apiKey: 'x', projectId: 'demo-notiz' }, 'rules');
    const db = initializeFirestore(app, {});
    connectFirestoreEmulator(db, ...(EMU!.split(':') as [string, string]).map((v, i) => (i ? Number(v) : v)) as [string, number]);

    it('Bereich mit langem Code: lesen und schreiben erlaubt', async () => {
      const ref = doc(db, 'spaces', space + 'rules', 'notes', 'ok');
      await setDoc(ref, { title: 'x', updatedAt: 1 });
      expect((await getDoc(ref)).exists()).toBe(true);
    });
    it('Liste aller Bereiche ist nicht abrufbar', async () => {
      await expect(getDocs(collection(db, 'spaces'))).rejects.toThrow(/permission|insufficient|no matching allow/i);
    });
    it('zu kurzer Code (erratbar) wird abgelehnt', async () => {
      await expect(setDoc(doc(db, 'spaces', 'kurz', 'notes', 'x'), { title: 'x' })).rejects.toThrow(/permission|insufficient|no matching allow/i);
    });
    it('unbekannte Sammlung wird abgelehnt', async () => {
      await expect(setDoc(doc(db, 'spaces', space, 'geheim', 'x'), { a: 1 })).rejects.toThrow(/permission|insufficient|no matching allow/i);
    });
    it('übergroße Dokumente werden abgelehnt', async () => {
      await expect(setDoc(doc(db, 'spaces', space, 'blocks', 'big'), { data: 'x'.repeat(250_000) })).rejects.toThrow(/permission|insufficient|exceed/i);
    });
  });
});
