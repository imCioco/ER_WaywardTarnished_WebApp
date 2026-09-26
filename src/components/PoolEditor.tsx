import { useState } from 'react';
import { Badge, Button, Card, Empty, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { POOL_FIELDS } from '../constants';
import type { ItemCatalog } from '../catalog';
import type { ArmorChoice, EquipmentPool, ItemChoice, ItemKind } from '../types';
import { ChoiceRow } from './ChoiceRow';
import { ItemChoiceModal } from './ItemChoiceModal';

type EditState = { field: string; label: string; kind: ItemKind; index: number; value?: ItemChoice | ArmorChoice };

type Props = {
  pool: EquipmentPool;
  catalog: ItemCatalog;
  onChange: (pool: EquipmentPool) => void;
};

export function PoolEditor({ pool, catalog, onChange }: Props) {
  const [edit, setEdit] = useState<EditState | null>(null);
  const choices = (field: string): (ItemChoice | ArmorChoice)[] => (pool[field as keyof EquipmentPool] as (ItemChoice | ArmorChoice)[] | undefined) ?? [];
  const saveChoice = (value: ItemChoice | ArmorChoice) => {
    if (!edit) return;
    const next = structuredClone(pool) as Record<string, unknown>;
    const values = [...((next[edit.field] as (ItemChoice | ArmorChoice)[] | undefined) ?? [])];
    if (edit.index < 0) values.push(value); else values[edit.index] = value;
    next[edit.field] = values;
    onChange(next as EquipmentPool);
    setEdit(null);
  };
  const remove = (field: string, index: number) => {
    const next = structuredClone(pool) as Record<string, unknown>;
    const values = [...((next[field] as unknown[] | undefined) ?? [])];
    values.splice(index, 1);
    if (values.length) next[field] = values; else delete next[field];
    onChange(next as EquipmentPool);
  };
  const duplicate = (field: string, index: number) => {
    const next = structuredClone(pool) as Record<string, unknown>;
    const values = [...((next[field] as unknown[] | undefined) ?? [])];
    values.splice(index + 1, 0, structuredClone(values[index]));
    next[field] = values;
    onChange(next as EquipmentPool);
  };
  return (
    <>
      <div className="section-heading">
        <div><Typography.Title level={3}>Random equipment pool</Typography.Title><Typography.Paragraph type="secondary">Each Tarnished randomly draws one eligible choice from these groups. Level and weight belong to individual choices.</Typography.Paragraph></div>
      </div>
      <div className="pool-grid">
        {POOL_FIELDS.map((field) => {
          const values = choices(field.key);
          return (
            <Card
              key={field.key}
              className="pool-card"
              title={<Space><span>{field.label}</span><Badge count={values.length} showZero color="#171717" /></Space>}
              extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setEdit({ field: field.key, label: field.label, kind: field.kind, index: -1 })}>Add choice</Button>}
            >
              {values.length ? values.map((value, index) => (
                <ChoiceRow
                  key={index}
                  catalog={catalog}
                  kind={field.kind}
                  value={value}
                  armorSet={field.key === 'armor'}
                  onEdit={() => setEdit({ field: field.key, label: field.label, kind: field.kind, index, value })}
                  onDuplicate={() => duplicate(field.key, index)}
                  onDelete={() => remove(field.key, index)}
                />
              )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No choices yet" />}
            </Card>
          );
        })}
      </div>
      {edit && (
        <ItemChoiceModal
          open
          catalog={catalog}
          kind={edit.kind}
          value={edit.value}
          title={`${edit.index < 0 ? 'Add' : 'Edit'} ${edit.label.toLowerCase()} choice`}
          pool
          armorSet={edit.field === 'armor'}
          allowEmpty={edit.field === 'left' || edit.field === 'catalysts'}
          catalystOnly={edit.field === 'catalysts'}
          onCancel={() => setEdit(null)}
          onSave={saveChoice}
        />
      )}
    </>
  );
}
