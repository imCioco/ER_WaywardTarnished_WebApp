import { parse, stringify } from 'smol-toml';
import { CHANCE_GROUPS, CLASSES, CLASS_STATS, GEAR_FIELDS, GREAT_RUNE_IDS, MOST_CONSUMABLES, ODDS_ACTIONS, ODDS_LIMIT, POOL_FIELDS, ROLES, STATS } from './constants';
import type { Presets } from './presets';
import type { ArmorChoice, Consumable, EquipmentPool, ItemChoice, LibraryDocument, Loadout, Personality, Pick, Tarnished, ValidationResult } from './types';

/** What the item catalog knows about a goods id: whether the AI can use it and its stack limit. */
export type GoodsLookup = (id: number) => { name: string; usable: boolean; limit: number } | undefined;

// The mod rejects unknown keys, so descriptions of styles and personalities live in comments, as in
// base.toml: a trailing comment on a [styles] line, and the comment lines right above [personalities.name].
const KEY = String.raw`("(?:[^"\\]|\\.)*"|[A-Za-z0-9_-]+)`;
const STYLE_LINE = new RegExp(String.raw`^\s*${KEY}\s*=\s*[^#]*?(?:#\s?(.*))?$`);
// [personalities.name], or [personalities.name.odds] when a personality has nothing but odds.
const PERSONALITY_HEADER = new RegExp(String.raw`^\s*\[\s*personalities\s*\.\s*${KEY}\s*(?:\.\s*odds\s*)?\]\s*(?:#.*)?$`);
const TABLE_HEADER = /^\s*\[/;

function keyName(key: string): string {
  return key.startsWith('"') ? JSON.parse(key) as string : key;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function readDescriptions(text: string): Record<string, string> {
  const descriptions: Record<string, string> = {};
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  let table = '';
  lines.forEach((line, index) => {
    const header = PERSONALITY_HEADER.exec(line);
    if (header) {
      const comments: string[] = [];
      for (let above = index - 1; above >= 0 && /^\s*#/.test(lines[above]); above -= 1) comments.unshift(lines[above].replace(/^\s*#\s?/, ''));
      const name = keyName(header[1]);
      if (comments.length && descriptions[name] === undefined) descriptions[name] = oneLine(comments.join(' '));
    }
    if (TABLE_HEADER.test(line)) { table = line.trim().replace(/\s*#.*$/, ''); return; }
    if (table !== '[styles]') return;
    const style = STYLE_LINE.exec(line);
    if (style?.[2]?.trim()) descriptions[keyName(style[1])] = oneLine(style[2]);
  });
  return descriptions;
}

function writeDescriptions(text: string, descriptions: Record<string, string>): string {
  let table = '';
  const written = new Set<string>();
  return text.split('\n').map((line) => {
    const header = PERSONALITY_HEADER.exec(line);
    if (header) {
      table = line.trim();
      const name = keyName(header[1]);
      const description = written.has(name) ? undefined : descriptions[name];
      written.add(name);
      return description ? `# ${oneLine(description)}\n${line}` : line;
    }
    if (TABLE_HEADER.test(line)) { table = line.trim(); return line; }
    const style = table === '[styles]' ? STYLE_LINE.exec(line) : null;
    const description = style ? descriptions[keyName(style[1])] : undefined;
    return description ? `${line}   # ${oneLine(description)}` : line;
  }).join('\n');
}

export function parseLibrary(text: string): LibraryDocument {
  const parsed = parse(text.replace(/^﻿/, '')) as unknown as LibraryDocument;
  if (!parsed || typeof parsed !== 'object') throw new Error('The selected file is not a TOML library.');
  if (parsed.tarnished === undefined) parsed.tarnished = [];
  if (!Array.isArray(parsed.tarnished)) throw new Error('The library needs [[tarnished]] entries.');
  const descriptions = readDescriptions(text);
  if (Object.keys(descriptions).length) parsed.__descriptions = descriptions;
  return parsed;
}

export function serializeLibrary(document: LibraryDocument): string {
  const heading = '# Wayward Tarnished library — exported by Library Studio\n\n';
  const { __descriptions: descriptions, ...library } = document;
  return heading + writeDescriptions(stringify(library as never), descriptions ?? {});
}

/** Where a style or personality comes from: this file, the mod's base.toml, or the presets saved in this browser. */
export type ArchetypeSource = 'file' | 'base' | 'saved';

/** A style or personality the library can use. */
export type Archetype = {
  name: string;
  kind: 'style' | 'personality';
  description?: string;
  /** A vanilla style's SpEffect. */
  effect?: number;
  personality?: Personality;
  /** Not defined in this file: a preset from base.toml or this browser, copied into the file when a Tarnished uses it. */
  inherited: boolean;
  source: ArchetypeSource;
  /** Also kept as a preset in this browser. */
  saved?: boolean;
};

/**
 * Every style and personality a file can use: its own, the mod's base.toml presets and the presets saved
 * in this browser. A name defined in several places takes this file's definition, else the saved preset's
 * (your own version), else base.toml's.
 */
export function archetypes(document: LibraryDocument, base?: LibraryDocument, presets?: Presets): Archetype[] {
  const result = new Map<string, Archetype>();
  const add = (archetype: Omit<Archetype, 'inherited' | 'description'> & { description?: string }) => {
    const earlier = result.get(archetype.name);
    result.set(archetype.name, { ...archetype, description: archetype.description ?? earlier?.description, inherited: archetype.source !== 'file' });
  };
  for (const [name, effect] of Object.entries(base?.styles ?? {})) add({ name, kind: 'style', effect, description: base?.__descriptions?.[name], source: 'base' });
  for (const [name, personality] of Object.entries(base?.personalities ?? {})) add({ name, kind: 'personality', personality, description: base?.__descriptions?.[name], source: 'base' });
  for (const [name, preset] of Object.entries(presets?.styles ?? {})) add({ name, kind: 'style', effect: preset.effect, description: preset.description, source: 'saved' });
  for (const [name, preset] of Object.entries(presets?.personalities ?? {})) add({ name, kind: 'personality', personality: preset.personality, description: preset.description, source: 'saved' });
  for (const [name, effect] of Object.entries(document.styles ?? {})) add({ name, kind: 'style', effect, description: document.__descriptions?.[name], source: 'file' });
  for (const [name, personality] of Object.entries(document.personalities ?? {})) add({ name, kind: 'personality', personality, description: document.__descriptions?.[name], source: 'file' });
  for (const archetype of result.values()) {
    archetype.saved = Boolean(presets?.personalities[archetype.name] ?? presets?.styles[archetype.name]);
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Copies a preset's definition (and description) into the file, so the file carries what its Tarnished use. */
export function adoptArchetype(document: LibraryDocument, archetype: Archetype): void {
  if (archetype.source === 'file') return;
  if (archetype.kind === 'personality' && archetype.personality) {
    document.personalities = { ...(document.personalities ?? {}), [archetype.name]: structuredClone(archetype.personality) };
  } else if (archetype.kind === 'style' && archetype.effect !== undefined) {
    document.styles = { ...(document.styles ?? {}), [archetype.name]: archetype.effect };
  } else return;
  if (archetype.description) document.__descriptions = { ...(document.__descriptions ?? {}), [archetype.name]: archetype.description };
}

/** The file with a definition for every style its Tarnished use that it does not define yet (from base.toml or the saved presets). */
export function withUsedArchetypes(document: LibraryDocument, available: Archetype[]): LibraryDocument {
  const byName = new Map(available.map((archetype) => [archetype.name, archetype]));
  const missing = [...new Set(document.tarnished.flatMap((entry) => entry.styles ?? []))]
    .map((name) => byName.get(name))
    .filter((archetype): archetype is Archetype => Boolean(archetype && archetype.source !== 'file'));
  if (!missing.length) return document;
  const next = structuredClone(document);
  for (const archetype of missing) adoptArchetype(next, archetype);
  return next;
}

/** One fixed name for either sex (library.rs Names::single): the entry is a single person. */
export function isNamed(entry: Tarnished): boolean {
  return Array.isArray(entry.names) && entry.names.length === 1;
}

/** The entry's own given names for a sex; empty means the shared [names]. */
export function entryNames(entry: Tarnished, sex: 'male' | 'female'): string[] {
  const names = entry.names;
  if (!names) return [];
  return Array.isArray(names) ? names : names[sex] ?? [];
}

// Shadow of the Erdtree's items by id range (src/library.rs dlc_weapon and the others): weapons numbered
// x5xx0000 in any affinity, armor from 3000000, talismans from 7000, spells and goods from 2000000, Ashes
// of War from 200000. Without the DLC the mod takes them out of every entry.
export const isDlcWeapon = (id: number) => id > 0 && Math.floor(id / 10000) % 100 >= 50;
export const isDlcArmor = (id: number) => id >= 3000000;
export const isDlcTalisman = (id: number) => id >= 7000;
export const isDlcGoods = (id: number) => id >= 2000000;
export const isDlcAsh = (id: number) => id >= 200000;

/**
 * The entry as the mod uses it without Shadow of the Erdtree (library.rs strip_dlc_items), and how many
 * items were taken out: a weapon whose ash alone is from the DLC keeps its place without the ash, an armor
 * piece left without options is empty, an armor set with a DLC piece goes, and a loadout left without its
 * right-hand weapons or armor sets goes.
 */
export function stripDlcItems(entry: Tarnished): { entry: Tarnished; removed: number } {
  const next = structuredClone(entry);
  let removed = 0;
  const keepWeapon = (choice: ItemChoice): ItemChoice | undefined => {
    if (isDlcWeapon(choiceId(choice))) { removed += 1; return undefined; }
    if (typeof choice === 'object' && choice.ash !== undefined && isDlcAsh(choice.ash)) {
      removed += 1;
      const { ash: _ash, ...rest } = choice;
      return Object.keys(rest).length === 1 ? rest.id : rest;
    }
    return choice;
  };
  const keep = (dlc: (id: number) => boolean) => (choice: ItemChoice): ItemChoice | undefined => {
    if (dlc(choiceId(choice))) { removed += 1; return undefined; }
    return choice;
  };
  const slot = (pick: Pick, accept: (choice: ItemChoice) => ItemChoice | undefined): Pick | undefined => {
    const kept = pickOptions(pick).map(accept).filter((choice): choice is ItemChoice => choice !== undefined);
    if (Array.isArray(pick)) return kept.length ? kept : undefined;
    return kept[0];
  };
  const baseSets = (sets: ArmorChoice[]) => sets.filter((set) => {
    const dlc = (armorSetPieces(set) ?? []).some(isDlcArmor);
    if (dlc) removed += 1;
    return !dlc;
  });
  if (next.gear) {
    next.gear = next.gear.filter((gear) => {
      const hadRight = Boolean(gear.right?.length);
      const hadSets = Boolean(gear.armor_sets?.length);
      for (const hand of ['right', 'left'] as const) {
        if (gear[hand]) gear[hand] = gear[hand]!.map((pick) => slot(pick, keepWeapon)).filter((pick): pick is Pick => pick !== undefined);
      }
      if (gear.armor) gear.armor = gear.armor.map((pick) => slot(pick, keep(isDlcArmor)) ?? -1);
      if (gear.armor_sets) gear.armor_sets = baseSets(gear.armor_sets);
      for (const [key, dlc] of [['talismans', isDlcTalisman], ['spells', isDlcGoods]] as const) {
        if (gear[key]) gear[key] = gear[key]!.map((pick) => slot(pick, keep(dlc))).filter((pick): pick is Pick => pick !== undefined);
      }
      return !(hadRight && !gear.right?.length) && !(hadSets && !gear.armor_sets?.length);
    });
  }
  if (next.pool) {
    const pool = next.pool;
    for (const hand of ['right', 'left', 'catalysts'] as const) {
      if (pool[hand]) pool[hand] = pool[hand]!.map(keepWeapon).filter((choice): choice is ItemChoice => choice !== undefined) as ItemChoice[];
    }
    if (pool.armor) pool.armor = baseSets(pool.armor);
    for (const [key, dlc] of [['talismans', isDlcTalisman], ['spells', isDlcGoods], ['ashes', isDlcAsh]] as const) {
      if (pool[key]) pool[key] = pool[key]!.map(keep(dlc)).filter((choice): choice is ItemChoice => choice !== undefined);
    }
  }
  if (next.consumables) next.consumables = next.consumables.filter((consumable) => { const dlc = isDlcGoods(consumable.id); if (dlc) removed += 1; return !dlc; });
  if (next.items) next.items = next.items.filter(([id]) => { const dlc = isDlcGoods(id); if (dlc) removed += 1; return !dlc; });
  return { entry: next, removed };
}

/** Whether an entry has something to fight with (library.rs armed): a loadout, or a pool with right-hand weapons. */
export function armed(entry: Tarnished): boolean {
  return entry.pool ? Boolean(entry.pool.right?.length) : Boolean(entry.gear?.length);
}

function validatePersonalities(document: LibraryDocument, errors: string[]): void {
  for (const [name, personality] of Object.entries(document.personalities ?? {})) {
    const label = `Personality “${name}”`;
    if (!/^[A-Za-z0-9_-]+$/.test(name)) errors.push(`${label}: use only letters, digits, - and _ in the name.`);
    if (document.styles?.[name] !== undefined) errors.push(`${label}: has the name of a style.`);
    if (typeof personality.odds !== 'object' || personality.odds === null) errors.push(`${label}: odds are required.`);
    for (const [action, value] of Object.entries(personality.odds ?? {})) {
      if (!ODDS_ACTIONS.includes(action)) errors.push(`${label}: unknown action “${action}”.`);
      if (!isWhole(value, -32768, 32767)) errors.push(`${label}: ${action} must be a whole number from -${ODDS_LIMIT} to ${ODDS_LIMIT}.`);
    }
    for (const effect of personality.suppress ?? []) if (!isWhole(effect, 0, 2147483647)) errors.push(`${label}: suppressed SpEffect IDs must be whole numbers.`);
  }
}

export function copyLibrary<T>(value: T): T {
  return structuredClone(value);
}

export function choiceId(choice: ItemChoice): number {
  return typeof choice === 'number' ? choice : choice.id;
}

export function nextEnemyId(entries: Tarnished[]): string {
  const used = new Set(entries.map((entry) => entry.id));
  let number = 1;
  while (used.has(`new-tarnished-${number}`)) number += 1;
  return `new-tarnished-${number}`;
}

export function newEnemy(entries: Tarnished[], mode: 'gear' | 'pool'): Tarnished {
  const base: Tarnished = {
    id: nextEnemyId(entries),
    name: mode === 'pool' ? 'New Random Pool' : 'New Tarnished',
    class: 'vagabond',
    roles: [...ROLES],
    weight: 10,
    min_level: 1,
    max_level: 713,
    sex: 'any',
    enabled: true,
    growth: { vigor: 4, endurance: 2, strength: 4 },
  };
  if (mode === 'pool') base.pool = { right: [2000000], left: [-1] };
  else base.gear = [{ level: 1, right: [2000000], left: [], armor: [-1, -1, -1, -1], talismans: [], spells: [] }];
  return base;
}

/** The starting attributes an entry may use: its own, or one per class (library.rs Tarnished::starts). */
export function startingSets(entry: Tarnished): number[][] {
  if (entry.attributes) return [STATS.map((stat) => Number(entry.attributes?.[stat] ?? 0))];
  const classes = Array.isArray(entry.class) ? entry.class : entry.class ? [entry.class] : [];
  return classes.filter((name) => CLASS_STATS[name]).map((name) => [...CLASS_STATS[name]]);
}

/** Level of a set of attributes, as in the game: their sum minus 79, at least 1. */
export function baseLevel(stats: number[]): number {
  return Math.max(stats.reduce((sum, value) => sum + value, 0) - 79, 1);
}

function isWhole(value: unknown, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function validateChoice(choice: unknown, path: string, errors: string[], allowEmpty = false): void {
  if (typeof choice === 'object' && choice !== null && !Array.isArray(choice)) {
    const record = choice as Record<string, unknown>;
    if (!isWhole(record.id, allowEmpty ? -1 : 0, 2147483647)) errors.push(`${path}: item ID must be a whole number.`);
    if (record.level !== undefined && !isWhole(record.level, 0, 4294967295)) errors.push(`${path}: minimum level must be zero or higher.`);
    if (record.weight !== undefined && !isWhole(record.weight, 0, 4294967295)) errors.push(`${path}: weight must be zero or higher.`);
    return;
  }
  if (!isWhole(choice, allowEmpty ? -1 : 0, 2147483647)) errors.push(`${path}: item ID must be a whole number.`);
}

/** Great rune options: whole ids, each one of the six great runes or -1 for none (library.rs check_great_rune). */
function validateGreatRunes(choices: ItemChoice[], path: string, errors: string[]): void {
  choices.forEach((choice) => {
    validateChoice(choice, path, errors, true);
    const id = choiceId(choice);
    if (Number.isInteger(id) && id !== -1 && !GREAT_RUNE_IDS.includes(id)) errors.push(`${path}: ${id} is not a great rune (${GREAT_RUNE_IDS.join(', ')}, or none).`);
  });
}

function validateConsumables(list: unknown, owner: string, errors: string[], goods?: GoodsLookup): void {
  if (!Array.isArray(list)) { errors.push(`${owner}: consumables must be a list.`); return; }
  (list as Consumable[]).forEach((consumable, index) => {
    const path = `${owner} ${index + 1}`;
    if (typeof consumable !== 'object' || consumable === null || !isWhole(consumable.id, 0, 2147483647)) { errors.push(`${path}: goods ID must be a whole number.`); return; }
    const known = goods?.(consumable.id);
    const limit = known?.limit ?? MOST_CONSUMABLES;
    if (known && !known.usable) errors.push(`${path}: ${known.name} is not an item the AI can use.`);
    if (consumable.count !== undefined && !isWhole(consumable.count, 1, limit)) errors.push(`${path}: count must be from 1 to ${limit}.`);
    if (consumable.level !== undefined && !isWhole(consumable.level, 0, 4294967295)) errors.push(`${path}: minimum level must be zero or higher.`);
    if (consumable.weight !== undefined && !isWhole(consumable.weight, 0, 4294967295)) errors.push(`${path}: weight must be zero or higher.`);
  });
}

export type ValidateOptions = {
  gestures?: string[];
  goods?: GoodsLookup;
  /** The mod's base.toml, loaded before this file: its styles, personalities and templates apply here too. */
  base?: LibraryDocument;
  /** Styles and personalities saved in this browser; a file that uses one gets its definition on download. */
  presets?: Presets;
};

/** The options of a loadout slot: one item or a list of options. */
export function pickOptions(pick: Pick): ItemChoice[] {
  return Array.isArray(pick) ? pick : [pick];
}

function armorSetPieces(choice: ArmorChoice): number[] | undefined {
  return Array.isArray(choice) ? choice : choice?.set;
}

function validateNames(entry: Tarnished, label: string, errors: string[]): void {
  const names = entry.names;
  if (names === undefined) return;
  const lists = Array.isArray(names) ? [names] : typeof names === 'object' && names !== null ? Object.values(names) : null;
  if (!lists) { errors.push(`${label}: names must be a list, or male and female lists.`); return; }
  if (!Array.isArray(names) && Object.keys(names).some((sex) => sex !== 'male' && sex !== 'female')) errors.push(`${label}: names by sex take only male and female lists.`);
  if (lists.some((list) => !Array.isArray(list) || list.some((name) => typeof name !== 'string' || !name.trim()))) errors.push(`${label}: every given name must be text.`);
}

export function validateLibrary(document: LibraryDocument, options: ValidateOptions = {}): ValidationResult {
  const { gestures: gestureNames = [], goods, base, presets } = options;
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries = document.tarnished ?? [];
  const ids = new Set<string>();
  const validGestures = new Set(gestureNames);
  const knownStyles = new Set(archetypes(document, base, presets).map((archetype) => archetype.name));
  // Each Ash of War in a loadout borrows one custom weapon row; the mod allows as many as the smallest template has.
  const templates = { ...(base?.templates ?? {}), ...(document.templates ?? {}) } as Record<string, { custom_weapons?: unknown[] }>;
  const customRows = Object.values(templates).length ? Math.min(...Object.values(templates).map((template) => template?.custom_weapons?.length ?? 0)) : undefined;
  validatePersonalities(document, errors);

  entries.forEach((entry, index) => {
    const label = entry.name?.trim() || `Entry ${index + 1}`;
    if (!entry.id?.trim()) errors.push(`${label}: ID is required.`);
    else if (ids.has(entry.id)) errors.push(`${label}: duplicate ID “${entry.id}”.`);
    else ids.add(entry.id);
    if (!entry.name?.trim()) errors.push(`${label}: name is required.`);
    if ((entry.min_level ?? 0) > (entry.max_level ?? 713)) errors.push(`${label}: minimum level exceeds maximum level.`);
    const classes = Array.isArray(entry.class) ? entry.class : entry.class ? [entry.class] : [];
    if (entry.attributes) {
      const missing = STATS.filter((stat) => !isWhole(entry.attributes?.[stat], 1, 99));
      if (missing.length) errors.push(`${label}: custom starting attributes need all eight, each from 1 to 99 (${missing.join(', ')}).`);
    } else if (!classes.length || classes.some((value) => !CLASSES.includes(value))) errors.push(`${label}: choose at least one valid starting class.`);
    if (entry.chance !== undefined && !(typeof entry.chance === 'number' && entry.chance >= 0 && entry.chance <= 100)) errors.push(`${label}: fixed chance must be from 0 to 100 percent.`);
    const lowestStart = startingSets(entry).reduce((lowest, start) => Math.min(lowest, baseLevel(start)), Infinity);
    (entry.stats ?? []).forEach((plan, planIndex) => {
      const where = `${label} / stat plan ${planIndex + 1}`;
      if (typeof plan !== 'object' || plan === null) { errors.push(`${where}: must be a table.`); return; }
      if (!isWhole(plan.level, 0, 4294967295)) errors.push(`${where}: level must be a whole number.`);
      for (const [key, value] of Object.entries(plan)) {
        if (key === 'level') continue;
        if (!STATS.includes(key)) errors.push(`${where}: unknown attribute “${key}”.`);
        else if (!isWhole(value, 0, 99)) errors.push(`${where}: ${key} must be from 0 to 99.`);
      }
      const start = startingSets(entry)[0];
      if (start && Number.isFinite(lowestStart) && isWhole(plan.level, 0, 4294967295)) {
        const needed = STATS.reduce((sum, stat, index) => sum + Math.max(0, Number(plan[stat as keyof typeof plan] ?? 0) - start[index]), 0);
        const available = Math.max(plan.level - lowestStart, 0);
        if (needed > available) warnings.push(`${where} (level ${plan.level}) needs ${needed} points but that level gives only ${available}; it is reached as far as the points go.`);
      }
    });
    if (entry.roles && (!entry.roles.length || entry.roles.some((value) => !ROLES.includes(value)))) errors.push(`${label}: select at least one valid role.`);
    validateNames(entry, label, errors);
    for (const title of entry.titles ?? []) {
      if ((title.match(/\{name\}/g) ?? []).length > 1) errors.push(`${label}: title “${title}” uses {name} more than once.`);
    }
    for (const field of ['greetings', 'victories'] as const) {
      for (const gesture of entry[field] ?? []) {
        if (validGestures.size && !validGestures.has(gesture)) errors.push(`${label}: unknown ${field} gesture “${gesture}”.`);
      }
    }
    for (const style of entry.styles ?? []) {
      if (!knownStyles.has(style)) errors.push(`${label}: style “${style}” is not a style or personality.`);
    }
    for (const statField of ['growth', 'attributes'] as const) {
      const values = entry[statField];
      if (!values) continue;
      for (const [stat, value] of Object.entries(values)) {
        if (!STATS.includes(stat)) errors.push(`${label}: unknown stat “${stat}”.`);
        const minimum = statField === 'attributes' ? 1 : 0;
        const maximum = statField === 'attributes' ? 99 : 255;
        if (!isWhole(value, minimum, maximum)) errors.push(`${label}: ${stat} must be from ${minimum} to ${maximum}.`);
      }
    }
    if (entry.consumables !== undefined) validateConsumables(entry.consumables, `${label} / consumable`, errors, goods);
    if (entry.consumable_kinds !== undefined && !isWhole(entry.consumable_kinds, 0, 10)) errors.push(`${label}: different consumables must be from 0 to 10.`);
    const hasGear = Array.isArray(entry.gear) && entry.gear.length > 0;
    const hasPool = Boolean(entry.pool);
    if (hasGear === hasPool) errors.push(`${label}: use either level loadouts or one random pool.`);
    entry.gear?.forEach((gear, gearIndex) => {
      const where = `${label} / loadout ${gearIndex + 1} (level ${gear.level})`;
      if (!isWhole(gear.level, 0, 4294967295)) errors.push(`${where}: level is required.`);
      if (gear.weight !== undefined && !isWhole(gear.weight, 0, 4294967295)) errors.push(`${where}: variant weight must be zero or higher.`);
      for (const field of GEAR_FIELDS) {
        const slots = gear[field.key as keyof Loadout];
        if (!Array.isArray(slots)) continue;
        if (field.limit && slots.length > field.limit) errors.push(`${where}: ${field.label} allows at most ${field.limit} slots.`);
        (slots as Pick[]).forEach((pick, slotIndex) => {
          if (Array.isArray(pick) && !pick.length) errors.push(`${where}: ${field.label} slot ${slotIndex + 1} has an empty list of options.`);
          pickOptions(pick).forEach((choice) => validateChoice(choice, `${where} / ${field.label} ${slotIndex + 1}`, errors, field.key === 'armor' || field.key === 'left'));
        });
      }
      if (gear.great_rune !== undefined) {
        if (Array.isArray(gear.great_rune) && !gear.great_rune.length) errors.push(`${where}: Great Rune has an empty list of options.`);
        validateGreatRunes(pickOptions(gear.great_rune), `${where} / Great Rune`, errors);
      }
      if (gear.armor?.length && gear.armor_sets?.length) errors.push(`${where}: uses both armor pieces and armor sets; pick one.`);
      gear.armor_sets?.forEach((choice, setIndex) => {
        const set = armorSetPieces(choice);
        if (!Array.isArray(set) || set.length !== 4) errors.push(`${where} / armor set ${setIndex + 1}: choose head, chest, arms and legs.`);
        else set.forEach((piece) => validateChoice(piece, `${where} / armor set ${setIndex + 1}`, errors, true));
      });
      for (const ammo of ['arrows', 'bolts'] as const) {
        const value = gear[ammo];
        if (value !== undefined && (!Array.isArray(value) || value.length !== 2 || !isWhole(value[0], 0, 2147483647) || !isWhole(value[1], 1, 99))) errors.push(`${where}: ${ammo} needs an item and a count from 1 to 99.`);
      }
      const ashes = [...(gear.right ?? []), ...(gear.left ?? [])].filter((pick) => pickOptions(pick).some((choice) => typeof choice === 'object' && choice.ash !== undefined)).length;
      if (customRows !== undefined && ashes > customRows) errors.push(`${where}: uses ${ashes} Ashes of War but the templates borrow only ${customRows} custom weapon rows.`);
    });
    if (entry.pool) {
      if (!entry.pool.right?.length) errors.push(`${label} / pool: add at least one right-hand weapon.`);
      if (entry.pool.spells?.length && !entry.pool.catalysts?.length) errors.push(`${label} / pool: spells need at least one catalyst.`);
      for (const field of POOL_FIELDS) {
        const values = entry.pool[field.key as keyof EquipmentPool];
        if (!Array.isArray(values)) continue;
        if (field.key === 'armor') {
          values.forEach((choice, choiceIndex) => {
            const set = armorSetPieces(choice as ArmorChoice);
            if (!Array.isArray(set) || set.length !== 4) errors.push(`${label} / armor set ${choiceIndex + 1}: choose head, chest, arms and legs.`);
            else set.forEach((piece, pieceIndex) => validateChoice(piece, `${label} / armor set ${choiceIndex + 1}.${pieceIndex + 1}`, errors, true));
          });
        } else if (field.key === 'great_runes') validateGreatRunes(values as ItemChoice[], `${label} / ${field.label}`, errors);
        else values.forEach((choice, choiceIndex) => validateChoice(choice, `${label} / ${field.label} ${choiceIndex + 1}`, errors, ['left', 'catalysts'].includes(field.key)));
      }
    }
    // Without the DLC the mod takes its items out of the entry; one left with nothing is left out.
    if (!entry.dlc && (hasGear || hasPool) && !armed(stripDlcItems(entry).entry)) {
      warnings.push(`${label}: without Shadow of the Erdtree it has nothing left to fight with, so players without the DLC never meet it; turn on “Uses Shadow of the Erdtree” to say so, or add base-game weapons.`);
    }
  });

  for (const field of ['greetings', 'victories'] as const) {
    for (const gesture of document.gestures?.[field] ?? []) {
      if (validGestures.size && !validGestures.has(gesture)) errors.push(`Shared gestures: unknown ${field} gesture “${gesture}”.`);
    }
  }
  for (const [group, percent] of Object.entries(document.chances ?? {})) {
    if (!CHANCE_GROUPS.some((known) => known.key === group)) errors.push(`Appearance odds: unknown group “${group}”.`);
    else if (!(typeof percent === 'number' && percent >= 0 && percent <= 100)) errors.push(`Appearance odds: ${group} must be from 0 to 100 percent.`);
  }
  if (document.consumables) {
    const { kinds, pool } = document.consumables;
    if (kinds !== undefined && !isWhole(kinds, 0, 10)) errors.push('Shared consumables: kinds must be from 0 to 10.');
    if (pool !== undefined) validateConsumables(pool, 'Shared consumable', errors, goods);
  } else warnings.push('Shared consumables are inherited from another library file.');
  if (!entries.length) warnings.push('This library has no Tarnished entries yet.');
  if (!document.templates?.invader) warnings.push('Templates are inherited; install this file alongside base.toml.');
  if (!document.gestures) warnings.push('Shared gestures are inherited from another library file.');
  return { errors, warnings };
}

export function poolChoiceCount(pool: EquipmentPool | undefined): number {
  if (!pool) return 0;
  return POOL_FIELDS.reduce((count, field) => count + (Array.isArray(pool[field.key as keyof EquipmentPool]) ? (pool[field.key as keyof EquipmentPool] as unknown[]).length : 0), 0);
}
