import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Divider, Form, InputNumber, Modal, Select, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { AFFINITIES, ARMOR_SLOTS, DEFAULT_LEVEL, DEFAULT_WEIGHT } from '../constants';
import type { ItemCatalog } from '../catalog';
import type { ArmorChoice, ItemChoice, ItemKind, WeightedChoice } from '../types';
import { ItemSelect } from './ItemSelect';

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
  const groups = useMemo(() => [{
    label,
    items: catalog.list(kind)
      .filter((item) => !catalystOnly || item.group === 'SpellTools')
      .filter((item) => !slot || !item.slot || item.slot === slot),
  }], [catalog, kind, catalystOnly, slot, label]);
  const baseValue = kind === 'weapon' && value >= 0 ? Math.floor(value / 10000) * 10000 : value;
  return (
    <Form.Item label={label} className="choice-field">
      <div className="item-field">
        {catalog.size > 0 && <ItemSelect catalog={catalog} kind={kind} groups={groups} value={baseValue} emptyLabel={allowEmpty ? 'Empty slot' : undefined} onChange={(next) => onChange(next ?? (allowEmpty ? -1 : 0))} />}
        <InputNumber min={allowEmpty ? -1 : 0} max={2147483647} value={value} prefix="ID" onChange={(next) => onChange(Number(next ?? (allowEmpty ? -1 : 0)))} className="item-id-input" />
      </div>
      <Typography.Text type="secondary" className="field-hint">{catalog.name(kind, value)}</Typography.Text>
    </Form.Item>
  );
}

type AshFieldProps = { catalog: ItemCatalog; weapon: number; affinity: number; value?: number; onChange: (value: number | undefined) => void };

function AshField({ catalog, weapon, affinity, value, onChange }: AshFieldProps) {
  const { mountable, compatible, other } = useMemo(() => catalog.ashesFor(weapon, affinity), [catalog, weapon, affinity]);
  const groups = useMemo(() => [
    { label: 'Fits this weapon', items: compatible },
    { label: compatible.length ? 'Other Ashes of War (do not fit this weapon or affinity)' : 'Ashes of War', items: other },
  ], [compatible, other]);
  const fits = value === undefined || compatible.some((ash) => ash.id === value);
  if (!mountable && value === undefined) {
    return <Form.Item label="Ash of War"><Alert type="info" showIcon message="This weapon keeps its unique skill and does not accept Ashes of War." /></Form.Item>;
  }
  return (
    <Form.Item label="Ash of War" className="choice-field" extra="Leave empty to keep the weapon’s own skill.">
      <div className="item-field">
        {catalog.size > 0 && <ItemSelect catalog={catalog} kind="ash" groups={groups} value={value} allowClear placeholder="Weapon’s own skill" onChange={onChange} />}
        <InputNumber min={0} max={2147483647} value={value} prefix="ID" placeholder="none" onChange={(next) => onChange(next === null ? undefined : Number(next))} className="item-id-input" />
      </div>
      {!mountable && <Alert type="warning" showIcon message="This weapon does not accept Ashes of War; the mod will skip this one." />}
      {mountable && !fits && catalog.size > 0 && <Alert type="warning" showIcon message="This Ash of War does not fit the weapon type or affinity." />}
    </Form.Item>
  );
}

export function ItemChoiceModal(props: Props) {
  const { open, catalog, kind, pool, armorSet, allowEmpty, catalystOnly, title, onCancel, onSave } = props;
  const [id, setId] = useState(0);
  const [pieces, setPieces] = useState([-1, -1, -1, -1]);
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [weight, setWeight] = useState(DEFAULT_WEIGHT);
  const [ash, setAsh] = useState<number | undefined>();
  const [upgrade, setUpgrade] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (armorSet) {
      const current = props.value as ArmorChoice | undefined;
      const set = Array.isArray(current) ? current : current?.set;
      setPieces(set?.length === 4 ? [...set] : [-1, -1, -1, -1]);
      setLevel(Array.isArray(current) ? DEFAULT_LEVEL : current?.level ?? DEFAULT_LEVEL);
      setWeight(Array.isArray(current) ? DEFAULT_WEIGHT : current?.weight ?? DEFAULT_WEIGHT);
      return;
    }
    const current = props.value as ItemChoice | undefined;
    const object = typeof current === 'object' && current !== null ? current as WeightedChoice : undefined;
    const nextId = typeof current === 'number' ? current : object?.id ?? (allowEmpty ? -1 : 0);
    setId(nextId);
    setLevel(object?.level ?? DEFAULT_LEVEL);
    setWeight(object?.weight ?? DEFAULT_WEIGHT);
    setAsh(object?.ash);
    setUpgrade(object?.upgrade ?? (kind === 'weapon' && nextId >= 0 ? nextId % 100 : 0));
  }, [open, props.value, armorSet, allowEmpty, kind]);

  const affinity = kind === 'weapon' && id >= 0 ? Math.floor((id % 10000) / 100) : 0;
  const setAffinity = (next: number) => setId(id < 0 ? id : Math.floor(id / 10000) * 10000 + next * 100);
  const affinityOptions = kind === 'weapon' && id >= 0 ? catalog.affinities(id) : [];
  const maxUpgrade = kind === 'weapon' && id >= 0 ? catalog.maxUpgrade(id) : 25;
  const fillSet = () => {
    const head = pieces[0];
    if (head < 0) return;
    const candidate = [head, head + 100, head + 200, head + 300];
    setPieces(candidate.map((piece, index) => catalog.get('armor', piece) || !catalog.size ? piece : (index === 0 ? head : -1)));
  };
  const poolMetadata = () => ({ ...(level > DEFAULT_LEVEL ? { level } : {}), ...(weight !== DEFAULT_WEIGHT ? { weight } : {}) });
  const save = () => {
    if (armorSet) {
      const metadata = pool ? poolMetadata() : {};
      onSave(Object.keys(metadata).length ? { set: pieces, ...metadata } : pieces);
      return;
    }
    if (id === -1 && !(pool && weight !== DEFAULT_WEIGHT)) { onSave(-1); return; }
    const metadata: WeightedChoice = { id, ...(pool ? poolMetadata() : {}) };
    if (kind === 'weapon' && id >= 0 && ash !== undefined) metadata.ash = ash;
    if (kind === 'weapon' && id >= 0 && upgrade > 0) metadata.upgrade = Math.min(upgrade, maxUpgrade);
    onSave(Object.keys(metadata).length > 1 ? metadata : id);
  };

  return (
    <Modal open={open} title={title} onCancel={onCancel} onOk={save} okText="Apply choice" width={720} destroyOnHidden>
      <Form layout="vertical" component="div">
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
              <>
                <div className="two-column-fields">
                  <Form.Item label="Affinity">
                    <Select value={affinity} options={AFFINITIES.map((name, index) => ({ value: index, label: name, disabled: !affinityOptions.includes(index) && index !== affinity }))} onChange={setAffinity} />
                  </Form.Item>
                  <Form.Item label={`Upgrade (0–${maxUpgrade})`}>
                    <InputNumber min={0} max={maxUpgrade} value={upgrade} onChange={(next) => setUpgrade(Number(next ?? 0))} />
                  </Form.Item>
                </div>
                <AshField catalog={catalog} weapon={id} affinity={affinity} value={ash} onChange={setAsh} />
              </>
            )}
          </>
        )}
        {pool && (
          <>
            <Divider />
            <div className="two-column-fields">
              <Form.Item label="Available from level"><InputNumber min={1} max={713} value={level} onChange={(next) => setLevel(Number(next ?? DEFAULT_LEVEL))} /></Form.Item>
              <Form.Item label="Selection weight"><InputNumber min={0} value={weight} onChange={(next) => setWeight(Number(next ?? DEFAULT_WEIGHT))} /></Form.Item>
            </div>
            <Typography.Paragraph type="secondary">Level 1 means always available. The default weight is {DEFAULT_WEIGHT}; a choice with weight 20 is twice as likely as one with 10.</Typography.Paragraph>
          </>
        )}
      </Form>
    </Modal>
  );
}
