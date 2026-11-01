import { describe, expect, it } from 'vitest';
import { daysLeft, purgeExpired, TRASH_DAYS, type TrashEntry } from './trash';
import { mk } from './model';

const DAY = 86_400_000;
const now = Date.parse('2026-11-01T12:00:00Z');
const entry = (daysAgo: number): TrashEntry => ({
  note: mk.note({ title: `vor ${daysAgo} Tagen` }),
  deletedAt: new Date(now - daysAgo * DAY).toISOString(),
});

describe('Papierkorb', () => {
  it('Einträge bleiben 30 Tage, danach werden sie entfernt', () => {
    const kept = purgeExpired([entry(0), entry(29), entry(31), entry(90)], now).map((e) => e.note.title);
    expect(kept).toEqual(['vor 0 Tagen', 'vor 29 Tagen']);
  });
  it('TRASH_DAYS ist 30', () => {
    expect(TRASH_DAYS).toBe(30);
  });
  it('zeigt die verbleibenden Tage', () => {
    expect(daysLeft(entry(0), now)).toBe(30);
    expect(daysLeft(entry(29), now)).toBe(1);
    expect(daysLeft(entry(29.5), now)).toBe(1);
  });
});
