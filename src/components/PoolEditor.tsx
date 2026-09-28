import { useState } from 'react';
import { Badge, Button, Card, Empty, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { GREAT_RUNE_IDS, GREAT_RUNE_NOTE, NO_GREAT_RUNE, POOL_FIELDS, greatRuneEffect, greatRuneHint } from '../constants';
import { choiceId } from '../library';
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
              {field.key === 'great_runes' && (
                <Typography.Paragraph type="secondary" className="slot-note-text">One is drawn for each Tarnished among those within its level, and worn from its arrival. Add “{NO_GREAT_RUNE}” to leave some without one.</Typography.Paragraph>
              )}
              {values.length ? values.map((value, index) => (
                <ChoiceRow
                  key={index}
                  catalog={catalog}
                  kind={field.kind}
                  value={value}
                  armorSet={field.key === 'armor'}
                  emptyLabel={field.key === 'great_runes' ? NO_GREAT_RUNE : undefined}
                  detail={field.key === 'great_runes' ? greatRuneEffect(choiceId(value as ItemChoice)) : undefined}
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
          allowEmpty={edit.field === 'left' || edit.field === 'catalysts' || edit.field === 'great_runes'}
          catalystOnly={edit.field === 'catalysts'}
          {...(edit.field === 'great_runes' ? { onlyIds: GREAT_RUNE_IDS, emptyLabel: NO_GREAT_RUNE, detail: greatRuneHint, poolNote: GREAT_RUNE_NOTE } : {})}
          onCancel={() => setEdit(null)}
          onSave={saveChoice}
        />
      )}
    </>
  );
}
