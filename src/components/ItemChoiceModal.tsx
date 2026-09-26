import { useEffect, useMemo, useState } from 'react';
import { Button, Divider, Form, InputNumber, Modal, Select, Space, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { AFFINITIES, ARMOR_SLOTS } from '../constants';
import type { ItemCatalog } from '../catalog';
import type { ArmorChoice, ItemChoice, ItemKind, WeightedChoice } from '../types';

type Props = {
  open: boolean;
  catalog: ItemCatalog;
  kind: ItemKind;
  value?: ItemChoice | ArmorChoice;
  pool?: boolean;
  armorSet?: boolean;
  allowEmpty?: boolean;
  catalystOnly?: boolean;
  title: string;
  onCancel: () => void;
  onSave: (value: ItemChoice | ArmorChoice) => void;
};

type ItemFieldProps = {
  catalog: ItemCatalog;
  kind: ItemKind;
  value: number;
  label: string;
  allowEmpty?: boolean;
  catalystOnly?: boolean;
  slot?: string;
  onChange: (value: number) => void;
};

function ItemField({ catalog, kind, value, label, allowEmpty, catalystOnly, slot, onChange }: ItemFieldProps) {
  const options = useMemo(() => catalog.list(kind)
    .filter((item) => !catalystOnly || item.group === 'SpellTools')
    .filter((item) => !slot || !item.slot || item.slot === slot)
    .map((item) => ({ value: item.id, label: `${item.name}  ·  ${item.id}` })), [catalog, kind, catalystOnly, slot]);
  const baseValue = kind === 'weapon' && value >= 0 ? Math.floor(value / 10000) * 10000 : value;
  return (
    <Form.Item label={label} className="choice-field">
      <Space.Compact block>
        <InputNumber
          min={allowEmpty ? -1 : 0}
          max={2147483647}
          value={value}
          onChange={(next) => onChange(Number(next ?? (allowEmpty ? -1 : 0)))}
          style={{ width: catalog.size ? '38%' : '100%' }}
        />
        {catalog.size > 0 && (
          <Select
            showSearch
            value={catalog.get(kind, baseValue) ? baseValue : undefined}
            placeholder="Choose by name"
            options={allowEmpty ? [{ value: -1, label: 'Empty slot  ·  -1' }, ...options] : options}
            optionFilterProp="label"
            onChange={(next) => onChange(next)}
            style={{ width: '62%' }}
            virtual
          />
        )}
      </Space.Compact>
      <Typography.Text type="secondary" className="field-hint">{catalog.name(kind, value)}</Typography.Text>
    </Form.Item>
  );
}

export function ItemChoiceModal(props: Props) {
  const { open, catalog, kind, pool, armorSet, allowEmpty, catalystOnly, title, onCancel, onSave } = props;
  const [id, setId] = useState(0);
  const [pieces, setPieces] = useState([-1, -1, -1, -1]);
  const [level, setLevel] = useState(0);
  const [weight, setWeight] = useState(1);
  const [ash, setAsh] = useState<number | undefined>();
  const [upgrade, setUpgrade] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (armorSet) {
      const current = props.value as ArmorChoice | undefined;
      const set = Array.isArray(current) ? current : current?.set;
      setPieces(set?.length === 4 ? [...set] : [-1, -1, -1, -1]);
      setLevel(Array.isArray(current) ? 0 : current?.level ?? 0);
      setWeight(Array.isArray(current) ? 1 : current?.weight ?? 1);
      return;
    }
    const current = props.value as ItemChoice | undefined;
    const object = typeof current === 'object' && current !== null ? current as WeightedChoice : undefined;
    const nextId = typeof current === 'number' ? current : object?.id ?? (allowEmpty ? -1 : 0);
    setId(nextId);
    setLevel(object?.level ?? 0);
    setWeight(object?.weight ?? 1);
    setAsh(object?.ash);
    setUpgrade(object?.upgrade ?? (kind === 'weapon' && nextId >= 0 ? nextId % 100 : 0));
  }, [open, props.value, armorSet, allowEmpty, kind]);

  const affinity = kind === 'weapon' && id >= 0 ? Math.floor((id % 10000) / 100) : 0;
  const setAffinity = (next: number) => setId(id < 0 ? id : Math.floor(id / 10000) * 10000 + next * 100);
  const fillSet = () => {
    const head = pieces[0];
    if (head < 0) return;
    const candidate = [head, head + 100, head + 200, head + 300];
    setPieces(candidate.map((piece, index) => catalog.get('armor', piece) || !catalog.size ? piece : (index === 0 ? head : -1)));
  };
  const save = () => {
    if (armorSet) {
      if (pool && (level > 0 || weight !== 1)) onSave({ set: pieces, ...(level > 0 ? { level } : {}), ...(weight !== 1 ? { weight } : {}) });
      else onSave(pieces);
      return;
    }
    if (id === -1) { onSave(-1); return; }
    const metadata: WeightedChoice = { id };
    if (pool && level > 0) metadata.level = level;
    if (pool && weight !== 1) metadata.weight = weight;
    if (kind === 'weapon' && ash !== undefined) metadata.ash = ash;
    if (kind === 'weapon' && upgrade > 0) metadata.upgrade = upgrade;
    onSave(Object.keys(metadata).length > 1 ? metadata : id);
  };

  return (
    <Modal open={open} title={title} onCancel={onCancel} onOk={save} okText="Apply choice" width={680} destroyOnHidden>
      {armorSet ? (
        <>
          <div className="armor-heading">
            <Typography.Text strong>Complete armor preset</Typography.Text>
            <Button icon={<CopyOutlined />} onClick={fillSet}>Fill matching set from head</Button>
          </div>
          {ARMOR_SLOTS.map((slot, index) => (
            <ItemField key={slot} catalog={catalog} kind="armor" value={pieces[index]} label={`${index + 1}. ${slot[0].toUpperCase()}${slot.slice(1)}`} allowEmpty slot={slot} onChange={(next) => setPieces((old) => old.map((value, position) => position === index ? next : value))} />
          ))}
        </>
      ) : (
        <>
          <ItemField catalog={catalog} kind={kind} value={id} label="Item" allowEmpty={allowEmpty} catalystOnly={catalystOnly} onChange={setId} />
          {kind === 'weapon' && id >= 0 && (
            <div className="two-column-fields">
              <Form.Item label="Affinity"><Select value={affinity} options={AFFINITIES.map((name, index) => ({ value: index, label: name }))} onChange={setAffinity} /></Form.Item>
              <Form.Item label="Upgrade"><InputNumber min={0} max={25} value={upgrade} onChange={(next) => setUpgrade(Number(next ?? 0))} /></Form.Item>
              <ItemField catalog={catalog} kind="ash" value={ash ?? 0} label="Ash of War (optional)" onChange={setAsh} />
            </div>
          )}
        </>
      )}
      {pool && (
        <>
          <Divider />
          <div className="two-column-fields">
            <Form.Item label="Available from level"><InputNumber min={0} max={713} value={level} onChange={(next) => setLevel(Number(next ?? 0))} /></Form.Item>
            <Form.Item label="Selection weight"><InputNumber min={0} value={weight} onChange={(next) => setWeight(Number(next ?? 1))} /></Form.Item>
          </div>
          <Typography.Paragraph type="secondary">Level 0 means always available. Higher weight makes this choice more likely than choices with lower weight.</Typography.Paragraph>
        </>
      )}
    </Modal>
  );
}
