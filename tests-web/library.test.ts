import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newEnemy, parseLibrary, serializeLibrary, validateLibrary } from '../src/library';

const baseText = readFileSync(new URL('../public/base.toml', import.meta.url), 'utf8');
const gestures = readFileSync(new URL('../public/gestures.txt', import.meta.url), 'utf8').trim().split(/\r?\n/);

describe('Wayward Tarnished library model', () => {
  it('loads and re-exports the current base library', () => {
    const document = parseLibrary(baseText);
    expect(document.tarnished).toHaveLength(17);
    expect(document.tarnished.filter((entry) => entry.pool)).toHaveLength(6);
    const roundTrip = parseLibrary(serializeLibrary(document));
    expect(roundTrip.tarnished).toEqual(document.tarnished);
    expect(validateLibrary(roundTrip, gestures).errors).toEqual([]);
  });

  it('creates a valid random pool directly', () => {
    const document = parseLibrary(baseText);
    document.tarnished = [newEnemy([], 'pool')];
    expect(document.tarnished[0].pool?.right).toEqual([2000000]);
    expect(validateLibrary(document, gestures).errors).toEqual([]);
  });

  it('preserves inherit, never and custom gesture states', () => {
    const document = parseLibrary(baseText);
    const inherited = document.tarnished[0];
    delete inherited.greetings;
    inherited.victories = [];
    document.tarnished[1].greetings = ['wave', 'bow'];
    const saved = parseLibrary(serializeLibrary(document));
    expect(saved.tarnished[0].greetings).toBeUndefined();
    expect(saved.tarnished[0].victories).toEqual([]);
    expect(saved.tarnished[1].greetings).toEqual(['wave', 'bow']);
  });

  it('rejects unknown gestures and incomplete armor presets', () => {
    const document = parseLibrary(baseText);
    document.tarnished = [newEnemy([], 'pool')];
    document.tarnished[0].greetings = ['not_a_real_gesture'];
    document.tarnished[0].pool!.armor = [[100, 200]];
    const result = validateLibrary(document, gestures);
    expect(result.errors.some((error) => error.includes('unknown greetings gesture'))).toBe(true);
    expect(result.errors.some((error) => error.includes('head, chest, arms and legs'))).toBe(true);
  });

  it('keeps shared and per-entry consumables, including an explicit empty list', () => {
    const document = parseLibrary(baseText);
    expect(document.consumables?.kinds).toBe(2);
    expect(document.consumables?.pool?.length).toBeGreaterThan(0);
    const solo = document.tarnished.find((entry) => entry.id === 'let-me-solo-me');
    expect(solo?.consumables).toEqual([]);
    const saved = parseLibrary(serializeLibrary(document));
    expect(saved.consumables).toEqual(document.consumables);
    expect(saved.tarnished.map((entry) => entry.consumables)).toEqual(document.tarnished.map((entry) => entry.consumables));
  });

  it('rejects consumables the AI cannot use or carry', () => {
    const document = parseLibrary(baseText);
    document.tarnished = [newEnemy([], 'pool')];
    document.tarnished[0].consumables = [{ id: 300, count: 11 }, { id: 8000 }, { id: 1700, count: 0 }];
    const goods = (id: number) => ({ 300: { name: 'Fire Pot', usable: true, limit: 10 }, 1700: { name: 'Throwing Dagger', usable: true, limit: 20 }, 8000: { name: 'Flask', usable: false, limit: 99 } })[id];
    const errors = validateLibrary(document, gestures, goods).errors;
    expect(errors.some((error) => error.includes('count must be from 1 to 10'))).toBe(true);
    expect(errors.some((error) => error.includes('Flask is not an item the AI can use'))).toBe(true);
    expect(errors.some((error) => error.includes('count must be from 1 to 20'))).toBe(true);
  });

  it('marks only AI-usable goods in the catalog', () => {
    const items = JSON.parse(readFileSync(new URL('../public/catalog/items.json', import.meta.url), 'utf8')) as { id: number; kind: string; aiUseJudgeId?: number }[];
    const usable = new Set(items.filter((item) => item.kind === 'goods' && Number(item.aiUseJudgeId) > 0).map((item) => item.id));
    const document = parseLibrary(baseText);
    for (const consumable of [...document.consumables!.pool!, ...document.tarnished.flatMap((entry) => entry.consumables ?? [])]) expect(usable.has(consumable.id)).toBe(true);
    expect(usable.has(190)).toBe(false); // Rune Arc
  });

  it('ships the expected local item catalog without external fetching', () => {
    const items = JSON.parse(readFileSync(new URL('../public/catalog/items.json', import.meta.url), 'utf8'));
    expect(items).toHaveLength(2797);
  });
});
