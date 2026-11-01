import { describe, expect, it } from 'vitest';
import { densityOf, joinAmount, nameColumn, parseAmount, shopAmount, toGrams } from './units';

describe('Mengen lesen', () => {
  it('Zahl und Einheit werden getrennt', () => {
    expect(parseAmount('500 g')).toMatchObject({ qty: 500, unit: 'g' });
    expect(parseAmount('2 TL')).toMatchObject({ qty: 2, unit: 'TL' });
    expect(parseAmount('0,5 kg')).toMatchObject({ qty: 0.5, unit: 'kg' });
    expect(parseAmount('1/2 EL')).toMatchObject({ qty: 0.5, unit: 'EL' });
    expect(parseAmount('2 el')).toMatchObject({ qty: 2, unit: 'EL' });
    expect(parseAmount('3 Stk.')).toMatchObject({ qty: 3, unit: 'Stück' });
  });
  it('ohne Zahl bleibt der Text, ohne Einheit bleibt sie leer', () => {
    expect(parseAmount('nach Geschmack')).toMatchObject({ qty: null, unit: '' });
    expect(parseAmount('4')).toMatchObject({ qty: 4, unit: '' });
  });
  it('joinAmount setzt zusammen', () => {
    expect(joinAmount('500', 'g')).toBe('500 g');
    expect(joinAmount('2', '')).toBe('2');
  });
});

describe('Umrechnung in Gramm (feste Formel)', () => {
  it('Gewicht ist exakt', () => {
    expect(toGrams('500 g', 'Mehl')?.grams).toBe(500);
    expect(toGrams('0,5 kg', 'Mehl')?.grams).toBe(500);
  });
  it('2 TL Salz = 10 ml × 1,2 g/ml = 12 g', () => {
    const r = toGrams('2 TL', 'Salz');
    expect(r?.grams).toBeCloseTo(12, 6);
    expect(r?.formula).toContain('10 ml');
  });
  it('1 EL Öl = 15 ml × 0,92 g/ml', () => {
    expect(toGrams('1 EL', 'Olivenöl')?.grams).toBeCloseTo(13.8, 6);
  });
  it('unbekannte Zutat oder Stück: keine Umrechnung', () => {
    expect(densityOf('Currypulver')).toBeNull();
    expect(toGrams('2 EL', 'Currypulver')).toBeNull();
    expect(toGrams('2 Stück', 'Ei')).toBeNull();
  });
  it('shopAmount zeigt Gramm und die ursprüngliche Angabe', () => {
    expect(shopAmount('2 TL', 'Salz')).toBe('12 g (2 TL)');
    expect(shopAmount('500 g', 'Mehl')).toBe('500 g');
    expect(shopAmount('1 Stück', 'Ei')).toBe('1 Stück');
  });
  it('Namensspalte wird erkannt', () => {
    expect(nameColumn(['Menge', 'Zutat'])).toBe(1);
    expect(nameColumn(['Zutat', 'Menge'])).toBe(0);
    expect(nameColumn(['A', 'B'])).toBe(1);
  });
});
