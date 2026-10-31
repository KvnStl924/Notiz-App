import { type Block, type Note, mk, newId } from './model';

/**
 * Notiz <-> Markdown. Format siehe docs/KONZEPT.md. Bewusst einfach, damit die
 * Dateien in Google Drive von Hand oder von Claude bearbeitet werden können.
 */

const checkRe = /^[-*] \[([ xX])\] ?(.*)$/;
const stepRe = /^\d+[.)] ?(.*)$/;
const headingRe = /^(#{1,6}) +(.*)$/;
const imageRe = /^!\[(.*?)\]\((.*?)\)$/;

const esc = (c: string) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const row = (cells: string[]) => `| ${cells.map(esc).join(' | ')} |`;

function fit(r: string[], n: number): string[] {
  if (r.length === n) return r;
  if (r.length > n) return r.slice(0, n);
  return [...r, ...Array(n - r.length).fill('')];
}

function cells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

export function writeMarkdown(note: Note): string {
  const out: string[] = ['---', `id: ${note.id}`, `typ: ${note.type === 'recipe' ? 'rezept' : 'notiz'}`];
  if (note.servings != null) out.push(`portionen: ${note.servings}`);
  out.push('---', `# ${note.title}`);

  for (const b of note.blocks) {
    out.push('');
    switch (b.kind) {
      case 'heading':
        out.push(`${'#'.repeat(b.level)} ${b.text}`);
        break;
      case 'text':
        out.push(b.text);
        break;
      case 'checklist':
        for (const i of b.items) out.push(`- [${i.done ? 'x' : ' '}] ${i.text}`);
        break;
      case 'steps':
        b.steps.forEach((s, n) => out.push(`${n + 1}. ${s}`));
        break;
      case 'table':
        out.push(row(b.header), row(b.header.map(() => '---')));
        for (const r of b.rows) out.push(row(fit(r, b.header.length)));
        break;
      case 'image':
        out.push(`![${b.caption}](${b.source})`);
        break;
    }
  }
  return out.join('\n') + '\n';
}

/** Fehlt die `id` im Kopf (z. B. bei einer von Claude neu angelegten Datei), wird eine neue vergeben. */
export function parseMarkdown(markdown: string): Note {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  const meta: Record<string, string> = {};
  if (lines[0]?.trim() === '---') {
    i = 1;
    while (i < lines.length && lines[i].trim() !== '---') {
      const c = lines[i].indexOf(':');
      if (c > 0) meta[lines[i].slice(0, c).trim()] = lines[i].slice(c + 1).split(/\s+#/)[0].trim();
      i++;
    }
    i++;
  }

  let title: string | null = null;
  const blocks: Block[] = [];
  const blank = (l: string) => l.trim() === '';

  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) {
      i++;
      continue;
    }

    const h = headingRe.exec(line);
    if (h) {
      const level = h[1].length;
      if (level === 1 && title === null) title = h[2].trim();
      else blocks.push(mk.heading(h[2].trim(), level));
      i++;
      continue;
    }

    if (checkRe.test(line)) {
      const items = [];
      while (i < lines.length && checkRe.test(lines[i])) {
        const m = checkRe.exec(lines[i])!;
        items.push(mk.item(m[2].trim(), m[1].toLowerCase() === 'x'));
        i++;
      }
      blocks.push(mk.checklist(items));
      continue;
    }

    if (stepRe.test(line)) {
      const steps: string[] = [];
      while (i < lines.length && stepRe.test(lines[i])) {
        steps.push(stepRe.exec(lines[i])![1].trim());
        i++;
      }
      blocks.push(mk.steps(steps));
      continue;
    }

    if (line.trimStart().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) rows.push(cells(lines[i++]));
      const sep = rows.length >= 2 && rows[1].every((c) => /^:?-+:?$/.test(c));
      const header = rows[0];
      blocks.push(mk.table(header, rows.slice(sep ? 2 : 1).map((r) => fit(r, header.length))));
      continue;
    }

    const img = imageRe.exec(line.trim());
    if (img) {
      blocks.push(mk.image(img[2], img[1]));
      i++;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      !blank(lines[i]) &&
      !headingRe.test(lines[i]) &&
      !checkRe.test(lines[i]) &&
      !stepRe.test(lines[i]) &&
      !lines[i].trimStart().startsWith('|')
    ) {
      para.push(lines[i++]);
    }
    blocks.push(mk.text(para.join('\n')));
  }

  return mk.note({
    id: meta.id || newId(),
    title: title ?? 'Ohne Titel',
    type: meta.typ === 'rezept' ? 'recipe' : 'note',
    servings: /^\d+$/.test(meta.portionen ?? '') ? Number(meta.portionen) : null,
    blocks,
  });
}
