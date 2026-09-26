import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Collapse, Form, Input, InputNumber, Modal, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { ACTION_HELP, ODDS_GROUPS, ODDS_KINDS, ODDS_LIMIT, PERSONALITIES_AT_ONCE, actionLabel } from '../constants';
import type { Archetype } from '../library';
import type { Personality } from '../types';

export type PersonalityDraft = { name: string; description: string; personality: Personality };

type Props = {
  title: string;
  initial: PersonalityDraft;
  /** The name it is saved under now; undefined for a new personality or a copy of an inherited one. */
  original?: string;
  archetypes: Archetype[];
  onCancel: () => void;
  onSave: (draft: PersonalityDraft) => void;
};

const NAME = /^[A-Za-z0-9_-]+$/;

/** How the numbers work, with examples; verified against battle goal 29999 (029999_battle.lua). */
function OddsGuide() {
  return (
    <Collapse
      className="odds-guide"
      items={[{
        key: 'guide',
        label: <strong>How the numbers work</strong>,
        children: (
          <div className="odds-guide-body">
            <Typography.Paragraph>Each number is <strong>added</strong> to the odds the game already gives the Tarnished for the moment, from its weapons, spells, distance, stamina and health (mostly 10–100). Leave a field empty to keep the game’s own odds. The AI only considers actions its gear allows: no parrying without a parry skill, no spells without a catalyst, no pots it does not carry.</Typography.Paragraph>
            <div className="odds-kinds">
              {Object.entries(ODDS_KINDS).map(([kind, info]) => (
                <div key={kind} className={`odds-kind ${kind}`}><Tag>{info.label}</Tag><span>{info.summary}</span></div>
              ))}
            </div>
            <Typography.Title level={5}>Examples</Typography.Title>
            <ul>
              <li><code>parry = 9999</code>: every time your attack comes in at parry timing it tries to parry, because parry is the first reaction checked and 9999 covers the whole 1–100 roll. It needs a parry skill (Buckler Parry, Parry); without one it does nothing at that moment. It is not a guaranteed parry: the parry can still come early or late.</li>
              <li><code>riposte = 9999</code>: after a successful parry it always ripostes.</li>
              <li><code>r1_combo = 150</code>: light combos become much more common, but other attacks still happen. <code>r1_combo = 9999</code>: nearly every attack it chooses is a light combo.</li>
              <li><code>dash_attack = -9999</code>: never runs in with an attack, whatever the game’s odds.</li>
              <li><code>hit_r1_combo = 60</code>: when hit, about 60% of the time it swings back straight away (less if a reaction checked before it comes up first).</li>
              <li><code>guard_while_moving = 40</code>: adds 40 percentage points to how often it keeps its guard up while moving.</li>
            </ul>
          </div>
        ),
      }]}
    />
  );
}

export function PersonalityModal({ title, initial, original, archetypes, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [suppress, setSuppress] = useState<number[]>(initial.personality.suppress ?? []);
  const [odds, setOdds] = useState<Record<string, number>>({ ...initial.personality.odds });
  const [changedOnly, setChangedOnly] = useState(Object.keys(initial.personality.odds).length > 0);
  const [open, setOpen] = useState<string[]>(() => ODDS_GROUPS.filter((group) => group.actions.some((action) => initial.personality.odds[action] !== undefined)).map((group) => group.label).slice(0, 3));

  const clash = archetypes.find((archetype) => archetype.name === name && archetype.name !== original && !archetype.inherited);
  const overridesBase = archetypes.find((archetype) => archetype.name === name && archetype.inherited);
  const nameError = !name ? 'Give the personality a name.' : !NAME.test(name) ? 'Use only letters, digits, - and _.' : clash ? `“${name}” is already a ${clash.kind === 'style' ? 'style' : 'personality'} in this library.` : undefined;
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
    const kind = ODDS_KINDS[group.kind];
    return {
      key: group.label,
      label: <Space wrap size={6}><strong>{group.label}</strong><Typography.Text type="secondary">{group.hint}</Typography.Text></Space>,
      extra: <Space size={6}>{count > 0 && <Badge count={count} color="#1d39c4" />}<Tooltip title={kind.summary}><Tag className={`kind-tag ${group.kind}`}>{kind.label}</Tag></Tooltip></Space>,
      children: (
        <>
          <Typography.Paragraph type="secondary" className="odds-group-summary">{kind.summary}</Typography.Paragraph>
          <div className="odds-grid">
            {actions.map((action) => {
              const value = odds[action];
              return (
                <div key={action} className={`odds-row ${value === undefined ? '' : value < 0 ? 'lowered' : 'raised'}`}>
                  <div className="odds-row-copy">
                    <span className="odds-row-name" title={action}>{actionLabel(action)}</span>
                    <small>{ACTION_HELP[action]}</small>
                  </div>
                  <InputNumber size="small" min={-ODDS_LIMIT} max={ODDS_LIMIT} step={10} value={value} placeholder="0" onChange={(next) => setOdd(action, next)} aria-label={actionLabel(action)} />
                  <Space size={2}>
                    <Button size="small" type={value === -ODDS_LIMIT ? 'primary' : 'text'} onClick={() => setOdd(action, value === -ODDS_LIMIT ? null : -ODDS_LIMIT)} title="Rule this out (-9999)">Never</Button>
                    <Button size="small" type={value === ODDS_LIMIT ? 'primary' : 'text'} onClick={() => setOdd(action, value === ODDS_LIMIT ? null : ODDS_LIMIT)} title="Force it whenever possible (9999)">Always</Button>
                  </Space>
                </div>
              );
            })}
          </div>
        </>
      ),
    };
  }), [odds, changedOnly]);

  const save = () => {
    if (nameError) return;
    // Older files named a slot; the mod ignores it now, so it is kept only if it was there.
    const { effect, row } = initial.personality;
    onSave({ name, description: description.trim(), personality: { ...(effect !== undefined ? { effect } : {}), ...(row !== undefined ? { row } : {}), ...(suppress.length ? { suppress } : {}), odds } });
  };

  return (
    <Modal open title={title} onCancel={onCancel} onOk={save} okText="Save personality" okButtonProps={{ disabled: Boolean(nameError) }} width="min(1080px, 96vw)" destroyOnHidden className="personality-modal">
      <Form layout="vertical" component="div">
        <Form.Item label="Name" required validateStatus={nameError && name ? 'error' : undefined} help={nameError ?? (overridesBase && !original ? `Replaces base.toml’s “${name}” wherever this file is installed beside it.` : 'Used in each Tarnished’s styles list.')}>
          <Input value={name} onChange={(event) => setName(event.target.value.trim())} placeholder="counter-puncher" />
        </Form.Item>
        <Form.Item label="Description" help="Shown when you hover over this personality. Saved as a comment above it in the TOML file.">
          <Input.TextArea value={description} onChange={(event) => setDescription(event.target.value)} autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Waits for your attack, then punishes it with a quick counter." />
        </Form.Item>
        <Form.Item label="Suppressed SpEffects (optional)" help="Removed from the Tarnished while it lives, for example a skill’s buff that stops the AI from using the skill again (Seppuku: 1755).">
          <Select mode="tags" value={suppress.map(String)} onChange={(values: string[]) => setSuppress(values.map(Number).filter((value) => Number.isInteger(value) && value >= 0))} tokenSeparators={[',', ' ']} placeholder="Type an SpEffect ID and press Enter" />
        </Form.Item>
      </Form>
      <Typography.Paragraph type="secondary" className="personality-note">A library can define any number of personalities. Up to {PERSONALITIES_AT_ONCE} different ones can be in play at once, and any number of Tarnished can share one; a Tarnished that arrives while {PERSONALITIES_AT_ONCE} other custom personalities are in play fights without its own.</Typography.Paragraph>
      <OddsGuide />
      <div className="odds-toolbar">
        <div>
          <Typography.Title level={5}>Action odds · {changed} changed</Typography.Title>
          <Typography.Text type="secondary">Empty keeps the game’s own odds. <strong>Never</strong> sets -9999, <strong>Always</strong> 9999.</Typography.Text>
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
