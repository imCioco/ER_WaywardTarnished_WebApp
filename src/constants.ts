import type { ItemKind } from './types';

export const CLASSES = ['vagabond', 'warrior', 'hero', 'bandit', 'astrologer', 'prophet', 'samurai', 'prisoner', 'confessor', 'wretch'];
export const ROLES = ['invader', 'hunter', 'host', 'cooperator'];
export const STATS = ['vigor', 'mind', 'endurance', 'strength', 'dexterity', 'intelligence', 'faith', 'arcane'];
export const ARMOR_SLOTS = ['head', 'chest', 'arms', 'legs'];
export const AFFINITIES = ['Standard', 'Heavy', 'Keen', 'Quality', 'Fire', 'Flame Art', 'Lightning', 'Sacred', 'Magic', 'Cold', 'Poison', 'Blood', 'Occult'];

export const POOL_FIELDS: { key: string; label: string; kind: ItemKind }[] = [
  { key: 'right', label: 'Right-hand weapons', kind: 'weapon' },
  { key: 'left', label: 'Left-hand weapons', kind: 'weapon' },
  { key: 'catalysts', label: 'Catalysts', kind: 'weapon' },
  { key: 'armor', label: 'Armor sets', kind: 'armor' },
  { key: 'talismans', label: 'Talismans', kind: 'talisman' },
  { key: 'spells', label: 'Spells', kind: 'spell' },
  { key: 'ashes', label: 'Ashes of War', kind: 'ash' },
];

export const GEAR_FIELDS: { key: string; label: string; kind: ItemKind; limit?: number }[] = [
  { key: 'right', label: 'Right hand', kind: 'weapon', limit: 3 },
  { key: 'left', label: 'Left hand', kind: 'weapon', limit: 3 },
  { key: 'armor', label: 'Armor', kind: 'armor', limit: 4 },
  { key: 'talismans', label: 'Talismans', kind: 'talisman', limit: 4 },
  { key: 'spells', label: 'Spells', kind: 'spell', limit: 7 },
];

export const HUMAN_LABELS: Record<string, string> = {
  right: 'Right hand', left: 'Left hand', catalysts: 'Catalysts', armor: 'Armor sets',
  talismans: 'Talismans', spells: 'Spells', ashes: 'Ashes of War', items: 'Items',
};
