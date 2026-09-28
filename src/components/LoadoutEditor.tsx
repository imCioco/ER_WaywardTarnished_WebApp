import { useMemo, useState } from 'react';
import { Button, Card, Collapse, Empty, Form, InputNumber, Popconfirm, Segmented, Space, Tag, Tooltip, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { ARMOR_SLOTS, DEFAULT_WEIGHT, GEAR_FIELDS, GREAT_RUNE_IDS, GREAT_RUNE_NOTE, NO_GREAT_RUNE, greatRuneEffect, greatRuneHint } from '../constants';
import type { CatalogItem, ItemCatalog } from '../catalog';
import { choiceId, pickOptions } from '../library';
import type { ArmorChoice, ItemChoice, ItemKind, Loadout, Pick } from '../types';
import { ChoiceRow } from './ChoiceRow';
import { ItemChoiceModal } from './ItemChoiceModal';
import { ItemSelect } from './ItemSelect';

type SlotField = 'right' | 'left' | 'armor' | 'talismans' | 'spells' | 'great_rune';

/** What is being edited: an option of a slot, a new slot (slot -1) or a new option (option -1); or an armor set. */
type EditState =
  | { loadout: number; field: SlotField; slot: number; option: number; value?: ItemChoice }
  | { loadout: number; field: 'armor_sets'; slot: number; value?: ArmorChoice };

type Props = {
  gear: Loadout[];
  catalog: ItemCatalog;
  onChange: (gear: Loadout[]) => void;
};

const SLOT_LABELS: Record<SlotField, { label: string; kind: ItemKind; limit: number }> = {
  right: { label: 'Right hand', kind: 'weapon', limit: 3 },
  left: { label: 'Left hand', kind: 'weapon', limit: 3 },
  armor: { label: 'Armor', kind: 'armor', limit: 4 },
  talismans: { label: 'Talismans', kind: 'talisman', limit: 4 },
  spells: { label: 'Spells', kind: 'spell', limit: 7 },
  great_rune: { label: 'Great Rune', kind: 'goods', limit: 1 },
};

function toPick(options: ItemChoice[]): Pick {
  return options.length === 1 ? options[0] : options;
}

/** A field's slots; the great rune is a single slot, shown as a list of at most one. */
function slotsOf(loadout: Loadout, field: SlotField): Pick[] {
  if (field === 'great_rune') return loadout.great_rune === undefined ? [] : [loadout.great_rune];
  return (loadout[field] as Pick[] | undefined) ?? [];
}

/** Per-piece armor always shows head, chest, arms and legs. */
function armorPieces(loadout: Loadout): Pick[] {
  const pieces = slotsOf(loadout, 'armor');
  return [0, 1, 2, 3].map((index) => pieces[index] ?? -1);
}

function firstId(pick: Pick | undefined): number {
  const option = pick === undefined ? -1 : pickOptions(pick)[0];
  return option === undefined ? -1 : typeof option === 'number' ? option : option.id;
}

function AmmoField({ catalog, label, ranges, value, onChange }: { catalog: ItemCatalog; label: string; ranges: number[]; value?: [number, number]; onChange: (value?: [number, number]) => void }) {
  const items = useMemo(() => catalog.list('weapon', 'Ammo').filter((item: CatalogItem) => ranges.includes(Math.floor(item.id / 1000000))), [catalog, ranges]);
  return (
    <Form.Item label={label} className="ammo-field">
      <div className="item-field">
        <ItemSelect catalog={catalog} kind="weapon" groups={[{ label, items }]} value={value?.[0]} allowClear placeholder="None" onChange={(id) => onChange(id === undefined ? undefined : [id, value?.[1] ?? 30])} />
        <InputNumber min={1} max={99} value={value?.[1]} disabled={!value} prefix="×" onChange={(count) => value && onChange([value[0], Number(count ?? 1)])} className="item-id-input" />
      </div>
    </Form.Item>
  );
}

export function LoadoutEditor({ gear, catalog, onChange }: Props) {
  const [edit, setEdit] = useState<EditState | null>(null);
  const [active, setActive] = useState<string[]>([String(Math.max(0, gear.length - 1))]);
  const mutate = (index: number, action: (loadout: Loadout) => void) => {
    const next = structuredClone(gear);
    action(next[index]);
    onChange(next);
  };
  const setSlots = (loadout: Loadout, field: SlotField, slots: Pick[]) => {
    if (field === 'great_rune') {
      if (slots.length) loadout.great_rune = slots[0]; else delete loadout.great_rune;
      return;
    }
    if (slots.length) (loadout as Record<string, unknown>)[field] = slots; else delete loadout[field];
  };
  const addLoadout = () => {
    const previous = gear.at(-1);
    const next: Loadout = previous ? structuredClone(previous) : { level: 1, right: [2000000], armor: [-1, -1, -1, -1] };
    next.level = previous ? Math.min(713, previous.level + 25) : 1;
    delete next.weight;
    const result = [...gear, next];
    onChange(result);
    setActive([String(result.length - 1)]);
  };
  const saveChoice = (value: ItemChoice | ArmorChoice) => {
    if (!edit) return;
    mutate(edit.loadout, (loadout) => {
      if (edit.field === 'armor_sets') {
        const sets = [...(loadout.armor_sets ?? [])];
        if (edit.slot < 0) sets.push(value as ArmorChoice); else sets[edit.slot] = value as ArmorChoice;
        loadout.armor_sets = sets;
        return;
      }
      const slots = edit.field === 'armor' ? armorPieces(loadout) : [...slotsOf(loadout, edit.field)];
      if (edit.slot < 0) slots.push(value as ItemChoice);
      else {
        const options = [...pickOptions(slots[edit.slot])];
        if (edit.option < 0) options.push(value as ItemChoice); else options[edit.option] = value as ItemChoice;
        slots[edit.slot] = toPick(options);
      }
      setSlots(loadout, edit.field, slots);
    });
    setEdit(null);
  };
  const removeOption = (loadoutIndex: number, field: SlotField, slot: number, option: number) => mutate(loadoutIndex, (loadout) => {
    const slots = field === 'armor' ? armorPieces(loadout) : [...slotsOf(loadout, field)];
    const options = pickOptions(slots[slot]).filter((_, index) => index !== option);
    if (options.length) slots[slot] = toPick(options);
    else if (field === 'armor') slots[slot] = -1;
    else slots.splice(slot, 1);
    setSlots(loadout, field, slots);
  });
  const setArmorMode = (loadoutIndex: number, mode: 'pieces' | 'sets') => mutate(loadoutIndex, (loadout) => {
    if (mode === 'sets') {
      const set = armorPieces(loadout).map(firstId);
      delete loadout.armor;
      loadout.armor_sets = loadout.armor_sets?.length ? loadout.armor_sets : [set];
    } else {
      const first = loadout.armor_sets?.[0];
      const set = first ? (Array.isArray(first) ? first : first.set) : [-1, -1, -1, -1];
      delete loadout.armor_sets;
      loadout.armor = [...set];
    }
  });

  const levelCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const loadout of gear) counts.set(loadout.level, (counts.get(loadout.level) ?? 0) + 1);
    return counts;
  }, [gear]);

  const renderSlots = (loadout: Loadout, loadoutIndex: number, field: SlotField) => {
    const { label, kind, limit } = SLOT_LABELS[field];
    const slots = field === 'armor' ? armorPieces(loadout) : slotsOf(loadout, field);
    const canAdd = field !== 'armor' && slots.length < limit;
    return (
      <div className="slot-list">
        {slots.length ? slots.map((pick, slotIndex) => {
          const options = pickOptions(pick);
          const slotName = field === 'armor' ? `${ARMOR_SLOTS[slotIndex][0].toUpperCase()}${ARMOR_SLOTS[slotIndex].slice(1)}` : field === 'great_rune' ? 'Slot' : `Slot ${slotIndex + 1}${(field === 'right' || field === 'left') && slotIndex === 0 ? ' · held' : ''}`;
          return (
            <div key={slotIndex} className={`slot-block ${options.length > 1 ? 'has-options' : ''}`}>
              <div className="slot-block-head">
                <span className="slot-block-title">
                  <strong>{slotName}</strong>
                  {options.length > 1 && (
                    <Tooltip title="Each Tarnished from this entry gets only one of these options, drawn by weight among those it can use at its level. The others are not equipped.">
                      <Typography.Text className="options-note"><SwapOutlined /> Random pick: only 1 of these {options.length} is equipped</Typography.Text>
                    </Tooltip>
                  )}
                </span>
                <Space size={0}>
                  <Tooltip title="Add another option for this slot; one is picked for each Tarnished">
                    <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setEdit({ loadout: loadoutIndex, field, slot: slotIndex, option: -1 })}>Option</Button>
                  </Tooltip>
                  {field !== 'armor' && (
                    <Popconfirm title="Remove this slot and its options?" onConfirm={() => mutate(loadoutIndex, (target) => setSlots(target, field, slotsOf(target, field).filter((_, index) => index !== slotIndex)))}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Remove slot" />
                    </Popconfirm>
                  )}
                </Space>
              </div>
              {options.map((option, optionIndex) => (
                <ChoiceRow
                  key={optionIndex}
                  catalog={catalog}
                  kind={kind}
                  value={option}
                  emptyLabel={field === 'great_rune' ? NO_GREAT_RUNE : undefined}
                  detail={field === 'great_rune' ? greatRuneEffect(choiceId(option)) : undefined}
                  onEdit={() => setEdit({ loadout: loadoutIndex, field, slot: slotIndex, option: optionIndex, value: option })}
                  onDelete={() => removeOption(loadoutIndex, field, slotIndex, optionIndex)}
                />
              ))}
            </div>
          );
        }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={field === 'great_rune' ? NO_GREAT_RUNE : `No ${label.toLowerCase()}`} />}
        {canAdd && <Button block type="dashed" icon={<PlusOutlined />} onClick={() => setEdit({ loadout: loadoutIndex, field, slot: -1, option: -1 })}>{field === 'great_rune' ? 'Add a great rune' : `Add ${field === 'right' || field === 'left' ? 'weapon' : field === 'talismans' ? 'talisman' : 'spell'} slot`}</Button>}
      </div>
    );
  };

  const panels = gear.map((loadout, loadoutIndex) => {
    const variants = levelCounts.get(loadout.level) ?? 1;
    const variantNumber = gear.slice(0, loadoutIndex + 1).filter((other) => other.level === loadout.level).length;
    const armorMode = loadout.armor_sets?.length ? 'sets' : 'pieces';
    const optionSlots = GEAR_FIELDS.reduce((count, field) => count + slotsOf(loadout, field.key as SlotField).filter((pick) => pickOptions(pick).length > 1).length, 0);
    return {
      key: String(loadoutIndex),
      label: (
        <Space wrap>
          <Typography.Text strong>Level {loadout.level}</Typography.Text>
          {variants > 1 && <Tag color="purple">Variant {variantNumber} of {variants} · weight {loadout.weight ?? DEFAULT_WEIGHT}</Tag>}
          <Typography.Text type="secondary">{slotsOf(loadout, 'right').length + slotsOf(loadout, 'left').length} weapon slots{optionSlots ? ` · ${optionSlots} with options` : ''}{armorMode === 'sets' ? ` · ${loadout.armor_sets!.length} armor set${loadout.armor_sets!.length === 1 ? '' : 's'}` : ''}</Typography.Text>
        </Space>
      ),
      extra: (
        <Space onClick={(event) => event.stopPropagation()}>
          <Tooltip title="Adds a copy at the same level: one of the variants is picked by weight">
            <Button size="small" icon={<CopyOutlined />} onClick={() => { const next = [...gear]; next.splice(loadoutIndex + 1, 0, structuredClone(loadout)); onChange(next); setActive([String(loadoutIndex + 1)]); }}>Add variant</Button>
          </Tooltip>
          <Popconfirm title="Remove this loadout?" onConfirm={() => onChange(gear.filter((_, index) => index !== loadoutIndex))}><Button size="small" danger icon={<DeleteOutlined />} disabled={gear.length === 1}>Remove</Button></Popconfirm>
        </Space>
      ),
      children: (
        <div className="loadout-content">
          <Form layout="vertical" component="div" className="loadout-settings">
            <Form.Item label="Available from level" help="Used from this level on, if the Tarnished can meet its requirements.">
              <InputNumber min={0} max={713} value={loadout.level} onChange={(value) => mutate(loadoutIndex, (target) => { target.level = Number(value ?? 0); })} />
            </Form.Item>
            <Form.Item label="Variant weight" help={variants > 1 ? `Chance among the ${variants} loadouts at level ${loadout.level}.` : 'Only matters when several loadouts share this level.'}>
              <InputNumber min={0} value={loadout.weight} placeholder={String(DEFAULT_WEIGHT)} onChange={(value) => mutate(loadoutIndex, (target) => { if (value === null || value === DEFAULT_WEIGHT) delete target.weight; else target.weight = Number(value); })} />
            </Form.Item>
          </Form>
          <div className="loadout-grid">
            {(['right', 'left'] as const).map((field) => (
              <Card key={field} size="small" className="loadout-group" title={`${SLOT_LABELS[field].label} · ${slotsOf(loadout, field).length}/${SLOT_LABELS[field].limit}`}>{renderSlots(loadout, loadoutIndex, field)}</Card>
            ))}
            <Card
              size="small"
              className="loadout-group span-2"
              title="Armor"
              extra={<Segmented size="small" value={armorMode} onChange={(mode) => setArmorMode(loadoutIndex, mode as 'pieces' | 'sets')} options={[{ value: 'pieces', label: 'Per piece' }, { value: 'sets', label: 'Whole sets' }]} />}
            >
              {armorMode === 'pieces' ? (
                <>
                  <Typography.Paragraph type="secondary" className="slot-note-text">Each piece can have options. Use <strong>Whole sets</strong> to keep pieces matching.</Typography.Paragraph>
                  <div className="armor-piece-grid">{renderSlots(loadout, loadoutIndex, 'armor')}</div>
                </>
              ) : (
                <div className="slot-list">
                  <Typography.Paragraph type="secondary" className="slot-note-text">One whole set is picked for each Tarnished, by weight, so its pieces always match.</Typography.Paragraph>
                  {(loadout.armor_sets ?? []).map((set, setIndex) => (
                    <ChoiceRow
                      key={setIndex}
                      catalog={catalog}
                      kind="armor"
                      value={set}
                      armorSet
                      onEdit={() => setEdit({ loadout: loadoutIndex, field: 'armor_sets', slot: setIndex, value: set })}
                      onDuplicate={() => mutate(loadoutIndex, (target) => { target.armor_sets!.splice(setIndex + 1, 0, structuredClone(set)); })}
                      onDelete={() => mutate(loadoutIndex, (target) => { target.armor_sets = target.armor_sets!.filter((_, index) => index !== setIndex); if (!target.armor_sets.length) { delete target.armor_sets; target.armor = [-1, -1, -1, -1]; } })}
                    />
                  ))}
                  <Button block type="dashed" icon={<PlusOutlined />} onClick={() => setEdit({ loadout: loadoutIndex, field: 'armor_sets', slot: -1 })}>Add armor set</Button>
                </div>
              )}
            </Card>
            {(['talismans', 'spells'] as const).map((field) => (
              <Card key={field} size="small" className="loadout-group" title={`${SLOT_LABELS[field].label} · ${slotsOf(loadout, field).length}/${SLOT_LABELS[field].limit}`}>{renderSlots(loadout, loadoutIndex, field)}</Card>
            ))}
            <Card size="small" className="loadout-group" title="Great Rune">
              <Typography.Paragraph type="secondary" className="slot-note-text">Worn from its arrival, as after a Rune Arc. An option never comes before its level; add “{NO_GREAT_RUNE}” to leave some without one.</Typography.Paragraph>
              {renderSlots(loadout, loadoutIndex, 'great_rune')}
            </Card>
            <Card size="small" className="loadout-group" title="Ammunition">
              <Form layout="vertical" component="div">
                <AmmoField catalog={catalog} label="Arrows" ranges={[50, 51]} value={loadout.arrows} onChange={(arrows) => mutate(loadoutIndex, (target) => { if (arrows) target.arrows = arrows; else delete target.arrows; })} />
                <AmmoField catalog={catalog} label="Bolts" ranges={[52, 53]} value={loadout.bolts} onChange={(bolts) => mutate(loadoutIndex, (target) => { if (bolts) target.bolts = bolts; else delete target.bolts; })} />
              </Form>
            </Card>
          </div>
        </div>
      ),
    };
  });

  const editing = edit && edit.field !== 'armor_sets' ? SLOT_LABELS[edit.field] : undefined;
  const optionEdit = edit && edit.field !== 'armor_sets' ? edit : undefined;
  const target = optionEdit ? gear[optionEdit.loadout] : undefined;
  const optionCount = optionEdit && target && optionEdit.slot >= 0 ? pickOptions((optionEdit.field === 'armor' ? armorPieces(target) : slotsOf(target, optionEdit.field))[optionEdit.slot]).length : 0;
  // Weight and level matter once a slot has several options; a great rune's level always does.
  const greatRune = optionEdit?.field === 'great_rune';
  const weighted = greatRune || Boolean(optionEdit && optionEdit.slot >= 0 && (optionEdit.option < 0 || optionCount > 1));

  return (
    <>
      <div className="section-heading">
        <div>
          <Typography.Title level={3}>Level loadouts</Typography.Title>
          <Typography.Paragraph type="secondary">A Tarnished uses the highest loadout at or below its level that it can meet the requirements of. Every slot holds one item or a list of <strong>options</strong>, one of which is picked for each Tarnished, so several from one entry rarely look alike. Loadouts that share a level are <strong>variants</strong>: one is picked by weight.</Typography.Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={addLoadout}>Add loadout</Button>
      </div>
      <Collapse activeKey={active} onChange={(keys) => setActive(keys as string[])} items={panels} />
      {edit?.field === 'armor_sets' && (
        <ItemChoiceModal open catalog={catalog} kind="armor" value={edit.value} title={`${edit.slot < 0 ? 'Add' : 'Edit'} armor set`} pool armorSet onCancel={() => setEdit(null)} onSave={saveChoice} />
      )}
      {optionEdit && editing && (
        <ItemChoiceModal
          open
          catalog={catalog}
          kind={editing.kind}
          value={optionEdit.value}
          title={optionEdit.slot < 0 ? `Add ${editing.label.toLowerCase()} slot` : optionEdit.option < 0 ? `Add an option · ${editing.label}` : `Edit ${editing.label.toLowerCase()}`}
          pool={weighted}
          allowEmpty={optionEdit.field === 'left' || optionEdit.field === 'armor' || greatRune}
          armorSlot={optionEdit.field === 'armor' ? ARMOR_SLOTS[optionEdit.slot] : undefined}
          {...(greatRune ? { onlyIds: GREAT_RUNE_IDS, emptyLabel: NO_GREAT_RUNE, detail: greatRuneHint, poolNote: GREAT_RUNE_NOTE } : {})}
          onCancel={() => setEdit(null)}
          onSave={(value) => saveChoice(value as ItemChoice)}
        />
      )}
    </>
  );
}
