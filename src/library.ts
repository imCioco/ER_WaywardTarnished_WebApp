import { parse, stringify } from 'smol-toml';
import { CLASSES, GEAR_FIELDS, MOST_CONSUMABLES, ODDS_ACTIONS, ODDS_LIMIT, POOL_FIELDS, ROLES, STATS } from './constants';
import type { ArmorChoice, Consumable, EquipmentPool, ItemChoice, ItemKind, LibraryDocument, Loadout, Personality, Pick, Tarnished, ValidationResult } from './types';

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

/** A style or personality the library can use, from this file or from the mod's base.toml. */
export type Archetype = {
  name: string;
  kind: 'style' | 'personality';
  description?: string;
  /** A vanilla style's SpEffect. */
  effect?: number;
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
      result.set(name, { name, kind: 'personality', personality, description: source.__descriptions?.[name] ?? result.get(name)?.description, inherited });
    }
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
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

export type ValidateOptions = {
  gestures?: string[];
  goods?: GoodsLookup;
  /** The mod's base.toml, loaded before this file: its styles, personalities and templates apply here too. */
  base?: LibraryDocument;
  /** Whether an item is from Shadow of the Erdtree, from the item catalog. */
  isDlcItem?: (kind: ItemKind, id: number) => boolean;
};

/** The options of a loadout slot: one item or a list of options. */
export function pickOptions(pick: Pick): ItemChoice[] {
  return Array.isArray(pick) ? pick : [pick];
}

function armorSetPieces(choice: ArmorChoice): number[] | undefined {
  return Array.isArray(choice) ? choice : choice?.set;
}

/** Every item an entry can equip, for the DLC check. */
function entryItems(entry: Tarnished): [ItemKind, number][] {
  const items: [ItemKind, number][] = [];
  const add = (kind: ItemKind, choices: ItemChoice[] | undefined) => {
    for (const choice of choices ?? []) {
      const id = choiceId(choice);
      if (id >= 0) items.push([kind, id]);
      if (typeof choice === 'object' && choice.ash !== undefined) items.push(['ash', choice.ash]);
    }
  };
  for (const gear of entry.gear ?? []) {
    for (const field of GEAR_FIELDS) add(field.kind, ((gear[field.key as keyof Loadout] as Pick[] | undefined) ?? []).flatMap(pickOptions));
    for (const set of gear.armor_sets ?? []) add('armor', armorSetPieces(set));
  }
  if (entry.pool) {
    for (const field of POOL_FIELDS) {
      const values = entry.pool[field.key as keyof EquipmentPool] as unknown[] | undefined;
      if (field.key === 'armor') for (const set of (values ?? []) as ArmorChoice[]) add('armor', armorSetPieces(set));
      else add(field.kind, values as ItemChoice[] | undefined);
    }
  }
  return items;
}

export function validateLibrary(document: LibraryDocument, options: ValidateOptions = {}): ValidationResult {
  const { gestures: gestureNames = [], goods, base, isDlcItem } = options;
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries = document.tarnished ?? [];
  const ids = new Set<string>();
  const validGestures = new Set(gestureNames);
  const knownStyles = new Set(archetypes(document, base).map((archetype) => archetype.name));
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
    if (!classes.length || classes.some((value) => !CLASSES.includes(value))) errors.push(`${label}: choose at least one valid starting class.`);
    if (entry.roles && (!entry.roles.length || entry.roles.some((value) => !ROLES.includes(value)))) errors.push(`${label}: select at least one valid role.`);
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
        } else values.forEach((choice, choiceIndex) => validateChoice(choice, `${label} / ${field.label} ${choiceIndex + 1}`, errors, ['left', 'catalysts'].includes(field.key)));
      }
    }
    if (isDlcItem && !entry.dlc) {
      const dlcItems = entryItems(entry).filter(([kind, id]) => isDlcItem(kind, id));
      if (dlcItems.length) warnings.push(`${label}: uses ${dlcItems.length} Shadow of the Erdtree item${dlcItems.length === 1 ? '' : 's'}; turn on “Uses Shadow of the Erdtree” so it is left out for players without the DLC.`);
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
