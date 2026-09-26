import { parse, stringify } from 'smol-toml';
import { CLASSES, GEAR_FIELDS, POOL_FIELDS, ROLES, STATS } from './constants';
import type { EquipmentPool, ItemChoice, LibraryDocument, Tarnished, ValidationResult } from './types';

export function parseLibrary(text: string): LibraryDocument {
  const parsed = parse(text.replace(/^\uFEFF/, '')) as unknown as LibraryDocument;
  if (!parsed || typeof parsed !== 'object') throw new Error('The selected file is not a TOML library.');
  if (parsed.tarnished === undefined) parsed.tarnished = [];
  if (!Array.isArray(parsed.tarnished)) throw new Error('The library needs [[tarnished]] entries.');
  return parsed;
}

export function serializeLibrary(document: LibraryDocument): string {
  const heading = '# Wayward Tarnished library — exported by Library Studio\n\n';
  return heading + stringify(document as never);
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

export function validateLibrary(document: LibraryDocument, gestureNames: string[] = []): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries = document.tarnished ?? [];
  const ids = new Set<string>();
  const validGestures = new Set(gestureNames);

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
  if (!entries.length) warnings.push('This library has no Tarnished entries yet.');
  if (!document.templates?.invader) warnings.push('Templates are inherited; install this file alongside base.toml.');
  if (!document.gestures) warnings.push('Shared gestures are inherited from another library file.');
  return { errors, warnings };
}

export function poolChoiceCount(pool: EquipmentPool | undefined): number {
  if (!pool) return 0;
  return POOL_FIELDS.reduce((count, field) => count + (Array.isArray(pool[field.key as keyof EquipmentPool]) ? (pool[field.key as keyof EquipmentPool] as unknown[]).length : 0), 0);
}
