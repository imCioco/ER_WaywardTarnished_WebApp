import type { ItemKind } from './types';

export const CLASSES = ['vagabond', 'warrior', 'hero', 'bandit', 'astrologer', 'prophet', 'samurai', 'prisoner', 'confessor', 'wretch'];
export const ROLES = ['invader', 'hunter', 'host', 'cooperator'];
export const STATS = ['vigor', 'mind', 'endurance', 'strength', 'dexterity', 'intelligence', 'faith', 'arcane'];
export const ARMOR_SLOTS = ['head', 'chest', 'arms', 'legs'];
export const AFFINITIES = ['Standard', 'Heavy', 'Keen', 'Quality', 'Fire', 'Flame Art', 'Lightning', 'Sacred', 'Magic', 'Cold', 'Poison', 'Blood', 'Occult'];

// Pool choices without `level` or `weight` use the mod's defaults (src/library.rs).
export const DEFAULT_LEVEL = 1;
export const DEFAULT_WEIGHT = 10;
export const MOST_CONSUMABLES = 99;

// EquipParamGoods.aiUseJudgeId: how the player-like AI uses a consumable (docs/LIBRARY.md).
export const CONSUMABLE_USES: Record<number, string> = {
  10000000: 'Thrown pots', 10000001: 'Knives and darts', 10000002: 'Stones and sprays',
  20070000: 'Flasks', 30000000: 'Self-buffs', 30010000: 'Greases', 31000000: 'Drawstring greases',
};

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

// Personality slots: a permanent SpEffect and the NpcAiBehaviorProbability row battle goal 29999 adds
// for it, used by no vanilla NPC, event or param (docs/RESEARCH.md). Every personality needs its own.
export const PERSONALITY_SLOTS: { effect: number; row: number }[] = [
  { effect: 5023, row: 15023 },
  { effect: 20018663, row: 15103 },
  { effect: 20018707, row: 15140 },
  { effect: 20018708, row: 15141 },
  { effect: 20018711, row: 15144 },
];

// -9999 rules an action out and 9999 forces it; the game's situational odds are mostly 10-100.
export const ODDS_LIMIT = 9999;

// The NpcAiBehaviorProbability columns a personality may change (BEHAVIOUR_ODDS in the mod's src/library.rs).
export const ODDS_GROUPS: { label: string; hint: string; actions: string[] }[] = [
  { label: 'Right hand', hint: 'Attacks with the right-hand weapon', actions: ['r1_combo', 'r2_combo', 'dash_attack', 'forward_roll_attack', 'side_roll_attack', 'back_roll_attack', 'backstep_attack', 'jump_attack', 'dash_jump_attack', 'shoot_r1', 'shoot_r2', 'shield_r1', 'shield_r2'] },
  { label: 'Spells', hint: 'Casting with the right-hand catalyst, by distance and movement', actions: ['near_spell_strafing', 'near_spell_advancing', 'near_spell_retreating', 'mid_spell_strafing', 'mid_spell_advancing', 'mid_spell_retreating', 'far_spell_strafing', 'far_spell_advancing', 'far_spell_retreating', 'healing_spell', 'buff_spell'] },
  { label: 'Left hand', hint: 'Attacks with the left-hand weapon', actions: ['left_r1_combo', 'left_r2_combo', 'left_dash_attack', 'left_forward_roll_attack', 'left_side_roll_attack', 'left_back_roll_attack', 'left_backstep_attack', 'left_jump_attack', 'left_dash_jump_attack', 'left_l1_combo', 'left_shoot_r1', 'left_shoot_r2'] },
  { label: 'Left-hand spells', hint: 'Casting with a left-hand catalyst', actions: ['left_near_spell_strafing', 'left_near_spell_advancing', 'left_near_spell_retreating', 'left_mid_spell_strafing', 'left_mid_spell_advancing', 'left_mid_spell_retreating', 'left_far_spell_strafing', 'left_far_spell_advancing', 'left_far_spell_retreating', 'left_healing_spell', 'left_buff_spell'] },
  { label: 'Movement', hint: 'Dodging, spacing and grip', actions: ['backstep', 'forward_roll', 'side_roll', 'back_roll', 'strafe', 'retreat', 'dash_in', 'wait', 'approach', 'two_hand_right', 'two_hand_left', 'one_hand'] },
  { label: 'Skills and items', hint: 'Ashes of War and consumables', actions: ['art_near', 'art_mid', 'art_far', 'art_heal', 'art_buff', 'throw_item', 'healing_item', 'buff_item', 'pot_combo', 'shield_poke'] },
  { label: 'Chances', hint: 'How often it two-hands, guards, dual-wields or dodges with a skill', actions: ['two_hand_r1_chance', 'two_hand_r2_chance', 'guard_while_moving', 'dual_r1_chance', 'rolling_art_chance'] },
  { label: 'At parry timing', hint: 'When your attack comes in at parry timing', actions: ['parry', 'parry_window_forward_roll', 'parry_window_side_roll', 'parry_window_back_roll', 'parry_window_backstep_attack', 'parry_window_guard', 'parry_window_steady'] },
  { label: 'After parries, blocks and guard breaks', hint: 'Follow-ups', actions: ['riposte', 'parried_steady', 'blocked_backstep', 'blocked_steady', 'guard_counter', 'guard_break_critical', 'guard_break_dash_attack', 'guard_break_spell', 'guard_break_steady'] },
  { label: 'When you drink', hint: 'Punishing your flask', actions: ['estus_punish_dash_attack', 'estus_punish_throw', 'estus_steady'] },
  { label: 'When hit', hint: 'Reactions to taking a hit', actions: ['hit_back_roll', 'hit_side_roll', 'hit_forward_roll', 'hit_backstep', 'hit_guard_forward', 'hit_guard_back', 'hit_guard_side', 'hit_r1_combo', 'hit_steady'] },
  { label: 'At a projectile', hint: 'Reactions to arrows and spells', actions: ['projectile_forward_roll', 'projectile_side_roll', 'projectile_back_roll', 'projectile_guard_forward', 'projectile_guard_side', 'projectile_dash_in', 'projectile_steady'] },
  { label: 'Seeing your attack coming', hint: 'Reactions before your attack lands', actions: ['threat_backstep', 'threat_forward_roll', 'threat_side_roll', 'threat_back_roll', 'threat_guard_forward', 'threat_guard_side', 'threat_guard', 'threat_shield_poke', 'threat_evasive_art', 'threat_steady'] },
  { label: 'Approached while drawing a bow', hint: 'Bow reactions', actions: ['drawn_bow_strafe', 'drawn_bow_side_roll', 'drawn_bow_steady'] },
];

export const ODDS_ACTIONS = ODDS_GROUPS.flatMap((group) => group.actions);

export function actionLabel(action: string): string {
  const words = action.replace(/_/g, ' ').replace(/\br(\d)\b/g, 'R$1').replace(/\bl1\b/g, 'L1');
  return words[0].toUpperCase() + words.slice(1);
}

export const HUMAN_LABELS: Record<string, string> = {
  right: 'Right hand', left: 'Left hand', catalysts: 'Catalysts', armor: 'Armor sets',
  talismans: 'Talismans', spells: 'Spells', ashes: 'Ashes of War', items: 'Items',
};
