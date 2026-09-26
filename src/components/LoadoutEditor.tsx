import { useMemo, useState } from 'react';
import { Button, Card, Collapse, Empty, Form, InputNumber, Popconfirm, Space, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { GEAR_FIELDS } from '../constants';
import type { ItemCatalog } from '../catalog';
import type { ItemChoice, ItemKind, Loadout } from '../types';
import { ChoiceRow } from './ChoiceRow';
import { ItemChoiceModal } from './ItemChoiceModal';

type EditState = { loadout: number; field: string; label: string; kind: ItemKind; index: number; value?: ItemChoice };

type Props = {
  gear: Loadout[];
  catalog: ItemCatalog;
  onChange: (gear: Loadout[]) => void;
};

export function LoadoutEditor({ gear, catalog, onChange }: Props) {
  const [edit, setEdit] = useState<EditState | null>(null);
  const [active, setActive] = useState<string[]>([String(Math.max(0, gear.length - 1))]);
  const mutate = (index: number, action: (loadout: Loadout) => void) => {
    const next = structuredClone(gear);
    action(next[index]);
    onChange(next);
  };
  const addLoadout = () => {
    const previous = gear.at(-1);
    const next = previous ? structuredClone(previous) : { level: 1, right: [2000000], left: [], armor: [-1, -1, -1, -1], talismans: [], spells: [] };
    next.level = previous ? Math.min(713, previous.level + 25) : 1;
    const result = [...gear, next];
    onChange(result);
    setActive([String(result.length - 1)]);
  };
  const saveChoice = (value: ItemChoice) => {
    if (!edit) return;
    mutate(edit.loadout, (loadout) => {
      const key = edit.field as keyof Loadout;
      const values = [...((loadout[key] as ItemChoice[] | undefined) ?? [])];
      if (edit.index < 0) values.push(value); else values[edit.index] = value;
      (loadout as Record<string, unknown>)[edit.field] = values;
    });
    setEdit(null);
  };
  const panels = useMemo(() => gear.map((loadout, loadoutIndex) => ({
    key: String(loadoutIndex),
    label: <Space><Typography.Text strong>Level {loadout.level}</Typography.Text><Typography.Text type="secondary">{(loadout.right?.length ?? 0) + (loadout.left?.length ?? 0)} equipped weapons</Typography.Text></Space>,
    extra: (
      <Space onClick={(event) => event.stopPropagation()}>
        <Button size="small" icon={<CopyOutlined />} onClick={() => { const next = [...gear]; next.splice(loadoutIndex + 1, 0, structuredClone(loadout)); onChange(next); }}>Duplicate</Button>
        <Popconfirm title="Remove this loadout?" onConfirm={() => onChange(gear.filter((_, index) => index !== loadoutIndex))}><Button size="small" danger icon={<DeleteOutlined />} disabled={gear.length === 1}>Remove</Button></Popconfirm>
      </Space>
    ),
    children: (
      <div className="loadout-content">
        <Form.Item label="Available from player level"><InputNumber min={0} max={713} value={loadout.level} onChange={(value) => mutate(loadoutIndex, (target) => { target.level = Number(value ?? 0); })} /></Form.Item>
        <div className="loadout-grid">
          {GEAR_FIELDS.map((field) => {
            const raw = loadout[field.key as keyof Loadout];
            const values = Array.isArray(raw) ? raw as ItemChoice[] : [];
            const shown = field.key === 'armor' ? [...values, ...Array(Math.max(0, 4 - values.length)).fill(-1)].slice(0, 4) : values;
            return (
              <Card key={field.key} size="small" className="loadout-group" title={`${field.label} · ${shown.length}`} extra={field.key !== 'armor' && (!field.limit || values.length < field.limit) ? <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setEdit({ loadout: loadoutIndex, field: field.key, label: field.label, kind: field.kind, index: -1 })}>Add</Button> : null}>
                {shown.length ? shown.map((value, itemIndex) => (
                  <ChoiceRow
                    key={itemIndex}
                    catalog={catalog}
                    kind={field.kind}
                    value={value}
                    onEdit={() => setEdit({ loadout: loadoutIndex, field: field.key, label: field.label, kind: field.kind, index: itemIndex, value })}
                    onDelete={() => mutate(loadoutIndex, (target) => {
                      const targetValues = [...(((target as Record<string, unknown>)[field.key] as ItemChoice[] | undefined) ?? [])];
                      if (field.key === 'armor') targetValues[itemIndex] = -1; else targetValues.splice(itemIndex, 1);
                      (target as Record<string, unknown>)[field.key] = targetValues;
                    })}
                  />
                )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No items" />}
              </Card>
            );
          })}
        </div>
      </div>
    ),
  })), [gear, catalog]);
  return (
    <>
      <div className="section-heading">
        <div><Typography.Title level={3}>Level loadouts</Typography.Title><Typography.Paragraph type="secondary">The highest eligible loadout is used for the player’s level.</Typography.Paragraph></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={addLoadout}>Add loadout</Button>
      </div>
      <Collapse activeKey={active} onChange={(keys) => setActive(keys as string[])} items={panels} />
      {edit && (
        <ItemChoiceModal
          open
          catalog={catalog}
          kind={edit.kind}
          value={edit.value}
          title={`${edit.index < 0 ? 'Add' : 'Edit'} ${edit.label.toLowerCase()}`}
          allowEmpty={edit.field === 'left' || edit.field === 'armor'}
          onCancel={() => setEdit(null)}
          onSave={(value) => saveChoice(value as ItemChoice)}
        />
      )}
    </>
  );
}
