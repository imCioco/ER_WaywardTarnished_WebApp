import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Collapse, Form, Input, InputNumber, Modal, Select, Space, Switch, Typography } from 'antd';
import { ODDS_GROUPS, ODDS_LIMIT, PERSONALITY_SLOTS, actionLabel } from '../constants';
import type { Archetype } from '../library';
import type { Personality } from '../types';

export type PersonalityDraft = { name: string; description: string; personality: Personality };

type Props = {
  title: string;
  initial: PersonalityDraft;
  /** The name it is saved under now; undefined for a new personality or a copy of an inherited one. */
  original?: string;
  archetypes: Archetype[];
  /** Personalities of this file by slot effect, and of base.toml. */
  documentSlots: Map<number, string>;
  baseSlots: Map<number, string>;
  onCancel: () => void;
  onSave: (draft: PersonalityDraft) => void;
};

const NAME = /^[A-Za-z0-9_-]+$/;

export function PersonalityModal({ title, initial, original, archetypes, documentSlots, baseSlots, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [effect, setEffect] = useState(initial.personality.effect);
  const [suppress, setSuppress] = useState<number[]>(initial.personality.suppress ?? []);
  const [odds, setOdds] = useState<Record<string, number>>({ ...initial.personality.odds });
  const [changedOnly, setChangedOnly] = useState(Object.keys(initial.personality.odds).length > 0);
  const [open, setOpen] = useState<string[]>(() => ODDS_GROUPS.filter((group) => group.actions.some((action) => initial.personality.odds[action] !== undefined)).map((group) => group.label).slice(0, 3));

  const clash = archetypes.find((archetype) => archetype.name === name && archetype.name !== original && !archetype.inherited);
  const overridesBase = archetypes.find((archetype) => archetype.name === name && archetype.inherited);
  const nameError = !name ? 'Give the personality a name.' : !NAME.test(name) ? 'Use only letters, digits, - and _.' : clash ? `“${name}” is already a ${clash.kind === 'style' ? 'style' : 'personality'} in this library.` : undefined;
  const occupant = documentSlots.get(effect);
  const displaced = occupant && occupant !== original && occupant !== name ? occupant : undefined;
  const baseOccupant = baseSlots.get(effect);
  const baseRival = baseOccupant && baseOccupant !== name && !documentSlots.has(effect) ? baseOccupant : undefined;
  const changed = Object.keys(odds).length;
  const sources = archetypes.filter((archetype) => archetype.personality && archetype.name !== original);

  const setOdd = (action: string, value: number | null) => setOdds((current) => {
    const next = { ...current };
    if (value === null || Number.isNaN(value)) delete next[action]; else next[action] = Math.max(-ODDS_LIMIT, Math.min(ODDS_LIMIT, Math.round(value)));
    return next;
  });
  const groups = useMemo(() => ODDS_GROUPS.filter((group) => !changedOnly || group.actions.some((action) => odds[action] !== undefined)).map((group) => {
    const actions = changedOnly ? group.actions.filter((action) => odds[action] !== undefined) : group.actions;
    const count = group.actions.filter((action) => odds[action] !== undefined).length;
    return {
      key: group.label,
      label: <Space><strong>{group.label}</strong><Typography.Text type="secondary">{group.hint}</Typography.Text></Space>,
      extra: count ? <Badge count={count} color="#1d39c4" /> : null,
      children: actions.length ? (
        <div className="odds-grid">
          {actions.map((action) => {
            const value = odds[action];
            return (
              <div key={action} className={`odds-row ${value === undefined ? '' : value < 0 ? 'lowered' : 'raised'}`}>
                <span title={action}>{actionLabel(action)}</span>
                <InputNumber size="small" min={-ODDS_LIMIT} max={ODDS_LIMIT} step={10} value={value} placeholder="0" onChange={(next) => setOdd(action, next)} />
                <Space size={2}>
                  <Button size="small" type={value === -ODDS_LIMIT ? 'primary' : 'text'} onClick={() => setOdd(action, value === -ODDS_LIMIT ? null : -ODDS_LIMIT)} title="Rule this action out (-9999)">Never</Button>
                  <Button size="small" type={value === ODDS_LIMIT ? 'primary' : 'text'} onClick={() => setOdd(action, value === ODDS_LIMIT ? null : ODDS_LIMIT)} title="Force this action when possible (9999)">Always</Button>
                </Space>
              </div>
            );
          })}
        </div>
      ) : null,
    };
  }), [odds, changedOnly]);

  const save = () => {
    if (nameError) return;
    const slot = PERSONALITY_SLOTS.find((candidate) => candidate.effect === effect)!;
    onSave({ name, description: description.trim(), personality: { effect: slot.effect, row: slot.row, ...(suppress.length ? { suppress } : {}), odds } });
  };

  return (
    <Modal open title={title} onCancel={onCancel} onOk={save} okText="Save personality" okButtonProps={{ disabled: Boolean(nameError) }} width="min(1040px, 96vw)" destroyOnHidden className="personality-modal">
      <Form layout="vertical" component="div">
        <div className="two-column-fields">
          <Form.Item label="Name" required validateStatus={nameError && name ? 'error' : undefined} help={nameError ?? (overridesBase && !original ? `Replaces base.toml’s “${name}” wherever this file is installed beside it.` : 'Used in each Tarnished’s styles list.')}>
            <Input value={name} onChange={(event) => setName(event.target.value.trim())} placeholder="counter-puncher" />
          </Form.Item>
          <Form.Item label="Personality slot" help="The mod has five slots. Each personality needs its own.">
            <Select
              value={effect}
              onChange={setEffect}
              options={PERSONALITY_SLOTS.map((slot, index) => {
                const owner = documentSlots.get(slot.effect) ?? baseSlots.get(slot.effect);
                return { value: slot.effect, label: `Slot ${index + 1} · SpEffect ${slot.effect} → row ${slot.row}${owner && owner !== original ? ` · used by ${owner}` : ' · free'}` };
              })}
            />
          </Form.Item>
        </div>
        {displaced && <Alert type="warning" showIcon message={`Saving replaces “${displaced}” in this library.`} description={`That personality is removed, and Tarnished that use it switch to “${name || 'this personality'}”.`} />}
        {baseRival && <Alert type="info" showIcon message={`base.toml’s “${baseRival}” uses this slot.`} description={`Installed beside base.toml, the mod keeps whichever name comes first alphabetically and drops the other. Name this personality “${baseRival}” to replace it reliably.`} />}
        <Form.Item label="Description" help="Shown when you hover over this personality. Saved as a comment above it in the TOML file.">
          <Input.TextArea value={description} onChange={(event) => setDescription(event.target.value)} autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Waits for your attack, then punishes it with a quick counter." />
        </Form.Item>
        <Form.Item label="Suppressed SpEffects (optional)" help="Removed from the Tarnished while it lives, for example a skill’s buff that stops the AI from using the skill again (Seppuku: 1755).">
          <Select mode="tags" value={suppress.map(String)} onChange={(values: string[]) => setSuppress(values.map(Number).filter((value) => Number.isInteger(value) && value >= 0))} tokenSeparators={[',', ' ']} placeholder="Type an SpEffect ID and press Enter" />
        </Form.Item>
      </Form>
      <div className="odds-toolbar">
        <div>
          <Typography.Title level={5}>Action odds · {changed} changed</Typography.Title>
          <Typography.Text type="secondary">Added to the game’s situational odds, which are mostly 10–100. -9999 rules an action out, 9999 forces it. The AI only uses actions its gear allows.</Typography.Text>
        </div>
        <Space wrap>
          <Select
            placeholder="Copy odds from…"
            value={null}
            style={{ width: 200 }}
            options={sources.map((source) => ({ value: source.name, label: source.name }))}
            onChange={(source: string) => { setOdds({ ...(archetypes.find((archetype) => archetype.name === source)?.personality?.odds ?? {}) }); setChangedOnly(true); }}
          />
          <Space size={6}><Switch size="small" checked={changedOnly} onChange={setChangedOnly} /><Typography.Text>Only changed actions</Typography.Text></Space>
          <Button onClick={() => setOdds({})} disabled={!changed}>Clear all</Button>
        </Space>
      </div>
      {changedOnly && !changed
        ? <Alert type="info" showIcon message="No actions changed yet." description="Turn off “Only changed actions” to browse every action, or copy the odds of an existing personality as a starting point." />
        : <Collapse activeKey={changedOnly ? groups.map((group) => group.key) : open} onChange={(keys) => setOpen(keys as string[])} items={groups} className="odds-collapse" />}
    </Modal>
  );
}

type StyleDraft = { name: string; description: string; effect: number };

type StyleProps = { title: string; initial: StyleDraft; original?: string; archetypes: Archetype[]; onCancel: () => void; onSave: (draft: StyleDraft) => void };

/** A vanilla NPC personality: an SpEffect that makes battle goal 29999 add its personality row. */
export function StyleModal({ title, initial, original, archetypes, onCancel, onSave }: StyleProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [effect, setEffect] = useState<number | null>(initial.effect || null);
  const clash = archetypes.find((archetype) => archetype.name === name && archetype.name !== original && !archetype.inherited);
  const nameError = !name ? 'Give the style a name.' : !NAME.test(name) ? 'Use only letters, digits, - and _.' : clash ? `“${name}” is already used in this library.` : undefined;
  return (
    <Modal open title={title} onCancel={onCancel} onOk={() => !nameError && effect !== null && onSave({ name, description: description.trim(), effect })} okText="Save style" okButtonProps={{ disabled: Boolean(nameError) || effect === null }} width={640} destroyOnHidden>
      <Form layout="vertical" component="div">
        <Form.Item label="Name" required validateStatus={nameError && name ? 'error' : undefined} help={nameError}>
          <Input value={name} onChange={(event) => setName(event.target.value.trim())} placeholder="patient" />
        </Form.Item>
        <Form.Item label="Personality SpEffect" required help="A vanilla NPC invader’s personality SpEffect, such as 18659 (Anastasia). The game’s AI adds that NPC’s behavior row while the Tarnished carries it.">
          <InputNumber min={0} max={2147483647} value={effect} onChange={setEffect} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Description" help="Shown when you hover over this style. Saved as a comment on its line in the TOML file.">
          <Input.TextArea value={description} onChange={(event) => setDescription(event.target.value)} autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Who it comes from and how it fights" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
