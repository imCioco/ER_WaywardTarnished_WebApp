import type { ItemKind } from './types';

export const CLASSES = ['vagabond', 'warrior', 'hero', 'bandit', 'astrologer', 'prophet', 'samurai', 'prisoner', 'confessor', 'wretch'];
export const ROLES = ['invader', 'hunter', 'host', 'cooperator', 'summon'];

/** What each role means in game (docs/LIBRARY.md, Roles). */
export const ROLE_HELP: Record<string, string> = {
  invader: 'Invades your world as a red phantom.',
  hunter: 'Answers your call when you are invaded (blue phantom). A hunter can also be summoned.',
  host: 'The Tarnished whose world you invade with a Bloody Finger.',
  cooperator: 'Helps the host whose world you invade.',
  summon: 'Called from a golden summon sign after the Furlcalling Finger Remedy (INI [summons]).',
};

/** `[chances]` groups: which entries each one covers (library.rs Tarnished::group). */
export const CHANCE_GROUPS: { key: 'named' | 'loadouts' | 'class_libraries'; label: string; help: string }[] = [
  { key: 'named', label: 'Named Tarnished', help: 'Entries with exactly one given name, such as Vigor Check or Ragnvald Stormaxe.' },
  { key: 'loadouts', label: 'Fixed builds', help: 'The other entries with hand-made level loadouts.' },
  { key: 'class_libraries', label: 'Class libraries', help: 'Entries that draw random gear from item pools.' },
];

/** The INI's default level_spread: Tarnished target the player's level plus or minus this. */
export const LEVEL_SPREAD = 5;
export const MAXIMUM_LEVEL = 713;

/** Starting attributes of each class, in STATS order (library.rs Class::attributes). */
export const CLASS_STATS: Record<string, number[]> = {
  vagabond: [15, 10, 11, 14, 13, 9, 9, 7], warrior: [11, 12, 11, 10, 16, 10, 8, 9],
  hero: [14, 9, 12, 16, 9, 7, 8, 11], bandit: [10, 11, 10, 9, 13, 9, 8, 14],
  astrologer: [9, 15, 9, 8, 12, 16, 7, 9], prophet: [10, 14, 8, 11, 10, 7, 16, 10],
  samurai: [12, 11, 13, 12, 15, 9, 8, 8], prisoner: [11, 12, 11, 11, 14, 14, 6, 9],
  confessor: [10, 13, 10, 12, 12, 9, 14, 9], wretch: [10, 10, 10, 10, 10, 10, 10, 10],
};

/** Past the first cap a point counts double, past the second four times (library.rs SOFT_CAPS). */
export const SOFT_CAPS: [number, number][] = [[40, 60], [20, 40], [25, 40], [55, 80], [55, 80], [60, 80], [60, 80], [45, 60]];

export const STAT_SHORT: Record<string, string> = {
  vigor: 'Vig', mind: 'Min', endurance: 'End', strength: 'Str', dexterity: 'Dex', intelligence: 'Int', faith: 'Fai', arcane: 'Arc',
};
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
  10000003: 'Other thrown items', 10000004: 'Other thrown items', 10000010: 'Other thrown items', 10200000: 'Other thrown items',
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
  { key: 'great_runes', label: 'Great Runes', kind: 'goods' },
];

/**
 * The great runes a Tarnished can wear (library.rs GREAT_RUNES): goods ids, the effect the mod applies
 * on arrival (as after a Rune Arc) and the level players usually hold each one by, used for new options.
 */
export const GREAT_RUNES: { id: number; effect: string; level: number }[] = [
  { id: 191, effect: '+5 to every attribute', level: 30 },
  { id: 192, effect: '+15% max HP, FP and stamina', level: 60 },
  { id: 194, effect: 'Restores HP when it defeats a foe', level: 70 },
  { id: 193, effect: '+25% max HP', level: 80 },
  { id: 195, effect: 'Blessing of blood, the phantom’s rune', level: 110 },
  { id: 196, effect: 'HP back on attacks right after taking damage', level: 120 },
];
export const GREAT_RUNE_IDS = GREAT_RUNES.map((rune) => rune.id);
export const NO_GREAT_RUNE = 'No great rune';
export const GREAT_RUNE_NOTE = `The Tarnished wears it from its arrival, as after a Rune Arc. A great rune never comes before its level: while no option is within the Tarnished's level, it wears none. Weight is the relative chance (default ${DEFAULT_WEIGHT}), and “${NO_GREAT_RUNE}” is an option like the others.`;

/** What a great rune does, for option rows and test builds. */
export function greatRuneEffect(id: number): string | undefined {
  return GREAT_RUNES.find((rune) => rune.id === id)?.effect;
}

/** A great rune's effect and when players usually have it, for choosing its level. */
export function greatRuneHint(id: number): string | undefined {
  const rune = GREAT_RUNES.find((known) => known.id === id);
  return rune && `${rune.effect}; players usually hold it from about level ${rune.level}`;
}

export const GEAR_FIELDS: { key: string; label: string; kind: ItemKind; limit?: number }[] = [
  { key: 'right', label: 'Right hand', kind: 'weapon', limit: 3 },
  { key: 'left', label: 'Left hand', kind: 'weapon', limit: 3 },
  { key: 'armor', label: 'Armor', kind: 'armor', limit: 4 },
  { key: 'talismans', label: 'Talismans', kind: 'talisman', limit: 4 },
  { key: 'spells', label: 'Spells', kind: 'spell', limit: 7 },
];

// How many custom personalities can be in play at once: the player-like AI has five spare personality
// slots, which the mod fills as Tarnished spawn (docs/LIBRARY.md, Custom personalities).
export const PERSONALITIES_AT_ONCE = 5;

// -9999 rules an action out and 9999 forces it; the game's situational odds are mostly 10-100.
export const ODDS_LIMIT = 9999;

/**
 * How battle goal 29999 (029999_battle.lua) uses a group's numbers:
 * - weight: main actions. The totals are clamped at 0 and one action is picked with chances in
 *   proportion to them (Common_Battle_Activate_ForCommonNPC).
 * - reaction: an interrupt (hit, parry timing, ...) rolls 1-100 and walks the event's reactions in a fixed
 *   order, adding their odds; the first whose running total reaches the roll happens, else none does.
 * - chance: compared with a 1-100 roll on its own, a plain percentage.
 */
export type OddsKind = 'weight' | 'reaction' | 'chance';

export const ODDS_KINDS: Record<OddsKind, { label: string; summary: string }> = {
  weight: {
    label: 'Weighted choice',
    summary: 'When the Tarnished decides its next move, your number is added to the game’s own odds for the situation (mostly 10–100), and it picks one action with chances in proportion to the totals. Totals below 0 count as 0.',
  },
  reaction: {
    label: 'Reaction roll (1–100)',
    summary: 'When this happens, the AI rolls 1–100 and checks these reactions in a fixed order, adding up their odds; the first whose running total reaches the roll happens. Whatever is left under 100 is the chance it does not react.',
  },
  chance: {
    label: 'Percent chance',
    summary: 'A plain percentage: each time, the AI rolls 1–100 and does it when the roll is at or under the total. 100 or more is always, 0 or less never.',
  },
};

export const ODDS_GROUPS: { label: string; hint: string; kind: OddsKind; actions: string[] }[] = [
  { label: 'Right hand', hint: 'Attacks with the right-hand weapon', kind: 'weight', actions: ['r1_combo', 'r2_combo', 'dash_attack', 'forward_roll_attack', 'side_roll_attack', 'back_roll_attack', 'backstep_attack', 'jump_attack', 'dash_jump_attack', 'shoot_r1', 'shoot_r2', 'shield_r1', 'shield_r2'] },
  { label: 'Spells', hint: 'Casting with the right-hand catalyst, by distance and movement', kind: 'weight', actions: ['near_spell_strafing', 'near_spell_advancing', 'near_spell_retreating', 'mid_spell_strafing', 'mid_spell_advancing', 'mid_spell_retreating', 'far_spell_strafing', 'far_spell_advancing', 'far_spell_retreating', 'healing_spell', 'buff_spell'] },
  { label: 'Left hand', hint: 'Attacks with the left-hand weapon', kind: 'weight', actions: ['left_r1_combo', 'left_r2_combo', 'left_dash_attack', 'left_forward_roll_attack', 'left_side_roll_attack', 'left_back_roll_attack', 'left_backstep_attack', 'left_jump_attack', 'left_dash_jump_attack', 'left_l1_combo', 'left_shoot_r1', 'left_shoot_r2'] },
  { label: 'Left-hand spells', hint: 'Casting with a left-hand catalyst', kind: 'weight', actions: ['left_near_spell_strafing', 'left_near_spell_advancing', 'left_near_spell_retreating', 'left_mid_spell_strafing', 'left_mid_spell_advancing', 'left_mid_spell_retreating', 'left_far_spell_strafing', 'left_far_spell_advancing', 'left_far_spell_retreating', 'left_healing_spell', 'left_buff_spell'] },
  { label: 'Movement', hint: 'Dodging, spacing and grip', kind: 'weight', actions: ['backstep', 'forward_roll', 'side_roll', 'back_roll', 'strafe', 'retreat', 'dash_in', 'wait', 'approach', 'two_hand_right', 'two_hand_left', 'one_hand'] },
  { label: 'Skills and items', hint: 'Ashes of War and consumables', kind: 'weight', actions: ['art_near', 'art_mid', 'art_far', 'art_heal', 'art_buff', 'throw_item', 'healing_item', 'buff_item', 'pot_combo', 'shield_poke'] },
  { label: 'Chances', hint: 'How often it two-hands, guards, dual-wields or dodges with a skill', kind: 'chance', actions: ['two_hand_r1_chance', 'two_hand_r2_chance', 'guard_while_moving', 'dual_r1_chance', 'rolling_art_chance'] },
  { label: 'At parry timing', hint: 'When your attack comes in at parry timing', kind: 'reaction', actions: ['parry', 'parry_window_forward_roll', 'parry_window_side_roll', 'parry_window_back_roll', 'parry_window_backstep_attack', 'parry_window_guard', 'parry_window_steady'] },
  { label: 'After a parry', hint: 'Once it has parried you', kind: 'reaction', actions: ['riposte', 'parried_steady'] },
  { label: 'After blocking', hint: 'Once it has blocked your hit', kind: 'reaction', actions: ['blocked_backstep', 'blocked_steady', 'guard_counter'] },
  { label: 'After a guard break', hint: 'Once it has broken your guard', kind: 'reaction', actions: ['guard_break_critical', 'guard_break_dash_attack', 'guard_break_spell', 'guard_break_steady'] },
  { label: 'When you drink', hint: 'Punishing your flask', kind: 'reaction', actions: ['estus_punish_dash_attack', 'estus_punish_throw', 'estus_steady'] },
  { label: 'When hit', hint: 'Reactions to taking a hit', kind: 'reaction', actions: ['hit_back_roll', 'hit_side_roll', 'hit_forward_roll', 'hit_backstep', 'hit_guard_forward', 'hit_guard_back', 'hit_guard_side', 'hit_r1_combo', 'hit_steady'] },
  { label: 'At a projectile', hint: 'Reactions to arrows and spells', kind: 'reaction', actions: ['projectile_forward_roll', 'projectile_side_roll', 'projectile_back_roll', 'projectile_guard_forward', 'projectile_guard_side', 'projectile_dash_in', 'projectile_steady'] },
  { label: 'Seeing your attack coming', hint: 'Reactions before your attack lands', kind: 'reaction', actions: ['threat_backstep', 'threat_forward_roll', 'threat_side_roll', 'threat_back_roll', 'threat_guard_forward', 'threat_guard_side', 'threat_guard', 'threat_shield_poke', 'threat_evasive_art', 'threat_steady'] },
  { label: 'Approached while drawing a bow', hint: 'Bow reactions', kind: 'reaction', actions: ['drawn_bow_strafe', 'drawn_bow_side_roll', 'drawn_bow_steady'] },
];

export const ODDS_ACTIONS = ODDS_GROUPS.flatMap((group) => group.actions);

/** What each action does, from the NpcAiBehaviorProbability field descriptions. */
export const ACTION_HELP: Record<string, string> = {
  r1_combo: 'Light attack combo.',
  r2_combo: 'Heavy attack combo.',
  dash_attack: 'Running attack.',
  forward_roll_attack: 'Rolls toward you, then attacks.',
  side_roll_attack: 'Rolls sideways, then attacks.',
  back_roll_attack: 'Rolls back, then attacks.',
  backstep_attack: 'Backsteps, then attacks.',
  jump_attack: 'Jumping attack.',
  dash_jump_attack: 'Running jump attack.',
  shoot_r1: 'Shoots a right-hand bow or crossbow.',
  shoot_r2: 'Shoots a right-hand bow or crossbow with the heavy button.',
  shield_r1: 'Light attack with a right-hand shield.',
  shield_r2: 'Heavy attack with a right-hand shield.',
  near_spell_strafing: 'Casts up close while circling you.',
  near_spell_advancing: 'Casts up close while moving in.',
  near_spell_retreating: 'Casts up close while backing away.',
  mid_spell_strafing: 'Casts at mid range while circling you.',
  mid_spell_advancing: 'Casts at mid range while moving in.',
  mid_spell_retreating: 'Casts at mid range while backing away.',
  far_spell_strafing: 'Casts from afar while circling you.',
  far_spell_advancing: 'Casts from afar while moving in.',
  far_spell_retreating: 'Casts from afar while backing away.',
  healing_spell: 'Casts a healing spell. The mod removes healing incantations, so this rarely matters.',
  buff_spell: 'Casts a buff; skipped while that buff is active.',
  left_r1_combo: 'Light attack combo with the left-hand weapon.',
  left_r2_combo: 'Heavy attack combo with the left-hand weapon.',
  left_dash_attack: 'Running attack with the left-hand weapon.',
  left_forward_roll_attack: 'Rolls toward you, then attacks with the left hand.',
  left_side_roll_attack: 'Rolls sideways, then attacks with the left hand.',
  left_back_roll_attack: 'Rolls back, then attacks with the left hand.',
  left_backstep_attack: 'Backsteps, then attacks with the left hand.',
  left_jump_attack: 'Jumping attack with the left hand.',
  left_dash_jump_attack: 'Running jump attack, two-handing the left weapon.',
  left_l1_combo: 'Attacks with the left weapon while one-handing (L1), as when dual-wielding.',
  left_shoot_r1: 'Shoots a left-hand bow or crossbow.',
  left_shoot_r2: 'Shoots a left-hand bow or crossbow with the heavy button.',
  left_near_spell_strafing: 'Left-hand cast up close while circling you.',
  left_near_spell_advancing: 'Left-hand cast up close while moving in.',
  left_near_spell_retreating: 'Left-hand cast up close while backing away.',
  left_mid_spell_strafing: 'Left-hand cast at mid range while circling you.',
  left_mid_spell_advancing: 'Left-hand cast at mid range while moving in.',
  left_mid_spell_retreating: 'Left-hand cast at mid range while backing away.',
  left_far_spell_strafing: 'Left-hand cast from afar while circling you.',
  left_far_spell_advancing: 'Left-hand cast from afar while moving in.',
  left_far_spell_retreating: 'Left-hand cast from afar while backing away.',
  left_healing_spell: 'Left-hand healing spell (healing incantations are removed by the mod).',
  left_buff_spell: 'Left-hand buff; skipped while that buff is active.',
  backstep: 'Backsteps out of reach.',
  forward_roll: 'Rolls toward you.',
  side_roll: 'Rolls sideways.',
  back_roll: 'Rolls away.',
  strafe: 'Circles around you.',
  retreat: 'Walks backwards to open distance.',
  dash_in: 'Runs in to close the distance.',
  wait: 'Stands and watches.',
  approach: 'Walks toward you.',
  two_hand_right: 'Switches to two-handing the right weapon.',
  two_hand_left: 'Switches to two-handing the left weapon.',
  one_hand: 'Goes back to one-handing.',
  art_near: 'Uses its Ash of War up close.',
  art_mid: 'Uses its Ash of War at mid range.',
  art_far: 'Uses its Ash of War from afar.',
  art_heal: 'Uses a healing skill.',
  art_buff: 'Uses a buffing skill (War Cry, Seppuku, ...); skipped while the buff is active.',
  throw_item: 'Throws a pot, knife or dart from its item slots.',
  healing_item: 'Drinks its flask.',
  buff_item: 'Uses a self-buff item or grease; skipped while that buff is active.',
  pot_combo: 'Throws pots one after another.',
  shield_poke: 'Pokes with a thrusting shield.',
  two_hand_r1_chance: 'Chance its light attacks are two-handed.',
  two_hand_r2_chance: 'Chance its heavy attacks are two-handed.',
  guard_while_moving: 'Chance it keeps its guard up while moving.',
  dual_r1_chance: 'Chance its light attacks use both weapons (dual-wielding).',
  rolling_art_chance: 'Chance it dodges with a skill (Quickstep, Bloodhound’s Step, ...) instead of a roll.',
  parry: 'Parries. Needs a parry skill (Buckler Parry, Parry, ...): without one it does nothing at that moment. The parry itself can still be early or late.',
  parry_window_forward_roll: 'Rolls through your attack toward you.',
  parry_window_side_roll: 'Rolls aside.',
  parry_window_back_roll: 'Rolls away.',
  parry_window_backstep_attack: 'Backsteps, then attacks.',
  parry_window_guard: 'Blocks.',
  parry_window_steady: 'Ignores the attack and carries on.',
  riposte: 'Ripostes you (the critical hit after a parry).',
  parried_steady: 'Lets the opening pass.',
  blocked_backstep: 'Backsteps after blocking.',
  blocked_steady: 'Keeps its guard up and carries on.',
  guard_counter: 'Answers with a guard counter.',
  guard_break_critical: 'Lands a critical hit on your broken guard.',
  guard_break_dash_attack: 'Runs in with an attack.',
  guard_break_spell: 'Casts a spell.',
  guard_break_steady: 'Lets the opening pass.',
  estus_punish_dash_attack: 'Runs in and attacks while you drink.',
  estus_punish_throw: 'Throws an item at you while you drink.',
  estus_steady: 'Lets you drink.',
  hit_back_roll: 'Rolls away.',
  hit_side_roll: 'Rolls aside.',
  hit_forward_roll: 'Rolls toward you.',
  hit_backstep: 'Backsteps.',
  hit_guard_forward: 'Raises its guard facing you.',
  hit_guard_back: 'Guards while backing off.',
  hit_guard_side: 'Guards while stepping aside.',
  hit_r1_combo: 'Hits back with a light attack combo (trades blows).',
  hit_steady: 'Carries on as if nothing happened.',
  projectile_forward_roll: 'Rolls through it toward you.',
  projectile_side_roll: 'Rolls aside.',
  projectile_back_roll: 'Rolls away.',
  projectile_guard_forward: 'Blocks it.',
  projectile_guard_side: 'Blocks while stepping aside.',
  projectile_dash_in: 'Runs at you.',
  projectile_steady: 'Ignores it.',
  threat_backstep: 'Backsteps out of reach.',
  threat_forward_roll: 'Rolls through toward you.',
  threat_side_roll: 'Rolls aside.',
  threat_back_roll: 'Rolls away.',
  threat_guard_forward: 'Guards while stepping in.',
  threat_guard_side: 'Guards while stepping aside.',
  threat_guard: 'Guards in place.',
  threat_shield_poke: 'Answers with a shield poke.',
  threat_evasive_art: 'Dodges with a skill (Quickstep, ...).',
  threat_steady: 'Ignores it.',
  drawn_bow_strafe: 'Circles away while keeping the bow drawn.',
  drawn_bow_side_roll: 'Rolls aside.',
  drawn_bow_steady: 'Keeps aiming.',
};

export function actionLabel(action: string): string {
  const words = action.replace(/_/g, ' ').replace(/\br(\d)\b/g, 'R$1').replace(/\bl1\b/g, 'L1');
  return words[0].toUpperCase() + words.slice(1);
}

export const HUMAN_LABELS: Record<string, string> = {
  right: 'Right hand', left: 'Left hand', catalysts: 'Catalysts', armor: 'Armor sets',
  talismans: 'Talismans', spells: 'Spells', ashes: 'Ashes of War', items: 'Items', great_runes: 'Great Runes',
};
