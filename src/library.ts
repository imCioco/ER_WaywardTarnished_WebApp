import { parse, stringify } from 'smol-toml';
import { CLASSES, GEAR_FIELDS, MOST_CONSUMABLES, ODDS_ACTIONS, ODDS_LIMIT, POOL_FIELDS, ROLES, STATS } from './constants';
import type { Consumable, EquipmentPool, ItemChoice, LibraryDocument, Personality, Tarnished, ValidationResult } from './types';

/** What the item catalog knows about a goods id: whether the AI can use it and its stack limit. */
export type GoodsLookup = (id: number) => { name: string; usable: boolean; limit: number } | undefined;

// The mod rejects unknown keys, so descriptions of styles and personalities live in comments, as in
// base.toml: a trailing comment on a [styles] line, and the comment lines right above [personalities.name].
const KEY = String.raw`("(?:[^"\\]|\\.)*"|[A-Za-z0-9_-]+)`;
const STYLE_LINE = new RegExp(String.raw`^\s*${KEY}\s*=\s*[^#]*?(?:#\s?(.*))?$`);
const PERSONALITY_HEADER = new RegExp(String.raw`^\s*\[\s*personalities\s*\.\s*${KEY}\s*\]\s*(?:#.*)?$`);
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
      if (comments.length) descriptions[keyName(header[1])] = oneLine(comments.join(' '));
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
  return text.split('\n').map((line) => {
    const header = PERSONALITY_HEADER.exec(line);
    if (header) {
      table = line.trim();
      const description = descriptions[keyName(header[1])];
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

/** A style or personality the library can use, from this file or from the mod's base.toml. */
export type Archetype = {
  name: string;
  kind: 'style' | 'personality';
  description?: string;
  effect: number;
  personality?: Personality;
  /** Defined only in base.toml, which the mod loads before this file. */
  inherited: boolean;
};

export function archetypes(document: LibraryDocument, base?: LibraryDocument): Archetype[] {
  const result = new Map<string, Archetype>();
  for (const [source, inherited] of [[base, true], [document, false]] as const) {
    if (!source) continue;
    for (const [name, effect] of Object.entries(source.styles ?? {})) {
      result.set(name, { name, kind: 'style', effect, description: source.__descriptions?.[name] ?? result.get(name)?.description, inherited });
    }
    for (const [name, personality] of Object.entries(source.personalities ?? {})) {
      result.set(name, { name, kind: 'personality', effect: personality.effect, personality, description: source.__descriptions?.[name] ?? result.get(name)?.description, inherited });
    }
  }
  // An inherited personality whose slot this file's personality wins is dropped by the mod.
  const owners = slotOwners(document, base);
  return [...result.values()]
    .filter((archetype) => !(archetype.inherited && archetype.kind === 'personality' && owners.get(archetype.effect) !== archetype.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Where each personality slot goes once the mod merges base.toml and this file, in its name order. */
export function slotOwners(document: LibraryDocument, base?: LibraryDocument): Map<number, string> {
  const merged = { ...(base?.personalities ?? {}), ...(document.personalities ?? {}) };
  const owners = new Map<number, string>();
  for (const name of Object.keys(merged).sort()) {
    const { effect } = merged[name];
    if (!owners.has(effect)) owners.set(effect, name);
  }
  return owners;
}

/** Validates this file's personalities and, given base.toml, how they merge with the shipped ones. */
function validatePersonalities(document: LibraryDocument, errors: string[], warnings: string[], base?: LibraryDocument): void {
  const personalities = document.personalities ?? {};
  const claimed = new Map<string, string>();
  for (const [name, personality] of Object.entries(personalities)) {
    const label = `Personality “${name}”`;
    if (!/^[A-Za-z0-9_-]+$/.test(name)) errors.push(`${label}: use only letters, digits, - and _ in the name.`);
    if (document.styles?.[name] !== undefined) errors.push(`${label}: has the name of a style.`);
    if (!Number.isInteger(personality.effect) || !Number.isInteger(personality.row)) { errors.push(`${label}: choose a personality slot.`); continue; }
    for (const [key, value] of [[`effect ${personality.effect}`, name], [`row ${personality.row}`, name]]) {
      const owner = claimed.get(key);
      if (owner) errors.push(`${label}: shares its ${key.split(' ')[0]} with “${owner}”; every personality needs its own slot.`);
      else claimed.set(key, value);
    }
    if (typeof personality.odds !== 'object' || personality.odds === null) errors.push(`${label}: odds are required.`);
    for (const [action, value] of Object.entries(personality.odds ?? {})) {
      if (!ODDS_ACTIONS.includes(action)) errors.push(`${label}: unknown action “${action}”.`);
      if (!isWhole(value, -32768, 32767)) errors.push(`${label}: ${action} must be a whole number from -${ODDS_LIMIT} to ${ODDS_LIMIT}.`);
    }
    for (const effect of personality.suppress ?? []) if (!isWhole(effect, 0, 2147483647)) errors.push(`${label}: suppressed SpEffect IDs must be whole numbers.`);
  }
  if (!base?.personalities) return;
  // Installed beside base.toml, both files' personalities meet; the first by name keeps a shared slot.
  const owners = slotOwners(document, base);
  for (const [name, personality] of Object.entries(personalities)) {
    const owner = owners.get(personality.effect);
    const rival = Object.entries(base.personalities).find(([other, shipped]) => other !== name && personalities[other] === undefined && shipped.effect === personality.effect)?.[0];
    if (!rival) continue;
    if (owner === name) warnings.push(`Personality “${name}” takes base.toml’s “${rival}” slot when installed beside it; “${rival}” is then dropped and Tarnished that use it lose that style.`);
    else warnings.push(`Personality “${name}” shares its slot with base.toml’s “${rival}”, and the mod keeps “${rival}” (first by name). Name it “${rival}” to replace it, or install this file instead of base.toml.`);
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

/** `base` is the mod's base.toml: the file the mod loads first, whose styles and personalities this one can use. */
export function validateLibrary(document: LibraryDocument, gestureNames: string[] = [], goods?: GoodsLookup, base?: LibraryDocument): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries = document.tarnished ?? [];
  const ids = new Set<string>();
  const validGestures = new Set(gestureNames);
  const knownStyles = new Set(archetypes(document, base).map((archetype) => archetype.name));
  validatePersonalities(document, errors, warnings, base);

  entries.forEach((entry, index) => {
    const label = entry.name?.trim() || `Entry ${index + 1}`;
    if (!entry.id?.trim()) errors.push(`${label}: ID is required.`);
    else if (ids.has(entry.id)) errors.push(`${label}: duplicate ID “${entry.id}”.`);
    else ids.add(entry.id);
    if (!entry.name?.trim()) errors.push(`${label}: name is required.`);
    if ((entry.min_level ?? 0) > (entry.max_level ?? 713)) errors.push(`${label}: minimum level exceeds maximum level.`);
    const classes = Array.isArray(entry.class) ? entry.class : entry.class ? [entry.class] : [];
    if (!classes.length || classes.some((value) => !CLASSES.includes(value))) errors.push(`${label}: choose at least one valid starting class.`);
    if (entry.roles && (!entry.roles.length || entry.roles.some((value) => !ROLES.includes(value)))) errors.push(`${label}: select at least one valid role.`);
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
    const hasGear = Array.isArray(entry.gear) && entry.gear.length > 0;
    const hasPool = Boolean(entry.pool);
    if (hasGear === hasPool) errors.push(`${label}: use either level loadouts or one random pool.`);
    entry.gear?.forEach((gear, gearIndex) => {
      if (!isWhole(gear.level, 0, 4294967295)) errors.push(`${label} / loadout ${gearIndex + 1}: level is required.`);
      for (const field of GEAR_FIELDS) {
        const values = gear[field.key as keyof typeof gear];
        if (!Array.isArray(values)) continue;
        if (field.limit && values.length > field.limit) errors.push(`${label} / loadout ${gearIndex + 1}: ${field.label} allows at most ${field.limit}.`);
        values.forEach((choice, choiceIndex) => validateChoice(choice, `${label} / ${field.label} ${choiceIndex + 1}`, errors, field.key === 'armor'));
      }
    });
    if (entry.pool) {
      if (!entry.pool.right?.length) errors.push(`${label} / pool: add at least one right-hand weapon.`);
      if (entry.pool.spells?.length && !entry.pool.catalysts?.length) errors.push(`${label} / pool: spells need at least one catalyst.`);
      for (const field of POOL_FIELDS) {
        const values = entry.pool[field.key as keyof EquipmentPool];
        if (!Array.isArray(values)) continue;
        if (field.key === 'armor') {
          values.forEach((choice, choiceIndex) => {
            const set = Array.isArray(choice) ? choice : (choice as { set?: number[] }).set;
            if (!Array.isArray(set) || set.length !== 4) errors.push(`${label} / armor set ${choiceIndex + 1}: choose head, chest, arms and legs.`);
            else set.forEach((piece, pieceIndex) => validateChoice(piece, `${label} / armor set ${choiceIndex + 1}.${pieceIndex + 1}`, errors, true));
          });
        } else values.forEach((choice, choiceIndex) => validateChoice(choice, `${label} / ${field.label} ${choiceIndex + 1}`, errors, ['left', 'catalysts'].includes(field.key)));
      }
    }
  });

  for (const field of ['greetings', 'victories'] as const) {
    for (const gesture of document.gestures?.[field] ?? []) {
      if (validGestures.size && !validGestures.has(gesture)) errors.push(`Shared gestures: unknown ${field} gesture “${gesture}”.`);
    }
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
