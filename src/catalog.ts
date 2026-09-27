import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { AFFINITIES, MOST_CONSUMABLES } from './constants';
import type { ItemKind } from './types';

export type CatalogItem = {
  id: number;
  name: string;
  kind: ItemKind;
  group: string;
  slot?: string;
  dlc: boolean;
  icon_name?: string;
  allowed_affinities?: string;
  reinforcement?: string;
  aow_allowed?: string;
  wepTypeCol?: string;
  compatibleWepTypes?: string;
  allowedAffinities?: string;
  aiUseJudgeId?: number;
  maxNum?: string;
  [key: string]: string | number | boolean | undefined;
};

function normalize(value: string): string {
  return value.replace(/^\[[^\]]+\]\s*/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export class ItemCatalog {
  items = new Map<string, CatalogItem>();
  icons = new Map<string, string>();
  iconCache = new Map<string, string | undefined>();
  database: Database | null = null;
  sourceName = '';

  get size(): number { return this.items.size; }

  key(kind: ItemKind, id: number): string { return `${kind}:${id}`; }

  get(kind: ItemKind, id: number): CatalogItem | undefined {
    const base = kind === 'weapon' && id >= 0 ? Math.floor(id / 10000) * 10000 : id;
    return this.items.get(this.key(kind, id)) ?? this.items.get(this.key(kind, base));
  }

  name(kind: ItemKind, id: number): string {
    if (id === -1) return 'Empty slot';
    const item = this.get(kind, id);
    if (!item) return `Item #${id}`;
    let name = item.name;
    if (kind === 'weapon') {
      const affinity = Math.floor((id % 10000) / 100);
      const upgrade = id % 100;
      if (affinity > 0 && affinity < AFFINITIES.length) name = `${AFFINITIES[affinity]} ${name}`;
      if (upgrade) name += ` +${upgrade}`;
    }
    return name;
  }

  list(kind: ItemKind, group?: string): CatalogItem[] {
    return [...this.items.values()].filter((item) => item.kind === kind && (!group || item.group === group)).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Whether the catalog says which goods the AI can use (the bundled one does; a local CSV folder may not). */
  get hasAiUse(): boolean {
    for (const item of this.items.values()) if (Number(item.aiUseJudgeId) > 0) return true;
    return false;
  }

  /** Goods the player-like AI can use: those with an `EquipParamGoods.aiUseJudgeId`. Without that data, every consumable. */
  consumables(): CatalogItem[] {
    const goods = this.list('goods');
    return this.hasAiUse ? goods.filter((item) => Number(item.aiUseJudgeId) > 0) : goods.filter((item) => item.group === 'Consumables');
  }

  /** The most of a goods item a Tarnished can carry: its stack size, at most 99. */
  stackLimit(id: number): number {
    const stack = Number(this.get('goods', id)?.maxNum);
    return stack > 0 ? Math.min(MOST_CONSUMABLES, stack) : MOST_CONSUMABLES;
  }

  /** Affinity indices a weapon accepts; every affinity when the weapon is unknown. */
  affinities(id: number): number[] {
    const allowed = this.get('weapon', id)?.allowed_affinities;
    if (!allowed) return AFFINITIES.map((_, index) => index);
    const names = allowed.split('|');
    return AFFINITIES.map((name, index) => (names.includes(name) ? index : -1)).filter((index) => index >= 0);
  }

  maxUpgrade(id: number): number {
    return this.get('weapon', id)?.reinforcement === 'somber' ? 10 : 25;
  }

  /** Whether a weapon takes Ashes of War, and which fit its type and the given affinity. */
  ashesFor(weaponId: number, affinity: number): { mountable: boolean; compatible: CatalogItem[]; other: CatalogItem[] } {
    const weapon = this.get('weapon', weaponId);
    const ashes = this.list('ash');
    if (!weapon || weapon.aow_allowed === undefined) return { mountable: true, compatible: ashes, other: [] };
    const type = String(weapon.wepTypeCol ?? '');
    const fits = (ash: CatalogItem) => String(ash.compatibleWepTypes ?? '').split('|').includes(type)
      && (!ash.allowedAffinities || ash.allowedAffinities.split('|').includes(AFFINITIES[affinity]));
    return { mountable: weapon.aow_allowed === '1', compatible: ashes.filter(fits), other: ashes.filter((ash) => !fits(ash)) };
  }

  icon(kind: ItemKind, id: number): string | undefined {
    const cacheKey = this.key(kind, id);
    if (this.iconCache.has(cacheKey)) return this.iconCache.get(cacheKey);
    const item = this.get(kind, id);
    if (!item || !this.database) { this.iconCache.set(cacheKey, undefined); return undefined; }
    const candidates = [item.icon_name ?? item.name];
    if (item.group === 'Ammo' && item.name.includes(' - ')) {
      const [group, rawName] = item.name.split(' - ', 2);
      const parts = rawName.split(' (', 2);
      const suffix = parts.length > 1 ? ` (${parts[1]}` : '';
      candidates.push(`${parts[0].endsWith(group) ? parts[0] : `${parts[0]} ${group}`}${suffix}`);
    }
    if (kind === 'weapon') candidates.unshift(`${item.name} (Weapon)`);
    const iconName = candidates.map(normalize).map((candidate) => this.icons.get(candidate)).find(Boolean);
    if (!iconName) { this.iconCache.set(cacheKey, undefined); return undefined; }
    const statement = this.database.prepare('SELECT data FROM icons WHERE name = ?');
    statement.bind([iconName]);
    if (!statement.step()) { statement.free(); this.iconCache.set(cacheKey, undefined); return undefined; }
    const data = statement.get()[0] as Uint8Array;
    statement.free();
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    const type = iconName.toLowerCase().endsWith('.webp') ? 'webp' : 'png';
    const result = `data:image/${type};base64,${btoa(binary)}`;
    this.iconCache.set(cacheKey, result);
    return result;
  }
}

async function attachIconDatabase(catalog: ItemCatalog, bytes: ArrayBuffer): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  catalog.database = new SQL.Database(new Uint8Array(bytes));
  const rows = catalog.database.exec('SELECT name FROM icons ORDER BY name')[0]?.values ?? [];
  rows.forEach(([name]) => catalog.icons.set(normalize(String(name).replace(/\.[^.]+$/, '')), String(name)));
}

export async function loadBundledCatalog(): Promise<ItemCatalog> {
  const root = `${import.meta.env.BASE_URL}catalog/`;
  const [itemsResponse, iconsResponse] = await Promise.all([fetch(`${root}items.json`, { cache: 'no-cache' }), fetch(`${root}icons.db`, { cache: 'no-cache' })]);
  if (!itemsResponse.ok || !iconsResponse.ok) throw new Error('The bundled item resources could not be loaded.');
  const catalog = new ItemCatalog();
  const items = await itemsResponse.json() as CatalogItem[];
  items.forEach((item) => catalog.items.set(catalog.key(item.kind, Number(item.id)), { ...item, id: Number(item.id) }));
  await attachIconDatabase(catalog, await iconsResponse.arrayBuffer());
  catalog.sourceName = 'Bundled ER Save Manager resources';
  return catalog;
}
