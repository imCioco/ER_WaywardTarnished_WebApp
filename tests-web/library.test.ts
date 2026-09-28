import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adoptArchetype, archetypes, armed, entryNames, isNamed, newEnemy, parseLibrary, serializeLibrary, stripDlcItems, validateLibrary, withUsedArchetypes } from '../src/library';
import { EMPTY_PRESETS, withoutPreset, withPersonality } from '../src/presets';
import type { Tarnished } from '../src/types';

const baseText = readFileSync(new URL('../public/base.toml', import.meta.url), 'utf8');
const gestures = readFileSync(new URL('../public/gestures.txt', import.meta.url), 'utf8').trim().split(/\r?\n/);
const items = JSON.parse(readFileSync(new URL('../public/catalog/items.json', import.meta.url), 'utf8')) as { id: number; kind: string; dlc: boolean; aiUseJudgeId?: number }[];

describe('Wayward Tarnished library model', () => {
  it('loads and re-exports the current base library', () => {
    const document = parseLibrary(baseText);
    expect(document.tarnished.length).toBeGreaterThanOrEqual(45);
    expect(document.tarnished.filter((entry) => entry.pool)).toHaveLength(9);
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

  it('warns only when an entry without dlc has nothing left without the DLC', () => {
    const document = parseLibrary(baseText);
    const dlcWeapon = items.find((item) => item.kind === 'weapon' && item.dlc)!;
    const entry = newEnemy([], 'gear');
    entry.gear = [{ level: 1, right: [[2000000, dlcWeapon.id]] }];
    document.tarnished = [entry];
    const dlcWarning = () => validateLibrary(document, { gestures }).warnings.some((warning) => warning.includes('Shadow of the Erdtree'));
    expect(dlcWarning()).toBe(false);
    entry.gear = [{ level: 1, right: [dlcWeapon.id] }];
    expect(dlcWarning()).toBe(true);
    entry.dlc = true;
    expect(dlcWarning()).toBe(false);
  });

  it('leaves Shadow of the Erdtree items out as the mod does', () => {
    // The same entry as the test without_the_dlc_its_items_are_left_out in the mod.
    const entry = {
      id: 'mixed', name: 'Mixed', class: 'hero', consumables: [{ id: 300, count: 3 }, { id: 2000300, count: 2 }],
      gear: [
        { level: 1, right: [[9000200, 9500000], { id: 2000100, ash: 400000 }], left: [67520000], armor: [[3000000, 40000], 3000100, 40200, 40300], talismans: [[1000, 7000], 7010], spells: [[6000, 2004000]] },
        { level: 30, right: [[9500000, 67520000]] },
        { level: 60, right: [3000000], armor_sets: [[3000000, 3000100, 3000200, 3000300]] },
      ],
    } as Tarnished;
    const { entry: stripped, removed } = stripDlcItems(entry);
    expect(removed).toBe(12);
    expect(stripped.gear).toEqual([{ level: 1, right: [[9000200], 2000100], left: [], armor: [[40000], -1, 40200, 40300], talismans: [[1000]], spells: [[6000]] }]);
    expect(stripped.consumables).toEqual([{ id: 300, count: 3 }]);
    expect(armed(stripped)).toBe(true);
    const pool = stripDlcItems({ id: 'dlc-pool', name: 'DLC pool', class: 'hero', pool: { right: [61500000, { id: 61510000, level: 60 }], left: [-1, 30010000], ashes: [10000, 400000] } } as Tarnished).entry;
    expect(armed(pool)).toBe(false);
    expect(pool.pool?.left).toEqual([-1, 30010000]);
    expect(pool.pool?.ashes).toEqual([10000]);
    // Every shipped entry without dlc = true stays usable without the DLC.
    for (const shipped of parseLibrary(baseText).tarnished.filter((candidate) => !candidate.dlc)) expect(armed(stripDlcItems(shipped).entry), shipped.id).toBe(true);
  });

  it('reads names as one list or one per sex', () => {
    const document = parseLibrary(baseText);
    const duelists = document.tarnished.find((entry) => entry.id === 'pool-keen-duelists')!;
    expect(Array.isArray(duelists.names)).toBe(false);
    expect(entryNames(duelists, 'female')).toContain('Tomoe');
    expect(isNamed(duelists)).toBe(false);
    expect(isNamed(document.tarnished.find((entry) => entry.id === 'let-me-solo-me')!)).toBe(true);
    const saved = parseLibrary(serializeLibrary(document));
    expect(saved.tarnished.find((entry) => entry.id === 'pool-keen-duelists')!.names).toEqual(duelists.names);
    duelists.names = { male: ['Hayato'], elder: ['Oldman'] } as never;
    expect(validateLibrary(document, { gestures }).errors.some((error) => error.includes('only male and female'))).toBe(true);
    duelists.names = { female: ['Tomoe'] };
    expect(entryNames(duelists, 'male')).toEqual([]);
    expect(validateLibrary(document, { gestures }).errors).toEqual([]);
  });

  it('offers presets in every file and copies the ones a build uses', () => {
    const base = parseLibrary(baseText);
    const empty = { ...parseLibrary(baseText), tarnished: [newEnemy([], 'gear')] };
    delete empty.styles;
    delete empty.personalities;
    delete empty.__descriptions;
    const presets = withPersonality(EMPTY_PRESETS, 'counter-puncher', { odds: { hit_r1_combo: 80 } }, 'Hits back.');
    const listed = archetypes(empty, base, presets);
    expect(listed.find((archetype) => archetype.name === 'berserker')?.source).toBe('base');
    expect(listed.find((archetype) => archetype.name === 'counter-puncher')).toMatchObject({ source: 'saved', inherited: true, saved: true, description: 'Hits back.' });
    empty.tarnished[0].styles = ['counter-puncher', 'berserker', 'reckless'];
    expect(validateLibrary(empty, { gestures, base, presets }).errors).toEqual([]);
    expect(validateLibrary(empty, { gestures, base }).errors.some((error) => error.includes('counter-puncher'))).toBe(true);
    const exported = withUsedArchetypes(empty, listed);
    expect(exported.personalities).toEqual({ 'counter-puncher': { odds: { hit_r1_combo: 80 } }, berserker: base.personalities!.berserker });
    expect(exported.styles).toEqual({ reckless: base.styles!.reckless });
    expect(exported.__descriptions?.['counter-puncher']).toBe('Hits back.');
    expect(withUsedArchetypes(exported, archetypes(exported, base, presets))).toBe(exported);
    const file = structuredClone(empty);
    adoptArchetype(file, listed.find((archetype) => archetype.name === 'sentinel')!);
    expect(archetypes(file, base, presets).find((archetype) => archetype.name === 'sentinel')?.source).toBe('file');
    expect(archetypes(file, undefined, withoutPreset(presets, 'counter-puncher')).some((archetype) => archetype.name === 'counter-puncher')).toBe(false);
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
    expect(document.consumables?.kinds).toBe(3);
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
