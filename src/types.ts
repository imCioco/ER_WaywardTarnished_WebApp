export type ItemKind = 'weapon' | 'armor' | 'talisman' | 'spell' | 'ash' | 'goods';

export type WeightedChoice = {
  id: number;
  level?: number;
  weight?: number;
  ash?: number;
  upgrade?: number;
};

export type ItemChoice = number | WeightedChoice;

export type Consumable = { id: number; count?: number; level?: number; weight?: number };
export type ArmorChoice = number[] | { set: number[]; level?: number; weight?: number };

export type Loadout = {
  level: number;
  right?: ItemChoice[];
  left?: ItemChoice[];
  armor?: number[];
  talismans?: number[];
  spells?: number[];
  arrows?: [number, number];
  bolts?: [number, number];
};

export type EquipmentPool = {
  right: ItemChoice[];
  left?: ItemChoice[];
  catalysts?: ItemChoice[];
  armor?: ArmorChoice[];
  talismans?: ItemChoice[];
  spells?: ItemChoice[];
  ashes?: ItemChoice[];
};

export type Tarnished = {
  id: string;
  name: string;
  titles?: string[];
  names?: string[];
  class?: string | string[];
  roles?: string[];
  weight?: number;
  min_level?: number;
  max_level?: number;
  sex?: 'any' | 'male' | 'female';
  enabled?: boolean;
  pvp_damage?: boolean;
  styles?: string[];
  greetings?: string[];
  victories?: string[];
  faces?: number[];
  items?: [number, number][];
  consumables?: Consumable[];
  growth?: Record<string, number>;
  attributes?: Record<string, number>;
  gear?: Loadout[];
  pool?: EquipmentPool;
  [key: string]: unknown;
};

export type LibraryDocument = {
  templates?: Record<string, unknown>;
  faces?: { male?: number[]; female?: number[] };
  names?: { male?: string[]; female?: string[] };
  styles?: Record<string, number>;
  personalities?: Record<string, Personality>;
  gestures?: { greetings?: string[]; victories?: string[] };
  consumables?: { kinds?: number; pool?: Consumable[] };
  tarnished: Tarnished[];
  /** Style and personality descriptions; written as TOML comments, since the mod rejects unknown keys. */
  __descriptions?: Record<string, string>;
  [key: string]: unknown;
};

/** A custom AI personality: odds the mod writes into a free NpcAiBehaviorProbability row. */
export type Personality = {
  effect: number;
  row: number;
  suppress?: number[];
  odds: Record<string, number>;
};

export type ValidationResult = { errors: string[]; warnings: string[] };
