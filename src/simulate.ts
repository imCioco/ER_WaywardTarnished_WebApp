import { CHANCE_GROUPS, LEVEL_SPREAD, MAXIMUM_LEVEL, SOFT_CAPS, STATS } from './constants';
import { baseLevel, choiceId, entryNames, isDlcGoods, isNamed, pickOptions, startingSets, stripDlcItems } from './library';
import type { ArmorChoice, Chances, Consumable, EquipmentPool, ItemChoice, LibraryDocument, Loadout, Pick, StatPlan, Tarnished } from './types';

// A browser mirror of how the mod builds one Tarnished (src/library.rs: Build::resolve, choose_loadout,
// generate, allocate_planned) and picks entries (Library::choose, shares). Item rules come from
// public/catalog/rules.json, exported from regulation.bin by scripts/export_rules.py.

/** weapons: [str, dex, int, faith, arcane, weight, wepType, gemMountType, maximum upgrade, paired (isDualBlade, 1 or 0)]; spells: [int, faith, arcane, kind (0 sorcery, 1 incantation), heals]; gems: [weapon types, affinity bits]. */
export type Rules = {
  weapons: Record<string, number[]>;
  spells: Record<string, number[]>;
  armor: Record<string, number>;
  talismans: Record<string, number>;
  gems: Record<string, [number[], number]>;
};

export async function loadRules(): Promise<Rules> {
  const response = await fetch(`${import.meta.env.BASE_URL}catalog/rules.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error('The item rules for the build preview could not be loaded.');
  return await response.json() as Rules;
}

const STAFF = 57;
const SEAL = 61;
const MEDIUM_LOAD = 0.69;
const LATER_ITEM_BIAS = 40;
const EXTRAS_SHARE_PERCENT = 60;
const ITEM_SLOTS = 10;
const DEFAULT_WEIGHT = 10;

export type Random = { below: (bound: number) => number };

/** A small seeded generator, so a preview can be repeated. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return { below: (bound) => Math.floor(next() * Math.max(1, Math.floor(bound))) };
}

export type Weapon = { id: number; ash?: number; upgrade?: number };
export type Gear = { level: number; right: Weapon[]; left: Weapon[]; armor: number[]; talismans: number[]; spells: number[]; arrows?: [number, number]; bolts?: [number, number]; greatRune?: number };

type Pooled = ItemChoice | ArmorChoice | Consumable;

function levelOf(item: Pooled): number {
  return !Array.isArray(item) && typeof item === 'object' && item.level !== undefined ? item.level : 1;
}
function weightOf(item: Pooled): number {
  return !Array.isArray(item) && typeof item === 'object' && item.weight !== undefined ? item.weight : DEFAULT_WEIGHT;
}
function weaponOf(choice: ItemChoice): Weapon {
  return typeof choice === 'number' ? { id: choice } : { id: choice.id, ...(choice.ash !== undefined ? { ash: choice.ash } : {}), ...(choice.upgrade !== undefined ? { upgrade: choice.upgrade } : {}) };
}
function pieces(choice: ArmorChoice): number[] {
  return Array.isArray(choice) ? choice : choice.set;
}
const baseRow = (id: number) => id - (id % 100);
const affinity = (id: number) => Math.floor((id % 10000) / 100);

export function pointCost(index: number, value: number): number {
  const [first, second] = SOFT_CAPS[index];
  return value <= first ? 1 : value <= second ? 2 : 4;
}

export function levelOfStats(stats: number[]): number {
  return Math.max(stats.reduce((sum, value) => sum + value, 0) - 79, 0);
}

function equipLoad(endurance: number): number {
  const value = Math.min(endurance, 99);
  if (value <= 8) return 45;
  if (value <= 25) return 45 + 27 * ((value - 8) / 17) ** 1.1;
  if (value <= 60) return 72 + 48 * (1 - (1 - (value - 25) / 35) ** 1.2);
  return 120 + (40 * (value - 60)) / 39;
}

function enduranceFor(weight: number): number {
  for (let endurance = 1; endurance <= 99; endurance += 1) if (equipLoad(endurance) * MEDIUM_LOAD >= weight) return endurance;
  return 99;
}

/** What the gear needs: weapon and spell requirements, and the endurance that keeps it under medium load. */
export function requirements(gear: Gear, rules: Rules): number[] {
  const needed = [0, 0, 0, 0, 0, 0, 0, 0];
  let weight = 0;
  for (const weapon of [...gear.right, ...gear.left]) {
    if (weapon.id < 0) continue;
    const row = rules.weapons[baseRow(weapon.id)];
    if (!row) continue;
    for (let slot = 0; slot < 5; slot += 1) needed[slot + 3] = Math.max(needed[slot + 3], row[slot]);
    weight += row[5];
  }
  for (const spell of gear.spells) {
    const row = rules.spells[spell];
    if (!row) continue;
    for (let slot = 0; slot < 3; slot += 1) needed[slot + 5] = Math.max(needed[slot + 5], row[slot]);
  }
  for (const piece of gear.armor) weight += rules.armor[piece] ?? 0;
  needed[2] = Math.max(needed[2], enduranceFor(weight));
  return needed;
}

export function gearWeight(gear: Gear, rules: Rules): number {
  return [...gear.right, ...gear.left].reduce((sum, weapon) => sum + (rules.weapons[baseRow(weapon.id)]?.[5] ?? 0), 0)
    + gear.armor.reduce((sum, piece) => sum + (rules.armor[piece] ?? 0), 0);
}

function cost(base: number[], needed: number[]): number {
  return base.reduce((sum, have, index) => sum + Math.max(0, needed[index] - have), 0);
}

function draw<T extends Pooled>(items: T[], target: number, random: Random, accept: (item: T) => boolean): T | undefined {
  const eligible = items.filter((item) => levelOf(item) <= target && accept(item));
  const weight = (item: T) => Math.max(weightOf(item), 1) * (levelOf(item) + LATER_ITEM_BIAS);
  let roll = random.below(eligible.reduce((sum, item) => sum + weight(item), 0));
  return eligible.find((item) => {
    if (roll < weight(item)) return true;
    roll -= weight(item);
    return false;
  });
}

/** A great rune among the options within the level (library.rs draw_great_rune); none when -1 is drawn or none is within the level yet. */
function drawGreatRune(options: ItemChoice[], target: number, random: Random): number | undefined {
  const rune = draw(options, target, random, () => true);
  return rune !== undefined && choiceId(rune) > 0 ? choiceId(rune) : undefined;
}

function weightedIndex(weights: number[], random: Random): number {
  let roll = random.below(weights.reduce((sum, weight) => sum + weight, 0));
  const index = weights.findIndex((weight) => {
    if (roll < weight) return true;
    roll -= weight;
    return false;
  });
  return Math.max(index, 0);
}

function pickWithin<T extends Pooled>(options: T[], target: number, budget: number, random: Random, costOf: (item: T) => number): T | undefined {
  const drawn = draw(options, target, random, (option) => costOf(option) <= budget);
  if (drawn !== undefined) return drawn;
  const within = options.filter((option) => levelOf(option) <= target);
  if (within.length) return within.reduce((best, option) => (costOf(option) < costOf(best) ? option : best));
  return options[0];
}

const clone = (gear: Gear): Gear => ({ ...gear, right: [...gear.right], left: [...gear.left], armor: [...gear.armor], talismans: [...gear.talismans], spells: [...gear.spells] });
function changed(gear: Gear, change: (trial: Gear) => void): Gear {
  const trial = clone(gear);
  change(trial);
  return trial;
}

function castable(spell: number, gear: Gear, rules: Rules): boolean {
  const row = rules.spells[spell];
  if (!row) return false;
  const needed = row[3] === 0 ? STAFF : SEAL;
  return [...gear.right, ...gear.left].some((weapon) => weapon.id > 0 && rules.weapons[baseRow(weapon.id)]?.[6] === needed);
}

function talismanGroup(id: number, rules: Rules): number {
  return rules.talismans[id] ?? 0;
}

function resolveLoadout(loadout: Loadout, base: number[], target: number, budget: number, rules: Rules, random: Random): Gear {
  const spent = (gear: Gear) => cost(base, requirements(gear, rules));
  const gear: Gear = { level: loadout.level, right: [], left: [], armor: [], talismans: [], spells: [], arrows: loadout.arrows, bolts: loadout.bolts };
  for (const hand of ['right', 'left'] as const) {
    for (const pick of (loadout[hand] ?? []) as Pick[]) {
      const chosen = pickWithin(pickOptions(pick), target, budget, random, (option) => spent(changed(gear, (trial) => trial[hand].push(weaponOf(option)))));
      if (chosen !== undefined) gear[hand].push(weaponOf(chosen));
    }
  }
  if (loadout.armor_sets?.length) {
    const set = pickWithin(loadout.armor_sets, target, budget, random, (option) => spent(changed(gear, (trial) => { trial.armor = [...pieces(option)]; })));
    if (set !== undefined) gear.armor = [...pieces(set)];
  }
  for (const pick of (loadout.armor ?? []) as Pick[]) {
    const piece = pickWithin(pickOptions(pick), target, budget, random, (option) => spent(changed(gear, (trial) => trial.armor.push(choiceId(option)))));
    if (piece !== undefined) gear.armor.push(choiceId(piece));
  }
  for (const pick of (loadout.talismans ?? []) as Pick[]) {
    const groups = gear.talismans.map((id) => talismanGroup(id, rules)).filter((group) => group > 0);
    const fits = (option: ItemChoice) => !gear.talismans.includes(choiceId(option)) && !groups.includes(talismanGroup(choiceId(option), rules));
    const options = pickOptions(pick);
    const talisman = draw(options, target, random, fits) ?? options.find(fits);
    if (talisman !== undefined) gear.talismans.push(choiceId(talisman));
  }
  for (const pick of (loadout.spells ?? []) as Pick[]) {
    const fresh = (option: ItemChoice) => !gear.spells.includes(choiceId(option));
    const options = pickOptions(pick);
    const spell = draw(options, target, random, (option) => fresh(option) && castable(choiceId(option), gear, rules) && spent(changed(gear, (trial) => trial.spells.push(choiceId(option)))) <= budget) ?? options.find(fresh);
    if (spell !== undefined) gear.spells.push(choiceId(spell));
  }
  if (loadout.great_rune !== undefined) gear.greatRune = drawGreatRune(pickOptions(loadout.great_rune), target, random);
  return gear;
}

/** The highest loadout level at or below the target with a variant the points can pay for. */
function chooseLoadout(loadouts: Loadout[], base: number[], target: number, budget: number, rules: Rules, random: Random): Gear {
  const levels = [...new Set(loadouts.map((loadout) => loadout.level).filter((level) => level <= target))].sort((a, b) => b - a);
  for (const level of levels) {
    const variants = loadouts.filter((loadout) => loadout.level === level);
    while (variants.length) {
      const index = weightedIndex(variants.map((variant) => Math.max(variant.weight ?? DEFAULT_WEIGHT, 1)), random);
      const [variant] = variants.splice(index, 1);
      const gear = resolveLoadout(variant, base, target, budget, rules, random);
      if (cost(base, requirements(gear, rules)) <= budget) return gear;
    }
  }
  const lowest = loadouts.reduce((best, loadout) => (loadout.level < best.level ? loadout : best));
  return resolveLoadout(lowest, base, target, budget, rules, random);
}

function ashFits(ash: number, weaponId: number, rules: Rules): boolean {
  const gem = rules.gems[ash];
  const type = rules.weapons[baseRow(weaponId)]?.[6];
  return Boolean(gem && type !== undefined && gem[0].includes(type) && (gem[1] >>> affinity(weaponId)) & 1);
}

function cheapest<T extends ItemChoice>(items: T[], target: number, costOf: (item: T) => number): T | undefined {
  const eligible = items.filter((item) => levelOf(item) <= target && choiceId(item) > 0);
  return eligible.length ? eligible.reduce((best, item) => (costOf(item) < costOf(best) ? item : best)) : undefined;
}

export function talismanSlots(level: number): number {
  return level < 25 ? 1 : level < 60 ? 2 : level < 100 ? 3 : 4;
}
export function spellSlots(level: number): number {
  return Math.min(2 + Math.floor(level / 40), 7);
}

/** A class library's draw (library.rs generate). */
function generate(pool: EquipmentPool, base: number[], target: number, budget: number, rules: Rules, random: Random): Gear {
  const spent = (gear: Gear) => cost(base, requirements(gear, rules));
  const allowance = Math.floor((budget * EXTRAS_SHARE_PERCENT) / 100);
  const weaponType = (id: number) => rules.weapons[baseRow(id)]?.[6] ?? 0;
  const gear: Gear = { level: 0, right: [], left: [], armor: [], talismans: [], spells: [] };
  const rightCost = (item: ItemChoice) => spent(changed(gear, (trial) => trial.right.push(weaponOf(item))));
  const right = draw(pool.right ?? [], target, random, (item) => rightCost(item) <= budget) ?? cheapest(pool.right ?? [], target, rightCost);
  if (right !== undefined) gear.right.push(weaponOf(right));
  const limit = (current: Gear) => Math.max(allowance, spent(current));
  if (pool.spells?.length) {
    const leftCost = (item: ItemChoice) => spent(changed(gear, (trial) => trial.left.push(weaponOf(item))));
    const catalyst = draw(pool.catalysts ?? [], target, random, (item) => leftCost(item) <= limit(gear)) ?? cheapest(pool.catalysts ?? [], target, leftCost);
    if (catalyst !== undefined) {
      gear.left.push(weaponOf(catalyst));
      const kinds = [...gear.right, ...gear.left].map((weapon) => weaponType(weapon.id)).flatMap((type) => (type === STAFF ? [0] : type === SEAL ? [1] : []));
      for (let slot = 0; slot < spellSlots(target); slot += 1) {
        const spell = draw(pool.spells, target, random, (item) => !gear.spells.includes(choiceId(item)) && rules.spells[choiceId(item)] !== undefined
          && kinds.includes(rules.spells[choiceId(item)][3]) && spent(changed(gear, (trial) => trial.spells.push(choiceId(item)))) <= limit(gear));
        if (spell === undefined) break;
        gear.spells.push(choiceId(spell));
      }
    }
  }
  if (!gear.left.length) {
    const weapon = draw(pool.left ?? [], target, random, (item) => choiceId(item) < 0 || spent(changed(gear, (trial) => trial.left.push(weaponOf(item)))) <= limit(gear));
    if (weapon !== undefined && choiceId(weapon) > 0) gear.left.push(weaponOf(weapon));
  }
  const armorWeight = (set: ArmorChoice) => pieces(set).reduce((sum, piece) => sum + (rules.armor[piece] ?? 0), 0);
  const armorPool = pool.armor ?? [];
  let armor = draw(armorPool, target, random, (set) => spent(changed(gear, (trial) => { trial.armor = [...pieces(set)]; })) <= limit(gear));
  if (armor === undefined) {
    const within = armorPool.filter((set) => levelOf(set) <= target);
    armor = within.length ? within.reduce((best, set) => (armorWeight(set) < armorWeight(best) ? set : best)) : undefined;
  }
  if (armor !== undefined) gear.armor = [...pieces(armor)];
  for (let slot = 0; slot < talismanSlots(target); slot += 1) {
    const groups = gear.talismans.map((id) => talismanGroup(id, rules)).filter((group) => group > 0);
    const talisman = draw(pool.talismans ?? [], target, random, (item) => !gear.talismans.includes(choiceId(item)) && rules.talismans[choiceId(item)] !== undefined && !groups.includes(talismanGroup(choiceId(item), rules)));
    if (talisman === undefined) break;
    gear.talismans.push(choiceId(talisman));
  }
  for (const weapon of [...gear.right, ...gear.left]) {
    const row = rules.weapons[baseRow(weapon.id)];
    if (!row || weapon.ash !== undefined || row[7] !== 2) continue;
    const ash = draw(pool.ashes ?? [], target, random, (item) => ashFits(choiceId(item), weapon.id, rules));
    if (ash !== undefined) weapon.ash = choiceId(ash);
  }
  gear.greatRune = drawGreatRune(pool.great_runes ?? [], target, random);
  return gear;
}

/** Where each attribute point came from. */
export type Allocation = { stats: number[]; base: number[]; requirement: number[]; plan: number[]; growth: number[]; points: number; overspent: number };

/** Requirements first (even past the points), then the stat plan one point per attribute in turn, then growth (library.rs allocate_planned). */
export function allocate(base: number[], growth: number[], needed: number[], plan: number[], points: number): Allocation {
  const stats = [...base];
  const progress = [0, 0, 0, 0, 0, 0, 0, 0];
  const fromRequirement = [0, 0, 0, 0, 0, 0, 0, 0];
  const fromPlan = [0, 0, 0, 0, 0, 0, 0, 0];
  const fromGrowth = [0, 0, 0, 0, 0, 0, 0, 0];
  let left = points;
  const raise = (index: number, source: number[]) => { stats[index] += 1; progress[index] += pointCost(index, stats[index]); source[index] += 1; };
  for (let index = 0; index < 8; index += 1) while (stats[index] < Math.min(needed[index], 99)) { raise(index, fromRequirement); left -= 1; }
  const overspent = Math.max(0, -left);
  while (left > 0) {
    let raised = false;
    for (let index = 0; index < 8; index += 1) {
      if (left > 0 && stats[index] < Math.min(plan[index], 99)) { raise(index, fromPlan); left -= 1; raised = true; }
    }
    if (!raised) break;
  }
  for (; left > 0; left -= 1) {
    const next = (index: number) => progress[index] + pointCost(index, stats[index] + 1);
    const weighted = [0, 1, 2, 3, 4, 5, 6, 7].filter((index) => growth[index] > 0 && stats[index] < 99);
    let chosen = weighted.length ? weighted.reduce((best, index) => (next(index) * growth[best] < next(best) * growth[index] ? index : best)) : undefined;
    if (chosen === undefined) {
      const open = [0, 1, 2, 3, 4, 5, 6, 7].filter((index) => stats[index] < 99);
      if (!open.length) break;
      chosen = open.reduce((best, index) => (stats[index] < stats[best] ? index : best));
    }
    raise(chosen, fromGrowth);
  }
  return { stats, base: [...base], requirement: fromRequirement, plan: fromPlan, growth: fromGrowth, points, overspent };
}

export function planFor(entry: Tarnished, level: number): StatPlan | undefined {
  return (entry.stats ?? []).filter((plan) => plan.level <= level).reduce<StatPlan | undefined>((best, plan) => (!best || plan.level > best.level ? plan : best), undefined);
}

export function planValues(plan?: StatPlan): number[] {
  return STATS.map((stat) => Number(plan?.[stat as keyof StatPlan] ?? 0));
}

export function growthValues(entry: Tarnished): number[] {
  return STATS.map((stat) => Number(entry.growth?.[stat] ?? 0));
}

/** What the mod loads: base.toml first, then this file (docs/LIBRARY.md, Tarnished library). */
export type MergedLibrary = {
  entries: Tarnished[];
  names: { male: string[]; female: string[] };
  gestures: { greetings: string[]; victories: string[] };
  consumables: { kinds: number; pool: Consumable[] };
  styles: Record<string, number>;
  personalities: Record<string, unknown>;
  chances: Chances;
  templateItems: [number, number][];
};

export function mergeLibraries(document: LibraryDocument, base?: LibraryDocument, includeBaseEntries = true): MergedLibrary {
  const merged: MergedLibrary = { entries: [], names: { male: [], female: [] }, gestures: { greetings: [], victories: [] }, consumables: { kinds: 0, pool: [] }, styles: {}, personalities: {}, chances: {}, templateItems: [] };
  const byId = new Map<string, Tarnished>();
  for (const [source, isBase] of [[base, true], [document, false]] as const) {
    if (!source) continue;
    for (const sex of ['male', 'female'] as const) {
      const extra = source.names?.[sex] ?? [];
      merged.names[sex] = [...merged.names[sex], ...extra.filter((name) => !merged.names[sex].includes(name))];
    }
    for (const kind of ['greetings', 'victories'] as const) if (source.gestures?.[kind]?.length) merged.gestures[kind] = [...source.gestures[kind]!];
    if (source.consumables?.kinds !== undefined) merged.consumables.kinds = source.consumables.kinds;
    if (source.consumables?.pool?.length) merged.consumables.pool = source.consumables.pool;
    Object.assign(merged.styles, source.styles ?? {});
    Object.assign(merged.personalities, source.personalities ?? {});
    for (const group of CHANCE_GROUPS) if (source.chances?.[group.key] !== undefined) merged.chances[group.key] = source.chances[group.key];
    const invader = (source.templates as Record<string, { items?: [number, number][] }> | undefined)?.invader;
    if (invader?.items) merged.templateItems = invader.items;
    if (isBase && !includeBaseEntries) continue;
    for (const entry of source.tarnished ?? []) byId.set(entry.id, entry);
  }
  merged.entries = [...byId.values()].filter((entry) => entry.enabled !== false);
  return merged;
}

export type Role = 'invader' | 'hunter' | 'host' | 'cooperator' | 'summon';
const ALL_ROLES: Role[] = ['invader', 'hunter', 'host', 'cooperator', 'summon'];

/** Whether the entry can take a role; an entry that can be a hunter can also be summoned. */
export function allows(entry: Tarnished, role: Role): boolean {
  const roles = entry.roles ?? ALL_ROLES;
  return roles.includes(role) || (role === 'summon' && roles.includes('hunter'));
}

export function chanceGroup(entry: Tarnished): 'named' | 'loadouts' | 'class_libraries' {
  if (isNamed(entry)) return 'named';
  return entry.pool ? 'class_libraries' : 'loadouts';
}

/** Each entry's share of the picks in percent (library.rs shares). */
export function shares(entries: Tarnished[], chances: Chances): number[] {
  const weight = (entry: Tarnished) => Math.max(entry.weight ?? DEFAULT_WEIGHT, 1);
  const fixed = entries.filter((entry) => entry.chance !== undefined).reduce((sum, entry) => sum + Math.max(entry.chance!, 0), 0);
  const rest = Math.max(100 - fixed, 0);
  const groups = new Map<string, { percent: number; total: number }>();
  let free = 0;
  for (const entry of entries) {
    if (entry.chance !== undefined) continue;
    const group = chanceGroup(entry);
    const percent = chances[group];
    if (percent !== undefined) {
      const known = groups.get(group) ?? { percent: Math.max(percent, 0), total: 0 };
      known.total += weight(entry);
      groups.set(group, known);
    } else free += weight(entry);
  }
  const requested = [...groups.values()].reduce((sum, group) => sum + group.percent, 0);
  const scale = requested > rest ? rest / requested : 1;
  const left = Math.max(rest - requested * scale, 0);
  const result = entries.map((entry) => {
    if (entry.chance !== undefined) return Math.max(entry.chance, 0);
    const group = groups.get(chanceGroup(entry));
    if (group) return (group.percent * scale * weight(entry)) / group.total;
    return free > 0 ? (left * weight(entry)) / free : 0;
  });
  return result.reduce((sum, share) => sum + share, 0) > 0 ? result : entries.map(weight);
}

export type Odds = { entry: Tarnished; percent: number };

/** Who can appear in a role at a player level, and how often (library.rs Library::choose, ignoring who is already present). */
export function appearanceOdds(library: MergedLibrary, role: Role, playerLevel: number, dlcInstalled = true): Odds[] {
  const usable = library.entries.filter((entry) => dlcInstalled || !entry.dlc);
  let eligible = usable.filter((entry) => allows(entry, role) && (entry.min_level ?? 0) <= playerLevel && playerLevel <= (entry.max_level ?? MAXIMUM_LEVEL));
  if (!eligible.length) {
    const fallback = usable.filter((entry) => allows(entry, role)).sort((a, b) => (a.min_level ?? 0) - (b.min_level ?? 0))[0];
    eligible = fallback ? [fallback] : [];
  }
  const values = shares(eligible, library.chances);
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  return eligible.map((entry, index) => ({ entry, percent: (100 * values[index]) / total })).sort((a, b) => b.percent - a.percent);
}

export type Sample = {
  entry: Tarnished;
  name: string;
  sex: 'male' | 'female';
  className?: string;
  start: number[];
  startLevel: number;
  playerLevel: number;
  target: number;
  level: number;
  budget: number;
  gear: Gear;
  needed: number[];
  weight: number;
  plan?: StatPlan;
  allocation: Allocation;
  style?: string;
  /** Holds a paired weapon in the right hand: the mod makes it two-hand it (library.rs wields_both). */
  twoHanded: boolean;
  greeting?: string;
  victory?: string;
  items: [number, number][];
  consumableIds: number[];
  /** Shadow of the Erdtree items taken out because the preview runs without the DLC. */
  dlcRemoved: number;
};

function pickOne<T>(list: T[], random: Random): T | undefined {
  return list.length ? list[random.below(list.length)] : undefined;
}

export type SampleOptions = { playerLevel: number; spread?: number; weaponProgress?: number; className?: string; random: Random; dlcInstalled?: boolean };

/**
 * Whether the mod makes the Tarnished two-hand its right weapon (library.rs wields_both): the held right
 * weapon is a paired weapon, and the left hand holds no catalyst and no weapon of the same type.
 */
export function wieldsBoth(gear: Gear, rules: Rules): boolean {
  const held = (hand: Weapon[]) => (hand[0] && hand[0].id > 0 ? rules.weapons[baseRow(hand[0].id)] : undefined);
  const right = held(gear.right);
  if (!right || !right[9]) return false;
  const left = held(gear.left);
  return !left || (left[6] !== STAFF && left[6] !== SEAL && left[6] !== right[6]);
}

/** One Tarnished of an entry, as the mod would build it for a player of this level. */
export function sampleTarnished(original: Tarnished, library: MergedLibrary, rules: Rules, options: SampleOptions): Sample {
  const { random } = options;
  // Without the DLC the mod takes its items out of the entry, the shared pool and the templates' items.
  const dlcInstalled = options.dlcInstalled ?? true;
  const stripped = dlcInstalled ? { entry: original, removed: 0 } : stripDlcItems(original);
  const entry = stripped.entry;
  const spread = options.spread ?? LEVEL_SPREAD;
  const classes = entry.attributes ? [] : Array.isArray(entry.class) ? entry.class : entry.class ? [entry.class] : [];
  const starts = startingSets(entry);
  let startIndex = options.className && classes.includes(options.className) ? classes.indexOf(options.className) : random.below(Math.max(starts.length, 1));
  if (startIndex >= starts.length) startIndex = 0;
  const start = starts[startIndex] ?? [10, 10, 10, 10, 10, 10, 10, 10];
  const startLevel = baseLevel(start);
  const offset = random.below(spread * 2 + 1) - spread;
  const target = Math.min(Math.max(options.playerLevel + offset, startLevel), MAXIMUM_LEVEL);
  const budget = target - startLevel;
  const gear = entry.pool ? generate(entry.pool, start, target, budget, rules, random) : entry.gear?.length ? chooseLoadout(entry.gear, start, target, budget, rules, random) : { level: 0, right: [], left: [], armor: [], talismans: [], spells: [] };
  if (!entry.pool) gear.spells = gear.spells.filter((spell) => !rules.spells[spell]?.[4]);
  const needed = requirements(gear, rules);
  const plan = planFor(entry, target);
  const allocation = allocate(start, growthValues(entry), needed, planValues(plan), budget);
  const sex = entry.sex === 'male' || entry.sex === 'female' ? entry.sex : random.below(2) === 0 ? 'male' : 'female';
  const own = entryNames(entry, sex);
  const names = own.length ? own : library.names[sex];
  const given = pickOne(names, random);
  const name = given ? (pickOne(entry.titles ?? [], random) ?? '{name}').replace('{name}', given) : entry.name;
  const style = pickOne(entry.styles ?? [], random);
  const greeting = pickOne(entry.greetings ?? library.gestures.greetings, random);
  const victory = pickOne(entry.victories ?? library.gestures.victories, random);
  const items: [number, number][] = [...(entry.items ?? library.templateItems)].filter(([id]) => dlcInstalled || !isDlcGoods(id)).map(([id, count]) => [id, count]);
  const consumableIds: number[] = [];
  const pool = (entry.consumables ?? library.consumables.pool).filter((consumable) => dlcInstalled || !isDlcGoods(consumable.id));
  const kinds = entry.consumable_kinds ?? library.consumables.kinds;
  for (let kind = 0; kind < kinds && items.length < ITEM_SLOTS; kind += 1) {
    const consumable = draw(pool, target, random, (candidate) => items.every(([id]) => id !== candidate.id));
    if (!consumable) break;
    items.push([consumable.id, consumable.count ?? 1]);
    consumableIds.push(consumable.id);
  }
  // Tarnished follow the player's best weapon: two levels either side on the +25 scale, one on the +10 scale.
  const progress = Math.max(0, Math.min(1, options.weaponProgress ?? 0));
  for (const weapon of [...gear.right.slice(0, 3), ...gear.left.slice(0, 3)]) {
    if (weapon.id < 0) continue;
    const maximum = rules.weapons[baseRow(weapon.id)]?.[8] ?? 0;
    if (weapon.upgrade !== undefined) { weapon.upgrade = Math.min(weapon.upgrade, maximum); continue; }
    const reach = maximum >= 25 ? 2 : maximum >= 10 ? 1 : 0;
    weapon.upgrade = Math.max(0, Math.min(maximum, Math.round(progress * maximum) + random.below(reach * 2 + 1) - reach));
  }
  return {
    entry: original, name, sex, className: entry.attributes ? undefined : classes[startIndex], start, startLevel, playerLevel: options.playerLevel, target,
    level: levelOfStats(allocation.stats), budget, gear, needed, weight: gearWeight(gear, rules), plan, allocation, style, twoHanded: wieldsBoth(gear, rules),
    greeting, victory, items, consumableIds, dlcRemoved: stripped.removed,
  };
}

/** Attributes by level without random gear: requirements of each level's first-option loadout, or none. */
export function growthTable(entry: Tarnished, start: number[], levels: number[], rules?: Rules, withGear = true): { level: number; allocation: Allocation; plan?: StatPlan; gearLevel?: number }[] {
  const startLevel = baseLevel(start);
  return levels.map((requested) => {
    const level = Math.min(Math.max(requested, startLevel), MAXIMUM_LEVEL);
    const budget = level - startLevel;
    let needed = [0, 0, 0, 0, 0, 0, 0, 0];
    let gearLevel: number | undefined;
    if (withGear && rules && entry.gear?.length) {
      const first = (loadout: Loadout): Gear => ({
        level: loadout.level,
        right: ((loadout.right ?? []) as Pick[]).map((pick) => weaponOf(pickOptions(pick)[0])),
        left: ((loadout.left ?? []) as Pick[]).map((pick) => weaponOf(pickOptions(pick)[0])),
        armor: loadout.armor_sets?.length ? [...pieces(loadout.armor_sets[0])] : ((loadout.armor ?? []) as Pick[]).map((pick) => choiceId(pickOptions(pick)[0])),
        talismans: [], spells: ((loadout.spells ?? []) as Pick[]).map((pick) => choiceId(pickOptions(pick)[0])),
      });
      const sorted = [...entry.gear].sort((a, b) => a.level - b.level).map(first);
      const chosen = [...sorted].reverse().find((gear) => gear.level <= level && cost(start, requirements(gear, rules)) <= budget) ?? sorted[0];
      needed = requirements(chosen, rules);
      gearLevel = chosen.level;
    }
    const plan = planFor(entry, level);
    return { level, allocation: allocate(start, growthValues(entry), needed, planValues(plan), budget), plan, gearLevel };
  });
}
