import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLibrary, serializeLibrary, validateLibrary } from '../src/library';
import { allocate, appearanceOdds, mergeLibraries, planFor, sampleTarnished, seededRandom, shares, wieldsBoth, type Rules } from '../src/simulate';
import type { Tarnished } from '../src/types';

const baseText = readFileSync(new URL('../public/base.toml', import.meta.url), 'utf8');
const rules = JSON.parse(readFileSync(new URL('../public/catalog/rules.json', import.meta.url), 'utf8')) as Rules;
const none = [0, 0, 0, 0, 0, 0, 0, 0];

// Cases pinned in the mod's src/library.rs tests (allocation_matches_the_offline_checker and
// a_stat_plan_comes_after_the_requirements_and_before_growth).
describe('attribute allocation mirrors the mod', () => {
  it('raises requirements first, then growth by weight', () => {
    const cases: [number[], number[], number[], number, number[]][] = [
      [[14, 9, 12, 16, 9, 7, 8, 11], [4, 1, 3, 6, 0, 0, 0, 0], [0, 0, 32, 19, 11, 0, 0, 0], 38, [20, 10, 32, 25, 11, 7, 8, 11]],
      [[15, 10, 11, 14, 13, 9, 9, 7], [4, 1, 2, 5, 1, 0, 0, 0], [0, 0, 37, 17, 9, 0, 0, 0], 116, [45, 19, 37, 57, 21, 9, 9, 7]],
      [[12, 11, 13, 12, 15, 9, 8, 8], [4, 1, 2, 1, 5, 0, 0, 0], [0, 0, 1, 16, 48, 0, 0, 0], 191, [66, 27, 41, 34, 86, 9, 8, 8]],
      [[11, 12, 11, 11, 14, 14, 6, 9], [4, 2, 1, 1, 1, 4, 0, 0], [0, 0, 1, 10, 10, 18, 0, 0], 24, [19, 16, 13, 13, 15, 21, 6, 9]],
      [[9, 15, 9, 8, 12, 16, 7, 9], [4, 3, 1, 0, 0, 5, 0, 0], [0, 0, 1, 11, 13, 60, 0, 0], 194, [69, 48, 30, 11, 13, 92, 7, 9]],
      [[14, 9, 12, 16, 9, 7, 8, 11], [4, 1, 3, 6, 0, 0, 0, 0], [0, 0, 43, 60, 0, 0, 0, 0], 193, [70, 27, 49, 98, 9, 7, 8, 11]],
      [[10, 11, 10, 9, 13, 9, 8, 14], [4, 1, 2, 1, 3, 0, 0, 4], [0, 0, 12, 12, 18, 0, 0, 20], 120, [42, 19, 25, 17, 38, 9, 8, 46]],
    ];
    for (const [base, growth, needed, points, expected] of cases) expect(allocate(base, growth, needed, none, points).stats).toEqual(expected);
  });

  it('applies a stat plan after the requirements and before growth', () => {
    const cases: [number[], number[], number[], number[], number, number[]][] = [
      [[15, 10, 11, 14, 13, 9, 9, 7], [4, 1, 2, 5, 1, 0, 0, 0], [0, 0, 37, 17, 9, 0, 0, 0], [40, 15, 0, 40, 0, 0, 0, 0], 116, [45, 19, 37, 57, 21, 9, 9, 7]],
      [[12, 11, 13, 12, 15, 9, 8, 8], [4, 1, 2, 1, 5, 0, 0, 0], [0, 0, 1, 16, 48, 0, 0, 0], [60, 0, 30, 0, 70, 0, 0, 20], 60, [18, 11, 19, 16, 54, 9, 8, 13]],
      [[9, 15, 9, 8, 12, 16, 7, 9], [4, 3, 1, 0, 0, 5, 0, 0], [0, 0, 1, 11, 13, 60, 0, 0], [30, 30, 0, 0, 0, 40, 0, 0], 10, [9, 15, 9, 11, 13, 60, 7, 9]],
    ];
    for (const [base, growth, needed, plan, points, expected] of cases) expect(allocate(base, growth, needed, plan, points).stats).toEqual(expected);
    const reached = allocate([10, 10, 10, 10, 10, 10, 10, 10], [1, 0, 0, 1, 0, 0, 0, 0], none, [30, 0, 20, 0, 0, 0, 0, 0], 40);
    expect([reached.stats[0], reached.stats[2]]).toEqual([30, 20]);
    expect(reached.plan[0] + reached.plan[2] + reached.growth.reduce((sum, value) => sum + value, 0)).toBe(40);
  });

  it('uses the highest plan at or below the level', () => {
    const entry = { id: 'planned', name: 'Planned', class: 'vagabond', stats: [{ level: 60, vigor: 40 }, { level: 30, vigor: 25, dexterity: 20 }] } as Tarnished;
    expect(planFor(entry, 20)).toBeUndefined();
    expect(planFor(entry, 45)?.level).toBe(30);
    expect(planFor(entry, 90)?.level).toBe(60);
  });
});

describe('appearance odds mirror the mod', () => {
  it('fixes chances and splits groups by weight', () => {
    const entries = [
      { id: 'solo', name: 'Solo', names: ['Let Me Solo Me'], class: 'samurai', chance: 4, gear: [{ level: 1 }] },
      { id: 'named', name: 'Named', names: ['Ragnvald'], class: 'hero', gear: [{ level: 1 }] },
      { id: 'pools', name: 'Pools', class: 'hero', pool: { right: [2000000] } },
      { id: 'knight', name: 'Knight', class: 'vagabond', weight: 30, gear: [{ level: 1 }] },
    ] as Tarnished[];
    shares(entries, { class_libraries: 20 }).forEach((share, index) => expect(share).toBeCloseTo([4, 19, 20, 57][index], 9));
    const rest = shares(entries.slice(1), { class_libraries: 20 });
    expect(rest.reduce((sum, share) => sum + share, 0)).toBeCloseTo(100, 9);
    expect(rest[1]).toBeCloseTo(20, 9);
  });

  it('lets hunters be summoned and keeps the shipped fixed chances', () => {
    const library = mergeLibraries(parseLibrary(baseText), undefined);
    const summons = appearanceOdds(library, 'summon', 50).map((odds) => odds.entry.id);
    expect(summons).not.toContain('vigor-check');
    expect(summons).not.toContain('let-me-solo-me');
    const invaders = appearanceOdds(library, 'invader', 50);
    expect(invaders.find((odds) => odds.entry.id === 'vigor-check')?.percent).toBeCloseTo(2, 6);
    expect(invaders.reduce((sum, odds) => sum + odds.percent, 0)).toBeCloseTo(100, 6);
  });
});

describe('test builds', () => {
  it('builds every shipped entry at several levels', () => {
    const library = mergeLibraries(parseLibrary(baseText), undefined);
    for (const entry of library.entries) {
      for (const playerLevel of [1, 40, 120, 200]) {
        const sample = sampleTarnished(entry, library, rules, { playerLevel, random: seededRandom(playerLevel * 31 + entry.id.length) });
        expect(sample.gear.right.length, entry.id).toBeGreaterThan(0);
        expect(sample.level).toBeGreaterThanOrEqual(sample.target);
        expect(sample.allocation.stats.every((value) => value >= 1 && value <= 99)).toBe(true);
        expect(sample.gear.talismans.length).toBeLessThanOrEqual(4);
        expect(sample.items.length).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('paired weapons and the DLC in test builds', () => {
  it('marks paired weapons two-handed unless the left hand casts or powerstances', () => {
    const gear = (right: number, left?: number) => ({ level: 1, right: [{ id: right }], left: left === undefined ? [] : [{ id: left }], armor: [], talismans: [], spells: [] });
    expect(wieldsBoth(gear(22000200), rules)).toBe(true); // Keen Hookclaws
    expect(wieldsBoth(gear(22000200, 30000000), rules)).toBe(true); // and a Buckler
    expect(wieldsBoth(gear(22000200, 22020000), rules)).toBe(false); // two claws: a powerstance
    expect(wieldsBoth(gear(61500000, 34000000), rules)).toBe(false); // a perfume bottle and a seal
    expect(wieldsBoth(gear(9000200), rules)).toBe(false); // a katana
  });

  it('builds the brawlers two-handed and leaves DLC items out without the DLC', () => {
    const library = mergeLibraries(parseLibrary(baseText), undefined);
    const brawlers = library.entries.find((entry) => entry.id === 'pool-bare-knuckle-brawlers')!;
    for (const playerLevel of [1, 60, 150]) expect(sampleTarnished(brawlers, library, rules, { playerLevel, random: seededRandom(playerLevel) }).twoHanded).toBe(true);
    const perfumers = library.entries.find((entry) => entry.id === 'pool-perfumers-and-alchemists')!;
    for (let seed = 1; seed < 20; seed += 1) {
      const sample = sampleTarnished(perfumers, library, rules, { playerLevel: 120, random: seededRandom(seed), dlcInstalled: false });
      expect(sample.gear.right.every((weapon) => Math.floor(weapon.id / 10000) % 100 < 50)).toBe(true);
      expect(sample.items.every(([id]) => id < 2000000)).toBe(true);
      expect(sample.dlcRemoved).toBeGreaterThan(0);
    }
  });
});

describe('great runes in test builds', () => {
  it('draws a great rune only within the level, and none when -1 is drawn', () => {
    const library = mergeLibraries(parseLibrary(baseText), undefined);
    const entry = { id: 'runes', name: 'Runes', class: 'hero', gear: [{ level: 1, right: [2000000], great_rune: [{ id: -1, weight: 10 }, { id: 193, level: 60 }] }] } as Tarnished;
    const seen = new Set<number | undefined>();
    for (let seed = 1; seed < 60; seed += 1) {
      expect(sampleTarnished(entry, library, rules, { playerLevel: 30, spread: 0, random: seededRandom(seed) }).gear.greatRune).toBeUndefined();
      seen.add(sampleTarnished(entry, library, rules, { playerLevel: 100, spread: 0, random: seededRandom(seed) }).gear.greatRune);
    }
    expect([...seen].sort()).toEqual([193, undefined]);
    const pool = { id: 'rune-pool', name: 'Rune pool', class: 'hero', pool: { right: [2000000], great_runes: [196] } } as Tarnished;
    expect(sampleTarnished(pool, library, rules, { playerLevel: 5, random: seededRandom(3) }).gear.greatRune).toBe(196);
  });

  it('gives shipped Tarnished great runes late in the game and none early', () => {
    const library = mergeLibraries(parseLibrary(baseText), undefined);
    const runes = (playerLevel: number) => library.entries.map((entry, index) => sampleTarnished(entry, library, rules, { playerLevel, spread: 0, random: seededRandom(index + 1) }).gear.greatRune);
    expect(runes(20).every((rune) => rune === undefined)).toBe(true);
    const late = runes(150);
    expect(late.filter((rune) => rune !== undefined).length).toBeGreaterThan(library.entries.length / 2);
    expect(late.every((rune) => rune === undefined || (rune >= 191 && rune <= 196))).toBe(true);
  });
});

describe('new library fields', () => {
  it('round-trips chances, fixed chances and stat plans, and validates them', () => {
    const document = parseLibrary(baseText);
    document.chances = { class_libraries: 20 };
    document.tarnished[0].chance = 7.5;
    document.tarnished[0].stats = [{ level: 60, vigor: 40, endurance: 25 }];
    const saved = parseLibrary(serializeLibrary(document));
    expect(saved.chances).toEqual({ class_libraries: 20 });
    expect(saved.tarnished[0].chance).toBe(7.5);
    expect(saved.tarnished[0].stats).toEqual([{ level: 60, vigor: 40, endurance: 25 }]);
    expect(serializeLibrary(document)).toContain('[[tarnished.stats]]');
    expect(validateLibrary(saved).errors).toEqual([]);
    saved.chances = { class_libraries: 120, everyone: 5 } as never;
    saved.tarnished[0].chance = -1;
    saved.tarnished[0].stats = [{ level: 10, vigor: 150 }];
    const errors = validateLibrary(saved).errors.join('\n');
    expect(errors).toContain('class_libraries must be from 0 to 100');
    expect(errors).toContain('unknown group “everyone”');
    expect(errors).toContain('fixed chance must be from 0 to 100');
    expect(errors).toContain('vigor must be from 0 to 99');
  });

  it('accepts custom starting attributes instead of a class and warns about unreachable plans', () => {
    const document = parseLibrary(baseText);
    const entry = document.tarnished[0];
    delete entry.class;
    entry.attributes = { vigor: 10, mind: 10, endurance: 10, strength: 10, dexterity: 10, intelligence: 10, faith: 10, arcane: 10 };
    entry.stats = [{ level: 20, vigor: 60 }];
    const result = validateLibrary(document);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('needs 50 points'))).toBe(true);
    entry.attributes = { vigor: 10 };
    expect(validateLibrary(document).errors.some((error) => error.includes('need all eight'))).toBe(true);
  });
});
