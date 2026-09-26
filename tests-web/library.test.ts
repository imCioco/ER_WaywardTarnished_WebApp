import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newEnemy, parseLibrary, serializeLibrary, validateLibrary } from '../src/library';

const baseText = readFileSync(new URL('../public/base.toml', import.meta.url), 'utf8');
const gestures = readFileSync(new URL('../public/gestures.txt', import.meta.url), 'utf8').trim().split(/\r?\n/);

describe('Wayward Tarnished library model', () => {
  it('loads and re-exports the current base library', () => {
    const document = parseLibrary(baseText);
    expect(document.tarnished).toHaveLength(17);
    expect(document.tarnished.filter((entry) => entry.pool)).toHaveLength(6);
    const roundTrip = parseLibrary(serializeLibrary(document));
    expect(roundTrip.tarnished).toEqual(document.tarnished);
    expect(validateLibrary(roundTrip, gestures).errors).toEqual([]);
  });

  it('creates a valid random pool directly', () => {
    const document = parseLibrary(baseText);
    document.tarnished = [newEnemy([], 'pool')];
    expect(document.tarnished[0].pool?.right).toEqual([2000000]);
    expect(validateLibrary(document, gestures).errors).toEqual([]);
  });

  it('preserves inherit, never and custom gesture states', () => {
    const document = parseLibrary(baseText);
    const inherited = document.tarnished[0];
    delete inherited.greetings;
    inherited.victories = [];
    document.tarnished[1].greetings = ['wave', 'bow'];
    const saved = parseLibrary(serializeLibrary(document));
    expect(saved.tarnished[0].greetings).toBeUndefined();
    expect(saved.tarnished[0].victories).toEqual([]);
    expect(saved.tarnished[1].greetings).toEqual(['wave', 'bow']);
  });

  it('rejects unknown gestures and incomplete armor presets', () => {
    const document = parseLibrary(baseText);
    document.tarnished = [newEnemy([], 'pool')];
    document.tarnished[0].greetings = ['not_a_real_gesture'];
    document.tarnished[0].pool!.armor = [[100, 200]];
    const result = validateLibrary(document, gestures);
    expect(result.errors.some((error) => error.includes('unknown greetings gesture'))).toBe(true);
    expect(result.errors.some((error) => error.includes('head, chest, arms and legs'))).toBe(true);
  });

  it('ships the expected local item catalog without external fetching', () => {
    const items = JSON.parse(readFileSync(new URL('../public/catalog/items.json', import.meta.url), 'utf8'));
    expect(items).toHaveLength(2797);
  });
});
