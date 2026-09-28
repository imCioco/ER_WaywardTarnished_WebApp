import { useMemo, useState } from 'react';
import { Alert, Avatar, Button, Card, Descriptions, Divider, Drawer, Empty, Flex, Form, InputNumber, Listy, Select, Slider, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ItemCatalog } from '../catalog';
import { LEVEL_SPREAD, STATS, greatRuneEffect } from '../constants';
import type { Archetype } from '../library';
import { planValues, sampleTarnished, seededRandom, type MergedLibrary, type Rules } from '../simulate';
import type { ItemKind, Tarnished } from '../types';
import { ArchetypePopover } from './ArchetypeInfo';
import { AttributeBreakdown, SourceLegend } from './AttributeBreakdown';
import { ItemIcon } from './ItemSelect';

type Props = {
  open: boolean;
  entry?: Tarnished;
  library: MergedLibrary;
  rules?: Rules;
  catalog: ItemCatalog;
  archetypes: Archetype[];
  initialLevel?: number;
  onClose: () => void;
};

type Row = { key: string; slot: string; kind: ItemKind; id: number; detail?: string };

const gestureLabel = (name?: string) => (name ? name.replaceAll('_', ' ') : 'none');

// The templates' flasks are NPC-only goods rows, not in the item catalog.
const NPC_FLASKS: Record<number, string> = { 50201: 'Flask of Crimson Tears (NPC)', 50203: 'Flask of Crimson Tears (NPC)' };
const goodsName = (catalog: ItemCatalog, id: number) => (catalog.get('goods', id) ? catalog.name('goods', id) : NPC_FLASKS[id] ?? catalog.name('goods', id));
const goodsIcon = (catalog: ItemCatalog, id: number) => catalog.icon('goods', id) ?? (NPC_FLASKS[id] ? catalog.icon('goods', 1001) : undefined);

/** Builds one Tarnished of an entry the way the mod would, so a build can be checked before it is installed. */
export function SampleDrawer({ open, entry, library, rules, catalog, archetypes, initialLevel = 50, onClose }: Props) {
  const [playerLevel, setPlayerLevel] = useState(initialLevel);
  const [spread, setSpread] = useState(LEVEL_SPREAD);
  const [upgrade, setUpgrade] = useState(10);
  const [className, setClassName] = useState<string>('any');
  const [dlcInstalled, setDlcInstalled] = useState(true);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const classes = entry && !entry.attributes ? (Array.isArray(entry.class) ? entry.class : entry.class ? [entry.class] : []) : [];

  const sample = useMemo(() => {
    if (!entry || !rules) return undefined;
    try {
      if (!dlcInstalled && entry.dlc) return undefined;
      return sampleTarnished(entry, library, rules, { playerLevel, spread, weaponProgress: upgrade / 25, className: className === 'any' ? undefined : className, random: seededRandom(seed), dlcInstalled });
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }, [entry, library, rules, playerLevel, spread, upgrade, className, seed, dlcInstalled]);

  const rows: Row[] = [];
  if (sample) {
    const weaponDetail = (weapon: { ash?: number; upgrade?: number }) => [weapon.upgrade !== undefined ? `+${weapon.upgrade}` : undefined, weapon.ash !== undefined ? catalog.name('ash', weapon.ash).replace(/^Ash of War: /, '') : undefined].filter(Boolean).join(' · ');
    sample.gear.right.forEach((weapon, index) => rows.push({ key: `r${index}`, slot: index === 0 ? 'Right hand' : `Right hand ${index + 1}`, kind: 'weapon', id: weapon.id, detail: weaponDetail(weapon) }));
    sample.gear.left.forEach((weapon, index) => rows.push({ key: `l${index}`, slot: index === 0 ? 'Left hand' : `Left hand ${index + 1}`, kind: 'weapon', id: weapon.id, detail: weaponDetail(weapon) }));
    ['Head', 'Chest', 'Arms', 'Legs'].forEach((slot, index) => rows.push({ key: `a${index}`, slot, kind: 'armor', id: sample.gear.armor[index] ?? -1 }));
    sample.gear.talismans.forEach((id, index) => rows.push({ key: `t${index}`, slot: `Talisman ${index + 1}`, kind: 'talisman', id }));
    sample.gear.spells.forEach((id, index) => rows.push({ key: `s${index}`, slot: `Spell ${index + 1}`, kind: 'spell', id }));
    if (sample.gear.greatRune !== undefined) rows.push({ key: 'rune', slot: 'Great Rune, worn from its arrival', kind: 'goods', id: sample.gear.greatRune, detail: greatRuneEffect(sample.gear.greatRune) });
    if (sample.gear.arrows) rows.push({ key: 'arrows', slot: 'Arrows', kind: 'weapon', id: sample.gear.arrows[0], detail: `×${sample.gear.arrows[1]}` });
    if (sample.gear.bolts) rows.push({ key: 'bolts', slot: 'Bolts', kind: 'weapon', id: sample.gear.bolts[0], detail: `×${sample.gear.bolts[1]}` });
  }
  const style = sample?.style ? archetypes.find((archetype) => archetype.name === sample.style) : undefined;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={760}
      title={entry ? `Test build: ${entry.name}` : 'Test build'}
      extra={<Tooltip title="Build another Tarnished with the same settings"><Button type="primary" icon={<ReloadOutlined />} onClick={() => setSeed(Math.floor(Math.random() * 1e9))} disabled={!sample}>Roll again</Button></Tooltip>}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">A preview of one Tarnished from this entry, built the way the mod does in game: the level is your level plus or minus the spread, the loadout (or class-library draw) is the one its points can pay for, then attributes are raised for the gear, the stat plan and growth. Each roll is random, like each arrival.</Typography.Paragraph>
      <Form layout="vertical" className="sample-controls">
        <Flex gap={16} wrap>
          <Form.Item label="Your level" tooltip="The player level the Tarnished is scaled to." className="sample-level">
            <Flex gap={10} align="center"><Slider min={1} max={250} value={Math.min(playerLevel, 250)} onChange={setPlayerLevel} style={{ flex: 1 }} /><InputNumber min={1} max={713} value={playerLevel} onChange={(value) => setPlayerLevel(Number(value ?? 1))} /></Flex>
          </Form.Item>
          <Form.Item label="Level spread" tooltip="level_spread in WaywardTarnished.ini: Tarnished target your level plus or minus this many levels (default 5).">
            <InputNumber min={0} max={50} value={spread} onChange={(value) => setSpread(Number(value ?? 0))} prefix="±" />
          </Form.Item>
          <Form.Item label="Your best weapon" tooltip="Tarnished follow your best weapon's upgrade: within two levels on the +25 scale, one on the +10 scale.">
            <InputNumber min={0} max={25} value={upgrade} onChange={(value) => setUpgrade(Number(value ?? 0))} prefix="+" suffix="of 25" />
          </Form.Item>
          <Form.Item label="Shadow of the Erdtree" tooltip="Off: built as for a player without the DLC. The mod leaves the DLC's items out of every entry, and entries built around the DLC out whole.">
            <Switch checked={dlcInstalled} onChange={setDlcInstalled} checkedChildren="Installed" unCheckedChildren="Not installed" />
          </Form.Item>
          {classes.length > 1 && (
            <Form.Item label="Class">
              <Select value={className} onChange={setClassName} style={{ width: 150 }} options={[{ value: 'any', label: 'Any (random)' }, ...classes.map((name) => ({ value: name, label: name }))]} />
            </Form.Item>
          )}
        </Flex>
      </Form>
      {!rules && <Alert type="warning" showIcon message="Item rules are still loading" description="The preview needs weapon and spell requirements; try again in a moment." />}
      {rules && !sample && (!dlcInstalled && entry?.dlc
        ? <Empty description="Built around Shadow of the Erdtree: players without the DLC never meet it." />
        : <Empty description="This entry cannot be built yet: give it a class and a loadout or pool." />)}
      {sample && (
        <>
          <Card size="small" className="sample-card">
            <Flex justify="space-between" align="start" gap={12} wrap>
              <div>
                <Typography.Title level={3} className="sample-name">{sample.name}</Typography.Title>
                <Space size={4} wrap>
                  <Tag>{sample.entry.name}</Tag>
                  <Tag>{sample.className ?? 'custom attributes'}</Tag>
                  <Tag>{sample.sex}</Tag>
                  {sample.style ? <ArchetypePopover archetype={style}><Tag>style: {sample.style}</Tag></ArchetypePopover> : <Tag>plain player-like AI</Tag>}
                  {sample.twoHanded && <Tooltip title="Its right hand holds a paired weapon (fists, claws, perfume bottles, backhand blades, ...): the mod gives it a personality row that makes the AI two-hand it and keep it that way, on top of its style."><Tag color="gold">two-handed</Tag></Tooltip>}
                  {sample.dlcRemoved > 0 && <Tooltip title="Shadow of the Erdtree items the mod leaves out without the DLC."><Tag>{sample.dlcRemoved} DLC items left out</Tag></Tooltip>}
                </Space>
              </div>
              <div className="sample-level-badge"><Typography.Text type="secondary">Level</Typography.Text><strong>{sample.level}</strong></div>
            </Flex>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }} className="sample-facts" items={[
              { key: 'target', label: 'Target level', children: <Tooltip title={`Your level ${sample.playerLevel} ${sample.target - sample.playerLevel >= 0 ? '+' : '−'} ${Math.abs(sample.target - sample.playerLevel)}, never below the class`}>{sample.target}</Tooltip> },
              { key: 'start', label: 'Starts at', children: `level ${sample.startLevel} (${sample.budget} points to spend)` },
              { key: 'gear', label: 'Equipment', children: sample.entry.pool ? 'Class library draw' : `Loadout from level ${sample.gear.level}` },
              { key: 'plan', label: 'Stat plan', children: sample.plan ? `Level ${sample.plan.level} plan` : 'None applies' },
              { key: 'weight', label: 'Equip weight', children: `${sample.weight.toFixed(1)} (needs ${sample.needed[2]} endurance)` },
              { key: 'gestures', label: 'Gestures', children: `greets with ${gestureLabel(sample.greeting)}, celebrates with ${gestureLabel(sample.victory)}` },
            ]} />
          </Card>
          {sample.allocation.overspent > 0 && <Alert type="warning" showIcon className="sample-alert" message={`The gear needs ${sample.allocation.overspent} more points than level ${sample.target} gives`} description={`Requirements always come first, so this Tarnished ends at level ${sample.level}. The mod prefers a cheaper loadout or option when one fits; consider a later level for this gear.`} />}
          <Divider titlePlacement="start">Attributes</Divider>
          <SourceLegend />
          <AttributeBreakdown allocation={sample.allocation} planned={sample.plan ? planValues(sample.plan) : undefined} />
          <Typography.Paragraph type="secondary" className="sample-note">Gear needs: {STATS.map((stat, index) => (sample.needed[index] ? `${stat} ${sample.needed[index]}` : '')).filter(Boolean).join(', ') || 'nothing'}.</Typography.Paragraph>
          <Divider titlePlacement="start">Equipment</Divider>
          <Listy
            items={rows}
            rowKey="key"
            virtual={false}
            classNames={{ item: 'plain-listy-item' }}
            className="sample-list"
            itemRender={(row) => (
              <Flex align="center" gap={12} className="sample-row">
                <ItemIcon catalog={catalog} kind={row.kind} id={row.id} size={36} />
                <Flex vertical className="sample-row-copy">
                  <Space size={6} wrap><Typography.Text>{row.id < 0 ? 'Empty' : catalog.name(row.kind, row.id)}</Typography.Text>{row.detail && <Typography.Text type="secondary">{row.detail}</Typography.Text>}</Space>
                  <Typography.Text type="secondary" className="sample-row-slot">{row.slot}</Typography.Text>
                </Flex>
              </Flex>
            )}
          />
          <Divider titlePlacement="start">Items</Divider>
          {sample.items.length ? (
            <Flex wrap gap={8}>
              {sample.items.map(([id, count]) => (
                <Tooltip key={id} title={sample.consumableIds.includes(id) ? 'Drawn from the consumables pool' : 'From the template or the entry’s items'}>
                  <Tag className="sample-item"><Avatar shape="square" size={22} src={goodsIcon(catalog, id)} className="item-avatar" /> {goodsName(catalog, id)} ×{count}</Tag>
                </Tooltip>
              ))}
            </Flex>
          ) : <Typography.Text type="secondary">Carries nothing.</Typography.Text>}
        </>
      )}
    </Drawer>
  );
}
