import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newEnemy, parseLibrary, serializeLibrary, validateLibrary } from '../src/library';

const baseText = readFileSync(new URL('../public/base.toml', import.meta.url), 'utf8');
const gestures = readFileSync(new URL('../public/gestures.txt', import.meta.url), 'utf8').trim().split(/\r?\n/);
const items = JSON.parse(readFileSync(new URL('../public/catalog/items.json', import.meta.url), 'utf8')) as { id: number; kind: string; dlc: boolean; aiUseJudgeId?: number }[];

describe('Wayward Tarnished library model', () => {
  it('loads and re-exports the current base library', () => {
    const document = parseLibrary(baseText);
    expect(document.tarnished.length).toBeGreaterThanOrEqual(17);
    expect(document.tarnished.filter((entry) => entry.pool)).toHaveLength(6);
    const roundTrip = parseLibrary(serializeLibrary(document));
    expect(roundTrip.tarnished).toEqual(document.tarnished);
    expect(validateLibrary(roundTrip, { gestures }).errors).toEqual([]);
  });

  it('keeps loadout option lists, armor sets and variants', () => {
    const document = parseLibrary(baseText);
    const loadouts = document.tarnished.flatMap((entry) => entry.gear ?? []);
    expect(loadouts.some((gear) => gear.right?.some(Array.isArray))).toBe(true);
    expect(loadouts.some((gear) => gear.armor_sets?.length)).toBe(true);
    const entry = newEnemy([], 'gear');
    entry.gear = [
      { level: 1, right: [[{ id: 9000200, ash: 11400 }, { id: 9080000, weight: 5 }]], left: [[30070000, -1]], armor: [[870000, 150000], 870100, [870200, -1], 870300], talismans: [[1150, 2180], 1000], spells: [4000, [4390, 4070]] },
      { level: 30, weight: 5, right: [2000000], armor_sets: [[660000, 660100, 660200, 660300], { set: [40000, 40100, 40200, 40300], weight: 5 }], arrows: [50000000, 30] },
      { level: 30, right: [2000000], armor: [-1, -1, -1, -1] },
    ];
    document.tarnished = [entry];
    const saved = parseLibrary(serializeLibrary(document));
    expect(saved.tarnished[0].gear).toEqual(entry.gear);
    expect(validateLibrary(saved, { gestures }).errors).toEqual([]);
  });

  it('rejects empty option lists, armor and armor_sets together, and too many slots', () => {
    const document = parseLibrary(baseText);
    const entry = newEnemy([], 'gear');
    entry.gear = [{ level: 1, right: [[], 1, 2, 3], armor: [-1, -1, -1, -1], armor_sets: [[1, 2, 3, 4]] }];
    document.tarnished = [entry];
    const errors = validateLibrary(document, { gestures }).errors;
    expect(errors.some((error) => error.includes('empty list of options'))).toBe(true);
    expect(errors.some((error) => error.includes('both armor pieces and armor sets'))).toBe(true);
    expect(errors.some((error) => error.includes('at most 3 slots'))).toBe(true);
  });

  it('warns about Shadow of the Erdtree items in an entry without dlc', () => {
    const document = parseLibrary(baseText);
    const dlcWeapon = items.find((item) => item.kind === 'weapon' && item.dlc)!;
    const entry = newEnemy([], 'gear');
    entry.gear = [{ level: 1, right: [[2000000, dlcWeapon.id]] }];
    document.tarnished = [entry];
    const isDlcItem = (kind: string, id: number) => items.some((item) => item.kind === kind && item.id === id && item.dlc);
    expect(validateLibrary(document, { gestures, isDlcItem }).warnings.some((warning) => warning.includes('Shadow of the Erdtree'))).toBe(true);
    entry.dlc = true;
    expect(validateLibrary(document, { gestures, isDlcItem }).warnings.some((warning) => warning.includes('Shadow of the Erdtree'))).toBe(false);
  });

  it('creates a valid random pool directly', () => {
    const document = parseLibrary(baseText);
    document.tarnished = [newEnemy([], 'pool')];
    expect(document.tarnished[0].pool?.right).toEqual([2000000]);
    expect(validateLibrary(document, { gestures }).errors).toEqual([]);
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
    const result = validateLibrary(document, { gestures });
    expect(result.errors.some((error) => error.includes('unknown greetings gesture'))).toBe(true);
    expect(result.errors.some((error) => error.includes('head, chest, arms and legs'))).toBe(true);
  });

  it('keeps shared and per-entry consumables, including an explicit empty list', () => {
    const document = parseLibrary(baseText);
    expect(document.consumables?.kinds).toBe(2);
    expect(document.consumables?.pool?.length).toBeGreaterThan(0);
    const solo = document.tarnished.find((entry) => entry.id === 'let-me-solo-me');
    expect(solo?.consumables).toEqual([]);
    expect(document.tarnished.some((entry) => entry.consumable_kinds !== undefined)).toBe(true);
    const saved = parseLibrary(serializeLibrary(document));
    expect(saved.consumables).toEqual(document.consumables);
    expect(saved.tarnished.map((entry) => [entry.consumables, entry.consumable_kinds])).toEqual(document.tarnished.map((entry) => [entry.consumables, entry.consumable_kinds]));
  });

  it('rejects consumables the AI cannot use or carry', () => {
    const document = parseLibrary(baseText);
    document.tarnished = [newEnemy([], 'pool')];
    document.tarnished[0].consumables = [{ id: 300, count: 11 }, { id: 8000 }, { id: 1700, count: 0 }];
    const goods = (id: number) => ({ 300: { name: 'Fire Pot', usable: true, limit: 10 }, 1700: { name: 'Throwing Dagger', usable: true, limit: 20 }, 8000: { name: 'Flask', usable: false, limit: 99 } })[id];
    const errors = validateLibrary(document, { gestures, goods }).errors;
    expect(errors.some((error) => error.includes('count must be from 1 to 10'))).toBe(true);
    expect(errors.some((error) => error.includes('Flask is not an item the AI can use'))).toBe(true);
    expect(errors.some((error) => error.includes('count must be from 1 to 20'))).toBe(true);
  });

  it('marks only AI-usable goods in the catalog', () => {
    const usable = new Set(items.filter((item) => item.kind === 'goods' && Number(item.aiUseJudgeId) > 0).map((item) => item.id));
    const document = parseLibrary(baseText);
    for (const consumable of [...document.consumables!.pool!, ...document.tarnished.flatMap((entry) => entry.consumables ?? [])]) expect(usable.has(consumable.id)).toBe(true);
    expect(usable.has(190)).toBe(false); // Rune Arc
  });

  it('reads style and personality descriptions from comments and writes them back', () => {
    const document = parseLibrary(baseText);
    expect(document.__descriptions?.reckless).toContain('heavy attacks');
    expect(document.__descriptions?.parrier).toContain('parries it with a parrying shield');
    document.__descriptions!.parrier = 'Waits, parries\nand ripostes.';
    const text = serializeLibrary(document);
    expect(text).toMatch(/# Waits, parries and ripostes\.\n\[personalities\.parrier(\.odds)?\]/);
    expect(text.match(/# Waits, parries/g)).toHaveLength(1);
    expect(text).not.toContain('__descriptions');
    const saved = parseLibrary(text);
    expect(saved.__descriptions).toEqual({ ...document.__descriptions, parrier: 'Waits, parries and ripostes.' });
    expect(saved.personalities).toEqual(document.personalities);
    expect(saved.styles).toEqual(document.styles);
  });

  it('allows any number of personalities and checks actions and style references', () => {
    const document = parseLibrary(baseText);
    expect(Object.keys(document.personalities ?? {}).length).toBeGreaterThan(5);
    document.personalities!.copycat = { odds: { parry: 100, not_an_action: 5 } };
    document.personalities!.legacy = { effect: 5023, row: 15023, odds: { riposte: 900 } };
    document.tarnished[0].styles = ['copycat', 'legacy', 'missing-style'];
    const errors = validateLibrary(document, { gestures }).errors;
    expect(errors.some((error) => error.includes('unknown action “not_an_action”'))).toBe(true);
    expect(errors.some((error) => error.includes('style “missing-style”'))).toBe(true);
    expect(errors.some((error) => error.includes('legacy'))).toBe(false);
  });

  it('ships the expected local item catalog without external fetching', () => {
    expect(items).toHaveLength(2797);
  });
});
