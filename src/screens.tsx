import { Fragment } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Check,
  ChevronRight,
  CircleMinus,
  ClipboardPaste,
  Inbox,
  Copy,
  Ellipsis,
  FileText,
  Heading,
  ListChecks,
  ListOrdered,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Table2,
  Trash2,
  Type,
  Utensils,
} from 'lucide-preact';
import { type Block, type Note, type NoteType, mk, newRecipe } from './model';
import { writeMarkdown } from './markdown';
import { shop, store, useNote, useNotes } from './store';
import { sync, usePresence } from './sync/manager';
import { ImportPanel } from './import-ui';
import { InboxPanel } from './inbox-ui';
import { TrashPanel } from './trash-ui';
import { personColor } from './sync-ui';
import { AutoText, CheckCircle, Menu, type MenuItem, ReadOnlyCtx, Sheet, SwipeRow, Toast, useScrolled } from './ui';
import { joinAmount, nameColumn, parseAmount, toGrams, UNITS, fmt } from './units';

export type Tab = NoteType | 'shopping';
export const TAB_TITLE: Record<Tab, string> = { recipe: 'Rezepte', note: 'Notizen', shopping: 'Einkauf' };

/* ───────────────────────── Liste ───────────────────────── */

function plain(n: Note): string {
  return n.blocks
    .map((b) => {
      switch (b.kind) {
        case 'heading':
        case 'text':
          return b.text;
        case 'checklist':
          return b.items.map((i) => i.text).join(' ');
        case 'steps':
          return b.steps.join(' ');
        case 'table':
          return [...b.header, ...b.rows.flat()].join(' ');
        default:
          return '';
      }
    })
    .join(' ');
}

function subtitle(n: Note): string {
  if (n.type === 'recipe') {
    const t = n.blocks.find((b) => b.kind === 'table');
    const zutaten = t && t.kind === 'table' ? t.rows.filter((r) => r.some((c) => c.trim())).length : 0;
    const parts = [];
    if (n.servings) parts.push(`${n.servings} Portionen`);
    if (zutaten) parts.push(`${zutaten} Zutaten`);
    return parts.join(' · ') || 'Leeres Rezept';
  }
  const c = n.blocks.find((b) => b.kind === 'checklist');
  if (c && c.kind === 'checklist') {
    const done = c.items.filter((i) => i.done).length;
    return `Checkliste · ${done} von ${c.items.length} erledigt`;
  }
  const text = n.blocks.find((b) => b.kind === 'text' && b.text.trim());
  return text && text.kind === 'text' ? text.text.split('\n')[0] : 'Kein weiterer Text';
}

export function ListScreen(props: { type: NoteType; onOpen: (id: string) => void; onNew: () => void }) {
  const [menu, setMenu] = useState<{ anchor: DOMRect; items: MenuItem[] } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const all = useNotes();
  const [q, setQ] = useState('');
  const { scrolled, onScroll } = useScrolled();
  const needle = q.trim().toLowerCase();
  const notes = all.filter(
    (n) => n.type === props.type && (!needle || (n.title + ' ' + plain(n)).toLowerCase().includes(needle)),
  );
  const isRecipe = props.type === 'recipe';

  return (
    <div class={'screen-inner' + (scrolled ? ' scrolled' : '')} style={{ display: 'contents' }}>
      <div class="navbar">
        <div class="navbar-bg" />
        <div class="nav-title">{TAB_TITLE[props.type]}</div>
        <span />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button class="nav-btn round glass tint" onClick={() => setTrashOpen(true)} aria-label="Papierkorb">
            <Trash2 size={21} />
          </button>
        <button
          class="nav-btn round glass tint"
          aria-label="Neu"
          onClick={(e) =>
            setMenu({
              anchor: (e.currentTarget as HTMLElement).getBoundingClientRect(),
              items: [
                {
                  label: props.type === 'recipe' ? 'Neues Rezept' : 'Neue Notiz',
                  icon: <Plus size={20} />,
                  onSelect: props.onNew,
                },
                {
                  label: 'Aus Text einfügen',
                  icon: <ClipboardPaste size={20} />,
                  onSelect: () => setImportOpen(true),
                },
                ...(props.type === 'recipe'
                  ? [{ label: 'Rezept-Eingang', icon: <Inbox size={20} />, onSelect: () => setInboxOpen(true) }]
                  : []),
              ],
            })
          }
        >
          <Plus size={24} strokeWidth={2.2} />
        </button>
        </div>
      </div>
      <div class={'scroll' + (scrolled ? ' scrolled' : '')} onScroll={onScroll}>
        <h1 class="large-title">{TAB_TITLE[props.type]}</h1>
        <label class="search glass">
          <Search size={18} />
          <input
            type="search"
            placeholder="Suchen"
            value={q}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            enterkeyhint="search"
          />
        </label>

        {notes.length === 0 ? (
          <div class="empty">
            {isRecipe ? <Utensils size={46} strokeWidth={1.4} /> : <FileText size={46} strokeWidth={1.4} />}
            <h3>{needle ? 'Keine Ergebnisse' : isRecipe ? 'Noch keine Rezepte' : 'Noch keine Notizen'}</h3>
            <p>{needle ? `Zu „${q}“ wurde nichts gefunden.` : 'Tippe oben rechts auf das Plus, um zu beginnen.'}</p>
          </div>
        ) : (
          <div class="group glass">
            {notes.map((n) => (
              <SwipeRow key={n.id} onTap={() => props.onOpen(n.id)} onDelete={() => store.remove(n.id)}>
                <div
                  class="row-icon"
                  style={{
                    background: isRecipe
                      ? 'linear-gradient(160deg,#ffb340,#ff7a00)'
                      : 'linear-gradient(160deg,#ffe066,#ffc400)',
                  }}
                >
                  {isRecipe ? <Utensils size={22} /> : <FileText size={22} />}
                </div>
                <div class="row-text">
                  <div class="row-title">{n.title || 'Neue ' + (isRecipe ? 'Rezept' : 'Notiz')}</div>
                  <div class="row-sub">{subtitle(n)}</div>
                </div>
                <ChevronRight class="row-chevron" size={20} />
              </SwipeRow>
            ))}
          </div>
        )}
      </div>

      {menu && <Menu anchor={menu.anchor} items={menu.items} onClose={() => setMenu(null)} />}
      {inboxOpen && <InboxPanel onClose={() => setInboxOpen(false)} />}
      {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
      {importOpen && (
        <ImportPanel
          type={props.type}
          onClose={() => setImportOpen(false)}
          onImported={(id) => {
            setImportOpen(false);
            props.onOpen(id);
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Editor ───────────────────────── */

function isEmptyNote(n: Note): boolean {
  if (n.title.trim()) return false;
  return n.blocks.every((b) => {
    switch (b.kind) {
      case 'heading':
      case 'text':
        return !b.text.trim() || (n.type === 'recipe' && (b.text === 'Zutaten' || b.text === 'Zubereitung'));
      case 'checklist':
        return b.items.every((i) => !i.text.trim());
      case 'steps':
        return b.steps.every((s) => !s.trim());
      case 'table':
        return b.rows.every((r) => r.every((c) => !c.trim()));
      default:
        return false;
    }
  });
}

/** Räumt beim Speichern leere Zeilen und Blöcke weg. */
function tidy(n: Note) {
  for (const b of n.blocks) {
    if (b.kind === 'table') b.rows = b.rows.filter((r) => r.some((c) => c.trim()));
    if (b.kind === 'steps') {
      const keep = b.steps.map((x) => x.trim() !== '');
      if (b.done) b.done = b.done.filter((_, i) => keep[i]);
      b.steps = b.steps.filter((_, i) => keep[i]);
    }
    if (b.kind === 'checklist') b.items = b.items.filter((i) => i.text.trim());
  }
  n.blocks = n.blocks.filter((b) => {
    switch (b.kind) {
      case 'heading':
      case 'text':
        return b.text.trim() !== '';
      case 'steps':
        return b.steps.length > 0;
      case 'checklist':
        return b.items.length > 0;
      default:
        return true;
    }
  });
}

/** Vorlage anlegen und speichern. */
export function createNote(type: NoteType): Note {
  const n = type === 'recipe' ? newRecipe() : mk.note({ blocks: [mk.text('')] });
  store.save(n);
  return n;
}

export function EditorScreen(props: {
  id: string;
  backLabel: string;
  onBack: () => void;
  focusTitle: boolean;
  onShowShopping: () => void;
}) {
  const note = useNote(props.id);
  const [, force] = useState(0);
  const others = usePresence(props.id);
  const [menu, setMenu] = useState<{ anchor: DOMRect; items: MenuItem[] } | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const { scrolled, onScroll } = useScrolled();
  // Rezepte öffnen im Lesemodus (nichts lässt sich versehentlich ändern); neue Rezepte direkt im Bearbeiten-Modus
  const [editing, setEditing] = useState(!note || note.type !== 'recipe' || props.focusTitle);
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const plusRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  // Notiz verschwunden (z. B. vom anderen Gerät gelöscht): zurück zur Liste
  useEffect(() => {
    if (!note) props.onBack();
  }, [!note]);
  // Dem anderen zeigen, dass man in dieser Notiz ist; beim Verlassen abmelden
  useEffect(() => {
    sync.engine?.setFocus(props.id, null);
    return () => sync.engine?.setFocus(null, null);
  }, [props.id, sync.engine]);

  if (!note) return null;
  const update = () => {
    store.save(note);
    force((n) => n + 1);
  };

  const readOnly = note.type === 'recipe' && !editing;

  const back = () => {
    if (isEmptyNote(note)) store.discard(note.id);
    else if (note.type === 'recipe') tidy(note), store.save(note);
    props.onBack();
  };

  const save = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    tidy(note);
    update();
    setMenu(null);
    setEditing(false);
  };

  const showToast = (text: string, action?: { label: string; run: () => void }) => {
    setToast({ text, action });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  const addToShopping = () => {
    const r = shop.addFromRecipe(note);
    force((n) => n + 1);
    const n = r.added.length;
    const text =
      r.found === 0
        ? 'Keine Zutaten gefunden. Trage sie in die Zutaten-Tabelle ein.'
        : n > 0
          ? `${n} ${n === 1 ? 'Zutat' : 'Zutaten'} zur Einkaufsliste hinzugefügt`
          : r.updated.length > 0
            ? 'Mengen auf der Einkaufsliste aktualisiert'
            : 'Alle Zutaten stehen schon auf der Einkaufsliste';
    showToast(text, r.found ? { label: 'Anzeigen', run: props.onShowShopping } : undefined);
  };
  const onList = note.type === 'recipe' && shop.forRecipe(note.id).length > 0;

  const addBlock = (b: Block) => {
    note.blocks.push(b);
    update();
    setFocusId(b.id);
  };

  const showAddMenu = () =>
    setMenu({
      anchor: plusRef.current!.getBoundingClientRect(),
      items: [
        { label: 'Überschrift', icon: <Heading size={20} />, onSelect: () => addBlock(mk.heading('')) },
        { label: 'Text', icon: <Type size={20} />, onSelect: () => addBlock(mk.text('')) },
        { label: 'Checkliste', icon: <ListChecks size={20} />, onSelect: () => addBlock(mk.checklist()) },
        {
          label: 'Tabelle',
          icon: <Table2 size={20} />,
          onSelect: () => addBlock(mk.table(['Spalte 1', 'Spalte 2'], [['', '']])),
        },
        { label: 'Schritt für Schritt', icon: <ListOrdered size={20} />, onSelect: () => addBlock(mk.steps()) },
      ],
    });

  const showMoreMenu = () =>
    setMenu({
      anchor: moreRef.current!.getBoundingClientRect(),
      items: [
        ...(note.type === 'recipe'
          ? [{ label: 'Zur Einkaufsliste', icon: <ShoppingCart size={20} />, onSelect: addToShopping }]
          : []),
        {
          label: 'Als Markdown kopieren',
          icon: <Copy size={20} />,
          onSelect: () => void navigator.clipboard?.writeText(writeMarkdown(note)).catch(() => {}),
        },
        { label: 'Löschen', icon: <Trash2 size={20} />, destructive: true, separatorBefore: true, onSelect: () =>
            setAsk({
              title: `„${note.title || 'Ohne Titel'}“ wird gelöscht.`,
              label: 'Löschen',
              run: () => {
                store.remove(note.id);
                props.onBack();
              },
            }),
        },
      ],
    });

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= note.blocks.length) return;
    [note.blocks[i], note.blocks[j]] = [note.blocks[j], note.blocks[i]];
    update();
  };

  const blockMenu = (e: MouseEvent, i: number) => {
    const anchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const items: MenuItem[] = [];
    if (i > 0) items.push({ label: 'Nach oben', icon: <ArrowUp size={20} />, onSelect: () => move(i, -1) });
    if (i < note.blocks.length - 1) items.push({ label: 'Nach unten', icon: <ArrowDown size={20} />, onSelect: () => move(i, 1) });
    items.push({
      label: 'Block löschen',
      icon: <Trash2 size={20} />,
      destructive: true,
      separatorBefore: items.length > 0,
      onSelect: () => {
        note.blocks.splice(i, 1);
        update();
      },
    });
    setMenu({ anchor, items });
  };

  return (
    <div class={scrolled ? 'scrolled' : ''} style={{ display: 'contents' }}>
      <div class="navbar">
        <div class="navbar-bg" />
        <div class="nav-title">{note.title || (note.type === 'recipe' ? 'Rezept' : 'Notiz')}</div>
        <button class="nav-btn glass tint" onClick={back} style={{ paddingLeft: '6px' }}>
          <ChevronLeft size={26} strokeWidth={2.2} />
          <span>{props.backLabel}</span>
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div class="glass" style={{ borderRadius: '22px', display: 'flex' }}>
            <button ref={moreRef} class="nav-btn round tint" onClick={showMoreMenu} aria-label="Mehr">
              <Ellipsis size={22} />
            </button>
            {readOnly ? (
              <button class="nav-btn tint" style={{ fontWeight: 500 }} onClick={() => setEditing(true)}>
                Bearbeiten
              </button>
            ) : (
              <button ref={plusRef} class="nav-btn round tint" onClick={showAddMenu} aria-label="Block hinzufügen">
                <Plus size={24} strokeWidth={2.2} />
              </button>
            )}
          </div>
          {note.type === 'recipe' && editing && (
            <button class="nav-btn prominent" onClick={save}>
              Speichern
            </button>
          )}
        </div>
      </div>

      <ReadOnlyCtx.Provider value={readOnly}>
      <div class={'scroll' + (scrolled ? ' scrolled' : '') + (readOnly ? ' readonly' : '')} onScroll={onScroll}>
        <AutoText
          class="title-input"
          value={note.title}
          placeholder="Titel"
          autoFocus={props.focusTitle && editing}
          singleLine
          enterKeyHint="next"
          onInput={(v) => {
            note.title = v;
            update();
          }}
        />

        {note.type === 'recipe' && readOnly && (
          <>
            <div class="meta-row" style={{ marginBottom: '12px' }}>
              <span>{note.servings ?? 1} Portionen</span>
            </div>
            <button class="cta glass" onClick={addToShopping}>
              <ShoppingCart size={22} />
              <span>{onList ? 'Einkaufsliste aktualisieren' : 'Zur Einkaufsliste hinzufügen'}</span>
              {onList && <Check size={20} strokeWidth={2.6} style={{ marginLeft: 'auto', color: 'var(--green)' }} />}
            </button>
          </>
        )}
        {note.type === 'recipe' && !readOnly && (
          <div class="meta-row">
            <span>Portionen</span>
            <div class="stepper glass">
              <button
                aria-label="Weniger"
                onClick={() => {
                  note.servings = Math.max(1, (note.servings ?? 1) - 1);
                  update();
                }}
              >
                <Minus size={18} strokeWidth={2.4} />
              </button>
              <span>{note.servings ?? 1}</span>
              <button
                aria-label="Mehr"
                onClick={() => {
                  note.servings = (note.servings ?? 1) + 1;
                  update();
                }}
              >
                <Plus size={18} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div class="here">
            {others.map((p) => (
              <span class="here-chip" key={p.clientId} style={{ '--pc': personColor(p.name) } as Record<string, string>}>
                <i /> {p.name} ist hier
              </span>
            ))}
          </div>
        )}

        {note.blocks.map((b, i) => {
          const who = others.find((p) => p.blockId === b.id);
          return (
          <div
            class={'block' + (who ? ' remote' : '')}
            key={b.id}
            style={who ? ({ '--pc': personColor(who.name) } as Record<string, string>) : undefined}
            onFocusIn={() => sync.engine?.setFocus(note.id, b.id)}
            onFocusOut={() => sync.engine?.setFocus(note.id, null)}
          >
            {who && <span class="who">{who.name}</span>}
            <div class="block-body">
              <BlockView block={b} focus={focusId === b.id} update={update} ask={setAsk} readOnly={readOnly} />
            </div>
            <button class="block-more glass" onClick={(e) => blockMenu(e as unknown as MouseEvent, i)} aria-label="Block-Optionen">
              <Ellipsis size={20} />
            </button>
          </div>
          );
        })}
      </div>
      </ReadOnlyCtx.Provider>

      {toast && <Toast text={toast.text} action={toast.action} />}
      {menu && <Menu anchor={menu.anchor} items={menu.items} onClose={() => setMenu(null)} />}
      {ask && (
        <Sheet
          title={ask.title}
          actions={[{ label: ask.label, destructive: true, onSelect: ask.run }]}
          onClose={() => setAsk(null)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Blöcke ───────────────────────── */

function BlockView(props: { block: Block; focus: boolean; update: () => void; ask: (a: Ask) => void; readOnly: boolean }) {
  const { block: b, update } = props;

  switch (b.kind) {
    case 'heading':
      return (
        <AutoText
          class="h-input"
          value={b.text}
          placeholder="Überschrift"
          autoFocus={props.focus}
          singleLine
          onInput={(v) => {
            b.text = v;
            update();
          }}
        />
      );

    case 'text':
      return (
        <AutoText
          class="t-input"
          value={b.text}
          placeholder="Text"
          autoFocus={props.focus}
          onInput={(v) => {
            b.text = v;
            update();
          }}
        />
      );

    case 'checklist':
      return <ChecklistView b={b} focus={props.focus} update={update} />;
    case 'steps':
      return <StepsView b={b} focus={props.focus} update={update} />;
    case 'table':
      return <TableView b={b} update={update} ask={props.ask} readOnly={props.readOnly} />;

    case 'image':
      return (
        <div class="card glass">
          <img src={b.source} alt={b.caption} style={{ width: '100%', display: 'block' }} />
        </div>
      );
  }
}

type Of<K extends Block['kind']> = Extract<Block, { kind: K }>;

/** Bestätigungsblatt für Löschen mit Inhalt. */
interface Ask {
  title: string;
  label: string;
  run: () => void;
}

function ChecklistView(props: { b: Of<'checklist'>; focus: boolean; update: () => void }) {
  const { b, update } = props;
  const [focusItem, setFocusItem] = useState<string | null>(props.focus ? (b.items[0]?.id ?? null) : null);
  return (
    <div class="card glass">
      {b.items.map((it, idx) => (
        <div class={'li' + (it.done ? ' is-done' : '')} key={it.id}>
          <CheckCircle
            done={it.done}
            onToggle={() => {
              it.done = !it.done;
              update();
            }}
          />
          <AutoText
            value={it.text}
            placeholder="Eintrag"
            autoFocus={focusItem === it.id}
            enterKeyHint="next"
            onInput={(v) => {
              it.text = v;
              update();
            }}
            onEnter={() => {
              const n = mk.item('');
              b.items.splice(idx + 1, 0, n);
              setFocusItem(n.id);
              update();
            }}
            onBackspaceEmpty={() => {
              if (b.items.length > 1) {
                b.items.splice(idx, 1);
                setFocusItem(b.items[Math.max(0, idx - 1)].id);
                update();
              }
            }}
          />
        </div>
      ))}
      <button
        class="add-line"
        onClick={() => {
          const n = mk.item('');
          b.items.push(n);
          setFocusItem(n.id);
          update();
        }}
      >
        <Plus size={20} /> Eintrag
      </button>
    </div>
  );
}

function StepsView(props: { b: Of<'steps'>; focus: boolean; update: () => void }) {
  const { b, update } = props;
  const readOnly = useContext(ReadOnlyCtx);
  // Schritte sind einfache Texte; Fokus per Index
  const [focusIdx, setFocusIdx] = useState<number | null>(props.focus ? 0 : null);

  /** Fortschritt auf gleiche Länge wie die Schritte bringen, bevor Schritte eingefügt/entfernt werden. */
  const syncDone = () => {
    b.done = b.steps.map((_, i) => b.done?.[i] ?? false);
    return b.done;
  };
  const isDone = (i: number) => readOnly && !!b.done?.[i];
  const anyDone = readOnly && !!b.done?.some(Boolean);

  return (
    <>
      <div class="card glass">
        {b.steps.map((s, idx) => (
          <div
            class={'li' + (readOnly ? ' tappable' : '') + (isDone(idx) ? ' step-done' : '')}
            key={idx}
            onClick={() => {
              if (!readOnly) return;
              syncDone()[idx] = !b.done![idx];
              update();
            }}
          >
            <div class="step-num">{isDone(idx) ? <Check size={14} strokeWidth={3.4} /> : idx + 1}</div>
            <AutoText
              value={s}
              placeholder={`Schritt ${idx + 1}`}
              autoFocus={focusIdx === idx}
              enterKeyHint="next"
              onInput={(v) => {
                b.steps[idx] = v;
                update();
              }}
              onEnter={() => {
                syncDone().splice(idx + 1, 0, false);
                b.steps.splice(idx + 1, 0, '');
                setFocusIdx(idx + 1);
                update();
              }}
              onBackspaceEmpty={() => {
                if (b.steps.length > 1) {
                  syncDone().splice(idx, 1);
                  b.steps.splice(idx, 1);
                  setFocusIdx(Math.max(0, idx - 1));
                  update();
                }
              }}
            />
          </div>
        ))}
        <button
          class="add-line"
          onClick={() => {
            syncDone().push(false);
            b.steps.push('');
            setFocusIdx(b.steps.length - 1);
            update();
          }}
        >
          <Plus size={20} /> Schritt
        </button>
      </div>
      {anyDone && (
        <button
          class="reset-line"
          onClick={() => {
            b.done = b.steps.map(() => false);
            update();
          }}
        >
          Fortschritt zurücksetzen
        </button>
      )}
    </>
  );
}

function TableView(props: { b: Of<'table'>; update: () => void; ask: (a: Ask) => void; readOnly: boolean }) {
  const { b, update } = props;
  const ro = props.readOnly;
  const nameCol = nameColumn(b.header);
  const isQty = (c: number) => b.header[c]?.trim().toLowerCase() === 'menge';
  const cols = b.header.length;

  const removeColumn = (c: number) => {
    const run = () => {
      b.header.splice(c, 1);
      b.rows.forEach((r) => r.splice(c, 1));
      update();
    };
    // Nur nachfragen, wenn in der Spalte etwas steht
    if (b.rows.some((r) => r[c]?.trim())) {
      props.ask({ title: `Spalte „${b.header[c] || c + 1}“ enthält Text und wird gelöscht.`, label: 'Spalte löschen', run });
    } else run();
  };

  return (
    <div class="card glass">
      <div class="table-scroll">
        <div class="tbl" style={{ gridTemplateColumns: `repeat(${cols}, minmax(96px, 1fr))${ro ? '' : ' 44px'}` }}>
          {b.header.map((h, c) => (
            <div class="th" key={'h' + c}>
              <AutoText
                value={h}
                singleLine
                placeholder="Spalte"
                onInput={(v) => {
                  b.header[c] = v;
                  update();
                }}
              />
            </div>
          ))}
          {!ro && <div class="th del" />}
          {b.rows.map((r, ri) => (
            <Fragment key={'r' + ri}>
              {r.map((cell, c) => (
                <div key={`c${ri}-${c}`}>
                  {isQty(c) ? (
                    <>
                      <QtyCell
                        value={cell}
                        ro={ro}
                        onChange={(v) => {
                          r[c] = v;
                          update();
                        }}
                      />
                      {ro && <QtyHint amount={cell} ingredient={r[nameCol] ?? ''} />}
                    </>
                  ) : (
                    <AutoText
                      value={cell}
                      onInput={(v) => {
                        r[c] = v;
                        update();
                      }}
                    />
                  )}
                </div>
              ))}
              {!ro && (
              <div class="del" key={`d${ri}`}>
                {b.rows.length > 1 && (
                  <button
                    aria-label="Zeile entfernen"
                    onClick={() => {
                      b.rows.splice(ri, 1);
                      update();
                    }}
                  >
                    <CircleMinus size={22} />
                  </button>
                )}
              </div>
              )}
            </Fragment>
          ))}
          {!ro && cols > 1 && (
            <>
              {b.header.map((h, c) => (
                <div class="colfoot" key={'f' + c}>
                  <button aria-label={`Spalte ${h || c + 1} entfernen`} onClick={() => removeColumn(c)}>
                    <CircleMinus size={22} />
                  </button>
                </div>
              ))}
              <div class="colfoot" />
            </>
          )}
        </div>
      </div>
      <div class="tbl-actions">
        <button
          class="add-line"
          onClick={() => {
            b.rows.push(Array(cols).fill(''));
            update();
          }}
        >
          <Plus size={20} /> Zeile
        </button>
        <button
          class="add-line"
          onClick={() => {
            b.header.push(`Spalte ${cols + 1}`);
            b.rows.forEach((r) => r.push(''));
            update();
          }}
        >
          <Plus size={20} /> Spalte
        </button>
      </div>
    </div>
  );
}

/** Menge: Zahl und Einheit in einer Zelle. Im Bearbeiten-Modus wählt man die Einheit aus der Liste. */
function QtyCell(props: { value: string; ro: boolean; onChange: (v: string) => void }) {
  const p = parseAmount(props.value);
  // Ohne Zahl steht der ganze Text im Zahlfeld, dann gibt es keine Einheit
  const unit = p.qty === null ? '' : p.unit;
  return (
    <div class="qty">
      <input
        class="qty-num"
        inputmode="decimal"
        value={p.qty === null ? props.value : p.numText}
        readOnly={props.ro}
        placeholder="Menge"
        onInput={(e) => props.onChange(joinAmount((e.target as HTMLInputElement).value, unit))}
      />
      <select
        class="qty-unit"
        value={unit}
        disabled={props.ro}
        onChange={(e) => props.onChange(joinAmount(p.qty === null ? props.value : p.numText, (e.target as HTMLSelectElement).value))}
      >
        {UNITS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Lesemodus: umgerechnete Gramm unter der Menge, nur wenn es exakt geht. */
function QtyHint(props: { amount: string; ingredient: string }) {
  const g = toGrams(props.amount, props.ingredient);
  if (!g) return null;
  return <div class="qty-hint">≈ {fmt(g.grams, g.grams >= 10 ? 0 : 1)} g</div>;
}
