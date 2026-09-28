import type { Personality } from './types';

// Styles and personalities kept in this browser, so they are offered in every library you open or
// start, and written into a file only when one of its Tarnished uses them.

const PRESETS_KEY = 'wayward-tarnished-library-studio-presets-v1';

export type PersonalityPreset = { personality: Personality; description?: string };
export type StylePreset = { effect: number; description?: string };
export type Presets = { personalities: Record<string, PersonalityPreset>; styles: Record<string, StylePreset> };

export const EMPTY_PRESETS: Presets = { personalities: {}, styles: {} };

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function loadPresets(): Presets {
  try {
    const text = storage()?.getItem(PRESETS_KEY);
    if (!text) return EMPTY_PRESETS;
    const parsed = JSON.parse(text) as Partial<Presets>;
    return { personalities: parsed.personalities ?? {}, styles: parsed.styles ?? {} };
  } catch {
    return EMPTY_PRESETS;
  }
}

export function storePresets(presets: Presets): void {
  try {
    storage()?.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // Private windows and blocked storage: the presets last for this visit only.
  }
}

export function withPersonality(presets: Presets, name: string, personality: Personality, description?: string): Presets {
  return { ...presets, personalities: { ...presets.personalities, [name]: { personality: structuredClone(personality), ...(description ? { description } : {}) } } };
}

export function withStyle(presets: Presets, name: string, effect: number, description?: string): Presets {
  return { ...presets, styles: { ...presets.styles, [name]: { effect, ...(description ? { description } : {}) } } };
}

export function withoutPreset(presets: Presets, name: string): Presets {
  const personalities = { ...presets.personalities };
  const styles = { ...presets.styles };
  delete personalities[name];
  delete styles[name];
  return { personalities, styles };
}
