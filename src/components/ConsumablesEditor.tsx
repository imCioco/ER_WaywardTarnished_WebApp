import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Divider, Empty, Form, InputNumber, Modal, Segmented, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { CONSUMABLE_USES, DEFAULT_LEVEL, DEFAULT_WEIGHT } from '../constants';
import type { ItemCatalog } from '../catalog';
import type { Consumable } from '../types';
import { ChoiceRow } from './ChoiceRow';
import { ItemSelect } from './ItemSelect';

type Mode = 'inherit' | 'never' | 'custom';

type ModalProps = { catalog: ItemCatalog; value?: Consumable; title: string; onCancel: () => void; onSave: (value: Consumable) => void };

export function consumableUse(catalog: ItemCatalog, id: number): string | undefined {
  const judge = Number(catalog.get('goods', id)?.aiUseJudgeId);
  return judge > 0 ? CONSUMABLE_USES[judge] ?? 'Other AI use' : undefined;
}

function ConsumableModal({ catalog, value, title, onCancel, onSave }: ModalProps) {
  const [id, setId] = useState<number | undefined>(value?.id);
  const [count, setCount] = useState(value?.count ?? 1);
  const [level, setLevel] = useState(value?.level ?? DEFAULT_LEVEL);
  const [weight, setWeight] = useState(value?.weight ?? DEFAULT_WEIGHT);
  const groups = useMemo(() => {
    const byUse = new Map<string, ReturnType<ItemCatalog['consumables']>>();
    for (const item of catalog.consumables()) {
      const use = consumableUse(catalog, item.id) ?? (catalog.hasAiUse ? 'Other AI use' : 'Consumables');
      byUse.set(use, [...(byUse.get(use) ?? []), item]);
    }
    const order = [...Object.values(CONSUMABLE_USES), 'Other AI use', 'Consumables'];
    return order.filter((use) => byUse.has(use)).map((use) => ({ label: use, items: byUse.get(use)! }));
  }, [catalog]);
  const limit = id === undefined ? 99 : catalog.stackLimit(id);
  const known = id !== undefined && Boolean(catalog.get('goods', id));
  const usable = id !== undefined && (!catalog.hasAiUse || consumableUse(catalog, id) !== undefined);
  useEffect(() => { if (count > limit) setCount(limit); }, [count, limit]);

  const save = () => {
    if (id === undefined) return;
    onSave({ id, ...(count !== 1 ? { count } : {}), ...(level > DEFAULT_LEVEL ? { level } : {}), ...(weight !== DEFAULT_WEIGHT ? { weight } : {}) });
  };
  return (
    <Modal open title={title} onCancel={onCancel} onOk={save} okText="Apply choice" okButtonProps={{ disabled: id === undefined }} width={720} destroyOnHidden>
      <Form layout="vertical" component="div">
        <Form.Item label="Consumable" className="choice-field" extra="Only goods the player-like AI knows how to use are listed: pots, knives, darts, stones, greases, meats and aromatics.">
          <div className="item-field">
            {catalog.size > 0 && <ItemSelect catalog={catalog} kind="goods" groups={groups} value={id} onChange={setId} />}
            <InputNumber min={0} max={2147483647} value={id} prefix="ID" onChange={(next) => setId(next === null ? undefined : Number(next))} className="item-id-input" />
          </div>
        </Form.Item>
        {catalog.size === 0 && <Alert type="info" showIcon message="Item resources are still loading; you can type a goods ID meanwhile." />}
        {catalog.size > 0 && !catalog.hasAiUse && <Alert type="warning" showIcon message="These item resources do not say which goods the AI can use, so every consumable is listed. The mod drops the ones it cannot use." />}
        {id !== undefined && catalog.size > 0 && (
          known && !usable
            ? <Alert type="error" showIcon message="The AI cannot use this item; the mod drops it from the list." />
            : <Typography.Paragraph type="secondary">{known ? `${consumableUse(catalog, id) ?? 'AI use unknown'} · stacks up to ${limit}` : 'Not in the item catalog; the mod checks it when the library loads.'}</Typography.Paragraph>
        )}
        <div className="three-column-fields">
          <Form.Item label={`Count (1–${limit})`}><InputNumber min={1} max={limit} value={count} onChange={(next) => setCount(Number(next ?? 1))} /></Form.Item>
          <Form.Item label="Available from level"><InputNumber min={1} max={713} value={level} onChange={(next) => setLevel(Number(next ?? DEFAULT_LEVEL))} /></Form.Item>
          <Form.Item label="Selection weight"><InputNumber min={0} value={weight} onChange={(next) => setWeight(Number(next ?? DEFAULT_WEIGHT))} /></Form.Item>
        </div>
        <Typography.Paragraph type="secondary">The default weight is {DEFAULT_WEIGHT}; a consumable with weight 5 is half as likely to be drawn.</Typography.Paragraph>
      </Form>
    </Modal>
  );
}

type Props = {
  catalog: ItemCatalog;
  value: Consumable[] | undefined;
  /** An entry can inherit the shared pool; the shared pool itself cannot. */
  shared?: Consumable[];
  inheritable?: boolean;
  /** Where the inherited list comes from, for the note under the switch. */
  sharedSource?: string;
  /** Labels for the three states; the shared pool cannot be emptied, only replaced. */
  labels?: { inherit: string; never?: string; custom: string };
  onChange: (value: Consumable[] | undefined) => void;
};

export function ConsumablesEditor({ catalog, value, shared, inheritable, sharedSource = 'the shared pool in Shared settings', labels, onChange }: Props) {
  const [edit, setEdit] = useState<{ index: number; value?: Consumable } | null>(null);
  const mode: Mode = value === undefined ? 'inherit' : value.length === 0 ? 'never' : 'custom';
  const list = value ?? [];
  const setMode = (next: Mode) => onChange(next === 'inherit' ? undefined : next === 'never' ? [] : (list.length ? list : structuredClone(shared ?? [])));
  const save = (choice: Consumable) => {
    if (!edit) return;
    const next = [...list];
    if (edit.index < 0) next.push(choice); else next[edit.index] = choice;
    onChange(next);
    setEdit(null);
  };
  const editable = !inheritable || mode === 'custom';
  const shown = inheritable && mode === 'inherit' ? shared ?? [] : list;

  return (
    <div className="consumables-editor">
      {inheritable && (
        <Segmented
          block
          value={mode}
          options={[
            { value: 'inherit', label: `${labels?.inherit ?? 'Use shared pool'} (${shared?.length ?? 0})` },
            ...(labels && !labels.never ? [] : [{ value: 'never', label: labels?.never ?? 'Carry none' }]),
            { value: 'custom', label: labels?.custom ?? 'Own list' },
          ]}
          onChange={(next) => setMode(next as Mode)}
        />
      )}
      {mode === 'never' && inheritable ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="This Tarnished carries no consumables beyond its template’s flask." />
      ) : (
        <>
          {inheritable && mode === 'inherit' && <Typography.Paragraph type="secondary" className="consumables-note">Drawn from {sharedSource}. Choose <strong>{labels?.custom ?? 'Own list'}</strong> to replace it.</Typography.Paragraph>}
          <div className={`consumables-list ${editable ? '' : 'inherited'}`}>
            {shown.length ? shown.map((choice, index) => (
              <ChoiceRow
                key={index}
                catalog={catalog}
                kind="goods"
                value={choice}
                detail={consumableUse(catalog, choice.id)}
                onEdit={() => editable && setEdit({ index, value: choice })}
                onDuplicate={editable ? () => { const next = [...list]; next.splice(index + 1, 0, structuredClone(choice)); onChange(next); } : undefined}
                onDelete={() => editable && onChange(list.filter((_, position) => position !== index))}
                readOnly={!editable}
              />
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No consumables yet" />}
          </div>
          {editable && <><Divider className="consumables-divider" /><Button icon={<PlusOutlined />} onClick={() => setEdit({ index: -1 })}>Add consumable</Button></>}
        </>
      )}
      {edit && <ConsumableModal catalog={catalog} value={edit.value} title={`${edit.index < 0 ? 'Add' : 'Edit'} consumable`} onCancel={() => setEdit(null)} onSave={save} />}
    </div>
  );
}
