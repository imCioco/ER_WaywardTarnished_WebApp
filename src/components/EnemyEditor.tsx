import { useState } from 'react';
import { Alert, Button, Card, Checkbox, Flex, Form, Input, InputNumber, Popconfirm, Segmented, Select, Space, Switch, Tooltip, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, ExperimentOutlined, SwapOutlined } from '@ant-design/icons';
import { CLASSES, ROLES, ROLE_HELP } from '../constants';
import type { ItemCatalog } from '../catalog';
import { isNamed, type Archetype } from '../library';
import type { MergedLibrary, Rules } from '../simulate';
import type { Consumable, EntryNames, EquipmentPool, Loadout, Tarnished } from '../types';
import { EntryOdds } from './AppearanceOdds';
import { AttributesCard } from './AttributesCard';
import { ConsumablesEditor } from './ConsumablesEditor';
import { SampleDrawer } from './SampleDrawer';
import { GestureField } from './GestureField';
import { LoadoutEditor } from './LoadoutEditor';
import { PoolEditor } from './PoolEditor';

type Props = {
  entry: Tarnished;
  view: 'overview' | 'equipment' | 'behavior' | 'personalities';
  catalog: ItemCatalog;
  gestureNames: string[];
  sharedConsumables?: Consumable[];
  /** Different consumables each Tarnished carries by default ([consumables] kinds). */
  sharedKinds?: number;
  /** base.toml and this file as the mod loads them, for odds and test builds. */
  library: MergedLibrary;
  rules?: Rules;
  archetypes: Archetype[];
  onChange: (entry: Tarnished) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

type NamesMode = 'shared' | 'list' | 'sex';

/** An entry's own given names: none (the shared names), one list for either sex, or a list per sex. */
function NamesField({ value, onChange }: { value?: EntryNames; onChange: (names?: EntryNames) => void }) {
  const mode: NamesMode = value === undefined ? 'shared' : Array.isArray(value) ? 'list' : 'sex';
  const all = value === undefined ? [] : Array.isArray(value) ? value : [...new Set([...(value.male ?? []), ...(value.female ?? [])])];
  const switchTo = (next: NamesMode) => {
    if (next === 'shared') onChange(undefined);
    else if (next === 'list') onChange(all);
    else onChange(Array.isArray(value) ? { male: [...value], female: [...value] } : value ?? { male: [], female: [] });
  };
  const bySex = !Array.isArray(value) && value ? value : { male: [], female: [] };
  const setSex = (sex: 'male' | 'female', names: string[]) => onChange({ ...bySex, [sex]: names });
  const tags = (names: string[], change: (names: string[]) => void, placeholder: string) => <Select mode="tags" value={names} onChange={change} tokenSeparators={[',']} placeholder={placeholder} />;
  return (
    <>
      <Form.Item label="Given names" help={mode === 'shared' ? 'Uses the library’s shared male and female names.' : mode === 'list' ? 'Used for either sex. Exactly one name makes a named Tarnished: a single person who is not chosen again while present.' : 'Each sex draws from its own list; a sex left empty uses the shared names.'}>
        <Segmented value={mode} onChange={(next) => switchTo(next as NamesMode)} options={[{ value: 'shared', label: 'Shared names' }, { value: 'list', label: 'Own names' }, { value: 'sex', label: 'Own names by sex' }]} />
      </Form.Item>
      {mode === 'list' && <Form.Item label="Names">{tags(all, (names) => onChange(names), 'Type a name and press Enter')}</Form.Item>}
      {mode === 'sex' && (
        <div className="two-column-fields">
          <Form.Item label="Male names">{tags(bySex.male ?? [], (names) => setSex('male', names), 'Type a name and press Enter')}</Form.Item>
          <Form.Item label="Female names">{tags(bySex.female ?? [], (names) => setSex('female', names), 'Type a name and press Enter')}</Form.Item>
        </div>
      )}
    </>
  );
}

/**
 * Title patterns: the mod picks one of the list at random, so a title listed twice comes twice as often
 * (a plain {name} listed several times makes bare names common). Each title is shown once, with its count.
 */
function TitlesField({ value, onChange }: { value?: string[]; onChange: (titles: string[]) => void }) {
  const counts = new Map<string, number>();
  for (const title of value ?? []) counts.set(title, (counts.get(title) ?? 0) + 1);
  const unique = [...counts.keys()];
  const expand = (next: Map<string, number>) => onChange([...next].flatMap(([title, count]) => Array<string>(count).fill(title)));
  const setUnique = (titles: string[]) => expand(new Map(titles.map((title) => [title, counts.get(title) ?? 1])));
  const setCount = (title: string, count: number) => expand(new Map([...counts].map(([known, current]) => [known, known === title ? count : current])));
  const total = value?.length ?? 0;
  return (
    <Form.Item label="Title patterns" help="One is picked per Tarnished; {name} is the given name, and a plain {name} gives the bare name. A title’s count makes it that many times as likely. Titles are shared by both sexes, so keep them neutral.">
      <Select mode="tags" value={unique} onChange={setUnique} tokenSeparators={[',']} placeholder="Example: Knight {name}" />
      {unique.length > 0 && (
        <Flex wrap gap={6} className="title-counts">
          {unique.map((title) => (
            <Tooltip key={title} title={`${Math.round((100 * (counts.get(title) ?? 1)) / total)}% of this entry’s Tarnished`}>
              <Space.Compact size="small">
                <Button size="small" disabled className="title-count-label">{title}</Button>
                <InputNumber size="small" min={1} max={20} value={counts.get(title)} prefix="×" onChange={(count) => setCount(title, Math.max(1, Number(count ?? 1)))} style={{ width: 70 }} />
              </Space.Compact>
            </Tooltip>
          ))}
        </Flex>
      )}
    </Form.Item>
  );
}

export function EnemyEditor({ entry, view, catalog, gestureNames, sharedConsumables, sharedKinds, library, rules, archetypes, onChange, onDuplicate, onDelete }: Props) {
  const [testing, setTesting] = useState(false);
  const patch = (values: Partial<Tarnished>) => onChange({ ...entry, ...values });
  const testButton = <Tooltip title="Build one complete, random Tarnished from this entry to see how it turns out"><Button icon={<ExperimentOutlined />} onClick={() => setTesting(true)}>Test build</Button></Tooltip>;
  const drawer = <SampleDrawer open={testing} entry={entry} library={library} rules={rules} catalog={catalog} archetypes={archetypes} onClose={() => setTesting(false)} />;
  const setOptional = (field: 'greetings' | 'victories' | 'consumables' | 'consumable_kinds' | 'pvp_damage' | 'dlc' | 'chance' | 'names', value: unknown) => {
    const next = structuredClone(entry);
    if (value === undefined) delete next[field]; else (next as Record<string, unknown>)[field] = value;
    onChange(next);
  };
  const classes = Array.isArray(entry.class) ? entry.class : entry.class ? [entry.class] : [];
  const switchMode = () => {
    const next = structuredClone(entry);
    if (next.pool) {
      delete next.pool;
      next.gear = [{ level: 1, right: [2000000], left: [], armor: [-1, -1, -1, -1], talismans: [], spells: [] }];
    } else {
      delete next.gear;
      next.pool = { right: [2000000], left: [-1] };
    }
    onChange(next);
  };

  if (view === 'equipment') {
    return (
      <div className="editor-page">
        <div className="editor-titlebar">
          <div><Typography.Title level={2}>{entry.name}</Typography.Title><Typography.Text type="secondary">{entry.pool ? 'Random class library' : 'Fixed level builds'} · {entry.id}</Typography.Text></div>
          <Space wrap>
            {testButton}
            <Popconfirm title={`Switch to ${entry.pool ? 'fixed loadouts' : 'a random pool'}? Current equipment will be replaced.`} onConfirm={switchMode}>
              <Tooltip title={entry.pool ? 'Replace the random pool with hand-made level loadouts' : 'Replace the loadouts with a random item pool (class library)'}><Button icon={<SwapOutlined />}>Switch equipment mode</Button></Tooltip>
            </Popconfirm>
          </Space>
        </div>
        {entry.pool ? <PoolEditor pool={entry.pool} catalog={catalog} onChange={(pool: EquipmentPool) => patch({ pool })} /> : <LoadoutEditor gear={entry.gear ?? []} catalog={catalog} onChange={(gear: Loadout[]) => patch({ gear })} />}
        <section className="consumables-section">
          <div className="section-heading">
            <div><Typography.Title level={3}>Consumables</Typography.Title><Typography.Paragraph type="secondary">Pots, knives, greases and buffs the AI uses from its item slots, on top of the template’s flask. Each Tarnished draws the shared number of different consumables within its level.</Typography.Paragraph></div>
          </div>
          <Form layout="vertical" className="kinds-field">
            <Form.Item label="Different consumables it carries" help={`Empty uses the shared number${sharedKinds !== undefined ? ` (${sharedKinds})` : ''}. The template’s flask comes first; ten item slots in all.`}>
              <InputNumber min={0} max={9} value={entry.consumable_kinds} placeholder={sharedKinds !== undefined ? `shared: ${sharedKinds}` : 'shared'} onChange={(value) => setOptional('consumable_kinds', value === null ? undefined : Number(value))} />
            </Form.Item>
          </Form>
          <ConsumablesEditor catalog={catalog} value={entry.consumables} shared={sharedConsumables} inheritable onChange={(value) => setOptional('consumables', value)} />
        </section>
        {drawer}
      </div>
    );
  }

  if (view === 'behavior') {
    return (
      <div className="editor-page">
        <div className="editor-titlebar"><div><Typography.Title level={2}>Names & gestures</Typography.Title><Typography.Text type="secondary">Names, titles and gestures for {entry.name}. Fighting styles are in AI personalities.</Typography.Text></div></div>
        <div className="form-grid">
          <Card title="Names and titles" className="form-card span-2">
            <Form layout="vertical">
              <NamesField value={entry.names} onChange={(names) => setOptional('names', names)} />
              <TitlesField value={entry.titles} onChange={(titles) => patch({ titles })} />
            </Form>
          </Card>
          <Card title="Greeting gesture" className="form-card"><GestureField label="When this Tarnished approaches" value={entry.greetings} choices={gestureNames} onChange={(value) => setOptional('greetings', value)} /></Card>
          <Card title="Victory gesture" className="form-card"><GestureField label="After defeating the player" value={entry.victories} choices={gestureNames} onChange={(value) => setOptional('victories', value)} /></Card>
        </div>
      </div>
    );
  }

  const roles = entry.roles ?? ROLES;
  const custom = Boolean(entry.attributes);
  return (
    <div className="editor-page">
      <div className="editor-titlebar">
        <div><Typography.Title level={2}>{entry.name}</Typography.Title><Typography.Text type="secondary">Identity, when and how often it appears, and how its attributes grow.</Typography.Text></div>
        <Space wrap>
          {testButton}
          <Tooltip title="Add a copy of this Tarnished right below it"><Button icon={<CopyOutlined />} onClick={onDuplicate}>Duplicate</Button></Tooltip>
          <Popconfirm title="Delete this Tarnished?" onConfirm={onDelete}><Tooltip title="Remove this Tarnished from the library"><Button danger icon={<DeleteOutlined />}>Delete</Button></Tooltip></Popconfirm>
        </Space>
      </div>
      <div className="form-grid">
        <Card title="Identity" className="form-card span-2">
          <Form layout="vertical">
            <div className="two-column-fields">
              <Form.Item label="Display name" required tooltip="The build’s label in logs; the in-game name when it has no given names."><Input value={entry.name} onChange={(event) => patch({ name: event.target.value })} /></Form.Item>
              <Form.Item label="Library ID" required tooltip="Unique. Used by the INI’s tarnished = … and in logs; an entry with the same ID in a later file replaces this one."><Input value={entry.id} onChange={(event) => patch({ id: event.target.value })} /></Form.Item>
              <Form.Item label="Starting class" help={custom ? 'Uses custom starting attributes instead (see Attributes).' : 'Several classes: one is picked per Tarnished.'}><Select mode="multiple" disabled={custom} value={classes} options={CLASSES.map((name) => ({ value: name, label: name }))} onChange={(values) => patch({ class: values.length === 1 ? values[0] : values })} /></Form.Item>
              <Form.Item label="Sex"><Select value={entry.sex ?? 'any'} options={['any', 'male', 'female'].map((value) => ({ value, label: value }))} onChange={(sex) => patch({ sex })} /></Form.Item>
            </div>
          </Form>
        </Card>
        <Card title="Availability" className="form-card">
          <Form layout="vertical">
            <Form.Item label="Enabled"><Switch checked={entry.enabled !== false} onChange={(enabled) => patch({ enabled })} checkedChildren="On" unCheckedChildren="Off" /></Form.Item>
            <Form.Item label="Roles" help={roles.includes('hunter') && !roles.includes('summon') ? 'As a hunter it can also be summoned from golden signs.' : !roles.includes('hunter') && !roles.includes('summon') ? 'Never summoned from golden signs.' : undefined}>
              <Checkbox.Group value={roles} onChange={(next) => patch({ roles: next as string[] })}>
                <Flex wrap gap="4px 12px">{ROLES.map((role) => <Tooltip key={role} title={ROLE_HELP[role]}><Checkbox value={role}>{role}</Checkbox></Tooltip>)}</Flex>
              </Checkbox.Group>
            </Form.Item>
            <div className="two-column-fields"><Form.Item label="Minimum level" tooltip="Only appears for players at or above this level."><InputNumber min={0} max={713} value={entry.min_level ?? 0} onChange={(value) => patch({ min_level: Number(value ?? 0) })} /></Form.Item><Form.Item label="Maximum level" tooltip="Only appears for players at or below this level."><InputNumber min={0} max={713} value={entry.max_level ?? 713} onChange={(value) => patch({ max_level: Number(value ?? 713) })} /></Form.Item></div>
            <Form.Item label="How often it appears" tooltip="By weight: a share of the picks in proportion to the other eligible entries’ weights. Fixed chance: this percent of the picks while eligible, whatever the weights.">
              <Segmented value={entry.chance === undefined ? 'weight' : 'chance'} onChange={(mode) => setOptional('chance', mode === 'chance' ? 5 : undefined)} options={[{ value: 'weight', label: 'By weight' }, { value: 'chance', label: 'Fixed chance' }]} />
            </Form.Item>
            {entry.chance === undefined
              ? <Form.Item label="Selection weight" help="Default 10. Twice the weight, twice as likely as another entry sharing by weight."><InputNumber min={0} value={entry.weight ?? 10} onChange={(value) => patch({ weight: Number(value ?? 10) })} /></Form.Item>
              : <Form.Item label="Fixed chance" help="Percent of the picks in each role while it is eligible."><InputNumber min={0} max={100} step={0.5} suffix="%" value={entry.chance} onChange={(value) => setOptional('chance', value === null ? 0 : Number(value))} /></Form.Item>}
            <EntryOdds entry={entry} library={library} />
          </Form>
        </Card>
        <Card title="Runtime flags" className="form-card">
          <Form layout="vertical">
            <Form.Item label="PvP damage rules" help="On: damage is scaled as between players. Off: full, uncorrected damage. INI default follows pvp_damage in WaywardTarnished.ini.">
              <Segmented value={entry.pvp_damage === undefined ? 'ini' : entry.pvp_damage ? 'on' : 'off'} options={[{ value: 'ini', label: 'INI default' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(value) => setOptional('pvp_damage', value === 'ini' ? undefined : value === 'on')} />
            </Form.Item>
            <Form.Item label="Built around Shadow of the Erdtree" help="On: left out whole for players without the DLC. Off: they meet it without its DLC items (the mod leaves those out); Validate warns when nothing would be left to fight with.">
              <Switch checked={entry.dlc === true} onChange={(dlc) => setOptional('dlc', dlc ? true : undefined)} checkedChildren="DLC" unCheckedChildren="Base game" />
            </Form.Item>
            {isNamed(entry) && <Alert type="info" showIcon message="Named Tarnished" description="It has one given name, so it is a single person: while it is in your world or the host’s, it is not chosen again. It counts in the “Named Tarnished” appearance group." />}
          </Form>
        </Card>
        <AttributesCard entry={entry} rules={rules} onChange={onChange} onTest={() => setTesting(true)} />
      </div>
      {drawer}
    </div>
  );
}
