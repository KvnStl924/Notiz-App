import { describe, expect, it } from 'vitest';
import { estimateCalories, foodOf, gramsOf } from './calories';
import { parenGrams, shopAmount } from './units';

describe('Kalorien', () => {
  it('erkennt Zutaten am Wort, auch in Mehrzahl und mit Zusatz', () => {
    expect(foodOf('Weizenmehl')?.kcal).toBe(350);
    expect(foodOf('Gehackte Tomaten')?.kcal).toBe(20);
    expect(foodOf('Zwiebel, gehackt')?.kcal).toBe(40);
    expect(foodOf('Butter (Keksboden)')?.kcal).toBe(740);
    expect(foodOf('Olivenöl')?.kcal).toBe(880);
    expect(foodOf('Salbei')).toBeNull();
    expect(foodOf('Eier')?.piece).toBe(60);
  });
  it('Gewicht in Klammern gilt für ein Stück', () => {
    expect(parenGrams('1 Dose (140 g)')).toBe(140);
    expect(parenGrams('2 Zehen (je 5 g)')).toBe(10);
    expect(parenGrams('500 g (0,5 kg)')).toBeNull();
    expect(shopAmount('1 Dose (140 g)', 'Mais')).toBe('140 g (1 Dose)');
    expect(gramsOf('1 Dose', 'Mais')).toBe(140);
    expect(gramsOf('3', 'Eier')).toBe(180);
  });
  it('rechnet das ganze Gericht und nennt Unbekanntes', () => {
    const r = estimateCalories([
      { name: 'Spaghetti', amount: '500 g' },
      { name: 'Eier', amount: '4' },
      { name: 'Salz', amount: 'nach Geschmack' },
      { name: 'Drachenfrucht', amount: '1' },
    ]);
    expect(Math.round(r.kcal)).toBe(1775 + 372);
    expect(r.missing).toEqual(['Drachenfrucht']);
  });
});
