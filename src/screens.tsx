import { Fragment } from 'preact';
import { useRef, useState } from 'preact/hooks';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CircleMinus,
  Copy,
  Ellipsis,
  FileText,
  Heading,
  ListChecks,
  ListOrdered,
  Minus,
  Plus,
  Search,
  Table2,
  Trash2,
  Type,
  Utensils,
} from 'lucide-preact';
import { type Block, type Note, type NoteType, mk, newRecipe } from './model';
import { writeMarkdown } from './markdown';
import { store, useNotes } from './store';
import { AutoText, CheckCircle, Menu, type MenuItem, Sheet, SwipeRow, useScrolled } from './ui';

export const TAB_TITLE: Record<NoteType, string> = { recipe: 'Rezepte', note: 'Notizen' };

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
        <button class="nav-btn round glass tint" onClick={props.onNew} aria-label="Neu">
          <Plus size={24} strokeWidth={2.2} />
        </button>
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

/** Vorlage anlegen und speichern. */
export function createNote(type: NoteType): Note {
  const n = type === 'recipe' ? newRecipe() : mk.note({ blocks: [mk.text('')] });
  store.save(n);
  return n;
}

export function EditorScreen(props: { id: string; backLabel: string; onBack: () => void; focusTitle: boolean }) {
  const note = store.get(props.id);
  const [, force] = useState(0);
  const [menu, setMenu] = useState<{ anchor: DOMRect; items: MenuItem[] } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const { scrolled, onScroll } = useScrolled();
  const plusRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  if (!note) return null;
  const update = () => {
    store.save(note);
    force((n) => n + 1);
  };

  const back = () => {
    if (isEmptyNote(note)) store.remove(note.id);
    props.onBack();
  };

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
        {
          label: 'Als Markdown kopieren',
          icon: <Copy size={20} />,
          onSelect: () => navigator.clipboard?.writeText(writeMarkdown(note)),
        },
        { label: 'Löschen', icon: <Trash2 size={20} />, destructive: true, separatorBefore: true, onSelect: () => setConfirm(true) },
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
        <div class="glass" style={{ borderRadius: '22px', display: 'flex' }}>
          <button ref={moreRef} class="nav-btn round tint" onClick={showMoreMenu} aria-label="Mehr">
            <Ellipsis size={22} />
          </button>
          <button ref={plusRef} class="nav-btn round tint" onClick={showAddMenu} aria-label="Block hinzufügen">
            <Plus size={24} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div class={'scroll' + (scrolled ? ' scrolled' : '')} onScroll={onScroll}>
        <AutoText
          class="title-input"
          value={note.title}
          placeholder="Titel"
          autoFocus={props.focusTitle}
          singleLine
          enterKeyHint="next"
          onInput={(v) => {
            note.title = v;
            update();
          }}
        />

        {note.type === 'recipe' && (
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

        {note.blocks.map((b, i) => (
          <div class="block" key={b.id}>
            <div class="block-body">
              <BlockView block={b} focus={focusId === b.id} update={update} />
            </div>
            <button class="block-more glass" onClick={(e) => blockMenu(e as unknown as MouseEvent, i)} aria-label="Block-Optionen">
              <Ellipsis size={20} />
            </button>
          </div>
        ))}
      </div>

      {menu && <Menu anchor={menu.anchor} items={menu.items} onClose={() => setMenu(null)} />}
      {confirm && (
        <Sheet
          title={`„${note.title || 'Ohne Titel'}“ wird gelöscht.`}
          actions={[
            {
              label: 'Löschen',
              destructive: true,
              onSelect: () => {
                store.remove(note.id);
                props.onBack();
              },
            },
          ]}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Blöcke ───────────────────────── */

function BlockView(props: { block: Block; focus: boolean; update: () => void }) {
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
      return <TableView b={b} update={update} />;

    case 'image':
      return (
        <div class="card glass">
          <img src={b.source} alt={b.caption} style={{ width: '100%', display: 'block' }} />
        </div>
      );
  }
}

type Of<K extends Block['kind']> = Extract<Block, { kind: K }>;

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
  // Schritte sind einfache Texte; stabile Schlüssel über Position + Länge reichen hier, Fokus per Index
  const [focusIdx, setFocusIdx] = useState<number | null>(props.focus ? 0 : null);
  return (
    <div class="card glass">
      {b.steps.map((s, idx) => (
        <div class="li" key={idx}>
          <div class="step-num">{idx + 1}</div>
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
              b.steps.splice(idx + 1, 0, '');
              setFocusIdx(idx + 1);
              update();
            }}
            onBackspaceEmpty={() => {
              if (b.steps.length > 1) {
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
          b.steps.push('');
          setFocusIdx(b.steps.length - 1);
          update();
        }}
      >
        <Plus size={20} /> Schritt
      </button>
    </div>
  );
}

function TableView(props: { b: Of<'table'>; update: () => void }) {
  const { b, update } = props;
  const cols = b.header.length;
  return (
    <div class="card glass">
      <div class="table-scroll">
        <div class="tbl" style={{ gridTemplateColumns: `repeat(${cols}, minmax(96px, 1fr)) 44px` }}>
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
          <div class="th del" />
          {b.rows.map((r, ri) => (
            <Fragment key={'r' + ri}>
              {r.map((cell, c) => (
                <div key={`c${ri}-${c}`}>
                  <AutoText
                    value={cell}
                    onInput={(v) => {
                      r[c] = v;
                      update();
                    }}
                  />
                </div>
              ))}
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
            </Fragment>
          ))}
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
