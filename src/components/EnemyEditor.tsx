import { Button, Card, Checkbox, Divider, Form, Input, InputNumber, Popconfirm, Select, Space, Switch, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import { CLASSES, ROLES, STATS } from '../constants';
import type { ItemCatalog } from '../catalog';
import type { Consumable, EquipmentPool, Loadout, Tarnished } from '../types';
import { ConsumablesEditor } from './ConsumablesEditor';
import { GestureField } from './GestureField';
import { LoadoutEditor } from './LoadoutEditor';
import { PoolEditor } from './PoolEditor';

type Props = {
  entry: Tarnished;
  view: 'overview' | 'equipment' | 'behavior' | 'personalities';
  catalog: ItemCatalog;
  gestureNames: string[];
  sharedConsumables?: Consumable[];
  onChange: (entry: Tarnished) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function EnemyEditor({ entry, view, catalog, gestureNames, sharedConsumables, onChange, onDuplicate, onDelete }: Props) {
  const patch = (values: Partial<Tarnished>) => onChange({ ...entry, ...values });
  const setOptional = (field: 'greetings' | 'victories' | 'consumables', value: unknown[] | undefined) => {
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
          <Popconfirm title={`Switch to ${entry.pool ? 'fixed loadouts' : 'a random pool'}? Current equipment will be replaced.`} onConfirm={switchMode}>
            <Button icon={<SwapOutlined />}>Switch equipment mode</Button>
          </Popconfirm>
        </div>
        {entry.pool ? <PoolEditor pool={entry.pool} catalog={catalog} onChange={(pool: EquipmentPool) => patch({ pool })} /> : <LoadoutEditor gear={entry.gear ?? []} catalog={catalog} onChange={(gear: Loadout[]) => patch({ gear })} />}
        <section className="consumables-section">
          <div className="section-heading">
            <div><Typography.Title level={3}>Consumables</Typography.Title><Typography.Paragraph type="secondary">Pots, knives, greases and buffs the AI uses from its item slots, on top of the template’s flask. Each Tarnished draws the shared number of different consumables within its level.</Typography.Paragraph></div>
          </div>
          <ConsumablesEditor catalog={catalog} value={entry.consumables} shared={sharedConsumables} inheritable onChange={(value) => setOptional('consumables', value)} />
        </section>
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
              <Form.Item label="Possible given names"><Select mode="tags" value={entry.names ?? []} onChange={(names) => patch({ names })} tokenSeparators={[',']} placeholder="Type a name and press Enter" /></Form.Item>
              <Form.Item label="Title patterns"><Select mode="tags" value={entry.titles ?? []} onChange={(titles) => patch({ titles })} tokenSeparators={[',']} placeholder="Example: Knight {name}" /></Form.Item>
            </Form>
          </Card>
          <Card title="Greeting gesture" className="form-card"><GestureField label="When this Tarnished approaches" value={entry.greetings} choices={gestureNames} onChange={(value) => setOptional('greetings', value)} /></Card>
          <Card title="Victory gesture" className="form-card"><GestureField label="After defeating the player" value={entry.victories} choices={gestureNames} onChange={(value) => setOptional('victories', value)} /></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <div className="editor-titlebar">
        <div><Typography.Title level={2}>{entry.name}</Typography.Title><Typography.Text type="secondary">Edit availability, identity and attribute growth.</Typography.Text></div>
        <Space><Button icon={<CopyOutlined />} onClick={onDuplicate}>Duplicate</Button><Popconfirm title="Delete this Tarnished?" onConfirm={onDelete}><Button danger icon={<DeleteOutlined />}>Delete</Button></Popconfirm></Space>
      </div>
      <div className="form-grid">
        <Card title="Identity" className="form-card span-2">
          <Form layout="vertical">
            <div className="two-column-fields">
              <Form.Item label="Display name" required><Input value={entry.name} onChange={(event) => patch({ name: event.target.value })} /></Form.Item>
              <Form.Item label="Library ID" required><Input value={entry.id} onChange={(event) => patch({ id: event.target.value })} /></Form.Item>
              <Form.Item label="Starting class"><Select mode="multiple" value={classes} options={CLASSES.map((name) => ({ value: name, label: name }))} onChange={(values) => patch({ class: values.length === 1 ? values[0] : values })} /></Form.Item>
              <Form.Item label="Sex"><Select value={entry.sex ?? 'any'} options={['any', 'male', 'female'].map((value) => ({ value, label: value }))} onChange={(sex) => patch({ sex })} /></Form.Item>
            </div>
          </Form>
        </Card>
        <Card title="Availability" className="form-card">
          <Form layout="vertical">
            <Form.Item label="Enabled"><Switch checked={entry.enabled !== false} onChange={(enabled) => patch({ enabled })} checkedChildren="On" unCheckedChildren="Off" /></Form.Item>
            <Form.Item label="Roles"><Checkbox.Group value={entry.roles ?? ROLES} options={ROLES.map((role) => ({ value: role, label: role }))} onChange={(roles) => patch({ roles: roles as string[] })} /></Form.Item>
            <div className="two-column-fields"><Form.Item label="Minimum level"><InputNumber min={0} max={713} value={entry.min_level ?? 0} onChange={(value) => patch({ min_level: Number(value ?? 0) })} /></Form.Item><Form.Item label="Maximum level"><InputNumber min={0} max={713} value={entry.max_level ?? 713} onChange={(value) => patch({ max_level: Number(value ?? 713) })} /></Form.Item></div>
            <Form.Item label="Selection weight"><InputNumber min={0} value={entry.weight ?? 10} onChange={(value) => patch({ weight: Number(value ?? 10) })} /></Form.Item>
          </Form>
        </Card>
        <Card title="Runtime flags" className="form-card">
          <Form layout="vertical"><Form.Item label="Use PvP damage rules"><Switch checked={entry.pvp_damage !== false} onChange={(pvp_damage) => patch({ pvp_damage })} checkedChildren="On" unCheckedChildren="Off" /></Form.Item></Form>
          <Typography.Paragraph type="secondary">The mod still applies its own global runtime settings and safety checks.</Typography.Paragraph>
        </Card>
        <Card title="Attribute growth" className="form-card span-2">
          <Typography.Paragraph type="secondary">Relative weights used when the Tarnished gains levels. Zero leaves a stat unchanged.</Typography.Paragraph>
          <div className="stats-grid">
            {STATS.map((stat) => <Form.Item key={stat} label={stat}><InputNumber min={0} max={255} value={entry.growth?.[stat] ?? 0} onChange={(value) => patch({ growth: { ...(entry.growth ?? {}), [stat]: Number(value ?? 0) } })} /></Form.Item>)}
          </div>
          <Divider />
          <Typography.Text type="secondary">For exact base attributes, use the advanced TOML editor.</Typography.Text>
        </Card>
      </div>
    </div>
  );
}
