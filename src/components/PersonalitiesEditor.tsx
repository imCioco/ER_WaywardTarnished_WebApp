import { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Popconfirm, Segmented, Space, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined, ExperimentOutlined, MinusOutlined, PlusOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { PERSONALITIES_AT_ONCE } from '../constants';
import { adoptArchetype, archetypes as listArchetypes, type Archetype } from '../library';
import { withoutPreset, withPersonality, withStyle, type Presets } from '../presets';
import type { LibraryDocument } from '../types';
import { ArchetypePopover, StyleSelect, archetypeDetail, kindLabel, sourceLabel } from './ArchetypeInfo';
import { PersonalityModal, StyleModal, type PersonalityDraft } from './PersonalityModal';

type Props = {
  document: LibraryDocument;
  /** The mod's base.toml: its styles and personalities are offered as presets. */
  base?: LibraryDocument;
  /** Styles and personalities saved in this browser, offered in every file. */
  presets: Presets;
  onPresets: (presets: Presets) => void;
  selected?: number;
  onChange: (document: LibraryDocument) => void;
};

type Filter = 'all' | 'build' | 'file' | 'presets' | 'personality' | 'style';

type StyleDraft = { name: string; description: string; effect: number };

type Editing =
  | { kind: 'personality'; title: string; original?: string; initial: PersonalityDraft; saved: boolean }
  | { kind: 'style'; title: string; original?: string; initial: StyleDraft; saved: boolean };

/** Renames or removes a style everywhere Tarnished use it; `to` undefined removes it. */
function replaceStyle(document: LibraryDocument, from: string, to?: string): void {
  for (const entry of document.tarnished) {
    if (!entry.styles?.includes(from)) continue;
    const styles = entry.styles.flatMap((style) => (style === from ? (to ? [to] : []) : [style]));
    entry.styles = [...new Set(styles)];
  }
}

function setDescription(document: LibraryDocument, name: string, description: string): void {
  const descriptions = { ...(document.__descriptions ?? {}) };
  if (description) descriptions[name] = description; else delete descriptions[name];
  if (Object.keys(descriptions).length) document.__descriptions = descriptions; else delete document.__descriptions;
}

function removeArchetype(document: LibraryDocument, name: string): void {
  if (document.styles) delete document.styles[name];
  if (document.personalities) delete document.personalities[name];
  setDescription(document, name, '');
}

export function PersonalitiesEditor({ document, base, presets, onPresets, selected, onChange }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Editing | null>(null);
  const entry = selected === undefined ? undefined : document.tarnished[selected];
  const archetypes = useMemo(() => listArchetypes(document, base, presets), [document, base, presets]);
  const byName = useMemo(() => new Map(archetypes.map((archetype) => [archetype.name, archetype])), [archetypes]);
  const chosen = entry?.styles ?? [];
  const usage = (name: string) => document.tarnished.filter((tarnished) => tarnished.styles?.includes(name)).length;

  const change = (action: (next: LibraryDocument) => void) => {
    const next = structuredClone(document);
    action(next);
    onChange(next);
  };
  // A preset a build starts to use is copied into the file, so the file carries what its Tarnished use.
  const setStyles = (styles: string[]) => change((next) => {
    if (selected === undefined) return;
    next.tarnished[selected].styles = styles;
    for (const name of styles) {
      const archetype = byName.get(name);
      if (archetype) adoptArchetype(next, archetype);
    }
  });
  const toggle = (name: string) => setStyles(chosen.includes(name) ? chosen.filter((style) => style !== name) : [...chosen, name]);

  const newPersonality = () => setEditing({ kind: 'personality', title: 'New personality', initial: { name: '', description: '', personality: { odds: {} } }, saved: true });
  const editArchetype = (archetype: Archetype, copy = false) => {
    const original = copy || archetype.inherited ? undefined : archetype.name;
    const name = copy ? `${archetype.name}-copy` : archetype.name;
    const description = archetype.description ?? '';
    const title = copy ? `Copy of ${archetype.name}` : archetype.inherited ? `Customize ${archetype.name}` : `Edit ${archetype.name}`;
    const saved = copy || Boolean(archetype.saved);
    if (archetype.kind === 'style') setEditing({ kind: 'style', title, original, initial: { name, description, effect: archetype.effect ?? 0 }, saved });
    else setEditing({ kind: 'personality', title, original, initial: { name, description, personality: structuredClone(archetype.personality!) }, saved });
  };
  const keepPreset = (draft: PersonalityDraft | StyleDraft, keep: boolean, original?: string) => {
    let next = original && original !== draft.name ? withoutPreset(presets, original) : presets;
    if (keep) next = 'personality' in draft ? withPersonality(next, draft.name, draft.personality, draft.description) : withStyle(next, draft.name, draft.effect, draft.description);
    else next = withoutPreset(next, draft.name);
    if (next !== presets) onPresets(next);
  };
  const savePersonality = (draft: PersonalityDraft, keep: boolean, original?: string) => {
    change((next) => {
      if (original && original !== draft.name) { removeArchetype(next, original); replaceStyle(next, original, draft.name); }
      next.personalities = { ...(next.personalities ?? {}), [draft.name]: draft.personality };
      setDescription(next, draft.name, draft.description);
    });
    keepPreset(draft, keep, original);
    setEditing(null);
  };
  const saveStyle = (draft: StyleDraft, keep: boolean, original?: string) => {
    change((next) => {
      if (original && original !== draft.name) { removeArchetype(next, original); replaceStyle(next, original, draft.name); }
      next.styles = { ...(next.styles ?? {}), [draft.name]: draft.effect };
      setDescription(next, draft.name, draft.description);
    });
    keepPreset(draft, keep, original);
    setEditing(null);
  };
  const remove = (name: string) => change((next) => { removeArchetype(next, name); replaceStyle(next, name); });
  const savePreset = (archetype: Archetype) => onPresets(archetype.kind === 'personality'
    ? withPersonality(presets, archetype.name, archetype.personality!, archetype.description)
    : withStyle(presets, archetype.name, archetype.effect!, archetype.description));
  const forgetPreset = (name: string) => onPresets(withoutPreset(presets, name));

  const shown = archetypes.filter((archetype) => {
    switch (filter) {
      case 'build': return chosen.includes(archetype.name);
      case 'file': return archetype.source === 'file';
      case 'presets': return archetype.source !== 'file' || Boolean(archetype.saved);
      case 'personality': case 'style': return archetype.kind === filter;
      default: return true;
    }
  });
  const missing = chosen.filter((name) => !byName.has(name));
  const savedCount = Object.keys(presets.personalities).length + Object.keys(presets.styles).length;

  return (
    <div className="editor-page">
      <div className="editor-titlebar">
        <div>
          <Typography.Title level={2}>AI personalities</Typography.Title>
          <Typography.Text type="secondary">How {entry ? entry.name : 'each Tarnished'} fights: the game’s player-like AI, leaning toward one of these styles.</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => setEditing({ kind: 'style', title: 'Add vanilla style', initial: { name: '', description: '', effect: 0 }, saved: true })}>Add vanilla style</Button>
          <Button type="primary" icon={<ExperimentOutlined />} onClick={newPersonality}>New personality</Button>
        </Space>
      </div>

      {entry && (
        <Card title={`${entry.name}’s AI styles`} className="form-card build-styles">
          <Typography.Paragraph type="secondary">Each time this Tarnished appears it draws one of these. With none, it fights with the plain player-like AI, like the Nameless White Mask. Hover over a style to see what it does. Picking a preset copies it into this file.</Typography.Paragraph>
          <StyleSelect archetypes={archetypes} value={chosen} onChange={setStyles} />
          {missing.length > 0 && <Alert type="error" showIcon message={`Not defined in this file, base.toml or your presets: ${missing.join(', ')}`} />}
          {chosen.length > 0 && (
            <div className="chosen-archetypes">
              {chosen.filter((name) => byName.has(name)).map((name) => {
                const archetype = byName.get(name)!;
                return (
                  <div key={name} className={`chosen-archetype ${archetype.kind}`}>
                    <div><strong>{name}</strong><Tag>{kindLabel(archetype)}</Tag></div>
                    <Typography.Paragraph ellipsis={{ rows: 2, tooltip: archetype.description }}>{archetype.description || 'No description yet.'}</Typography.Paragraph>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <div className="section-heading archetype-heading">
        <div>
          <Typography.Title level={3}>Personality library</Typography.Title>
          <Typography.Paragraph type="secondary"><strong>Vanilla styles</strong> borrow a named NPC invader’s behavior through its SpEffect. <strong>Custom personalities</strong> set their own odds for each action; the mod writes them into the game when a Tarnished with one spawns. <strong>Presets</strong> (the mod’s base.toml and the ones you save in this browser) are offered in every file, even a new one, and go into a file only when one of its Tarnished uses them.</Typography.Paragraph>
        </div>
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          options={[
            { value: 'all', label: `All (${archetypes.length})` },
            ...(entry ? [{ value: 'build', label: `In this build (${chosen.length})` }] : []),
            { value: 'file', label: 'In this file' },
            { value: 'presets', label: 'Presets' },
            { value: 'personality', label: 'Custom' },
            { value: 'style', label: 'Vanilla' },
          ]}
        />
      </div>

      <Alert type="info" showIcon className="slot-note" message={`Define as many personalities as you like; up to ${PERSONALITIES_AT_ONCE} different custom ones can be in play at once.`} description={`Any number of Tarnished can share a personality. A Tarnished that arrives while ${PERSONALITIES_AT_ONCE} other custom personalities are in use fights without its own. Vanilla styles have no limit. ${savedCount ? `${savedCount} preset${savedCount === 1 ? ' is' : 's are'} saved in this browser.` : 'Save a personality as a preset (the star) to have it in every file you open or start.'}`} />

      {shown.length ? (
        <div className="archetype-grid">
          {shown.map((archetype) => {
            const inBuild = chosen.includes(archetype.name);
            const used = usage(archetype.name);
            return (
              <Card key={archetype.name} size="small" className={`archetype-card ${archetype.kind} ${inBuild ? 'in-build' : ''}`}>
                <div className="archetype-card-head">
                  <ArchetypePopover archetype={archetype}><Typography.Text strong className="archetype-name">{archetype.name}</Typography.Text></ArchetypePopover>
                  <Space size={4} wrap>
                    <Tag>{kindLabel(archetype)}</Tag>
                    <Tooltip title={archetype.source === 'base' ? 'A preset from the mod’s base.toml: copied into this file when a Tarnished uses it' : archetype.source === 'saved' ? 'A preset saved in this browser: copied into this file when a Tarnished uses it' : 'Defined in this file'}><Tag color={archetype.source === 'file' ? undefined : 'gold'}>{sourceLabel(archetype)}</Tag></Tooltip>
                    {archetype.saved && archetype.source !== 'saved' && <Tooltip title="Also saved as a preset in this browser"><StarFilled className="preset-star" /></Tooltip>}
                  </Space>
                </div>
                <Typography.Paragraph className="archetype-description" type={archetype.description ? undefined : 'secondary'}>{archetype.description || 'No description yet. Edit it to add one.'}</Typography.Paragraph>
                <Typography.Text type="secondary" className="archetype-meta">{archetypeDetail(archetype)} · used by {used} Tarnished</Typography.Text>
                <div className="archetype-actions">
                  {entry && <Button size="small" type={inBuild ? 'primary' : 'default'} icon={inBuild ? <CheckOutlined /> : <PlusOutlined />} onClick={() => toggle(archetype.name)}>{inBuild ? 'In this build' : 'Add to build'}</Button>}
                  {entry && inBuild && <Tooltip title="Remove from this build"><Button size="small" type="text" icon={<MinusOutlined />} onClick={() => toggle(archetype.name)} aria-label="Remove from this build" /></Tooltip>}
                  <span className="archetype-actions-spacer" />
                  <Tooltip title={archetype.inherited ? 'Customize (saved in this file under the same name)' : 'Edit'}><Button size="small" type="text" icon={<EditOutlined />} onClick={() => editArchetype(archetype)} aria-label="Edit" /></Tooltip>
                  <Tooltip title="Duplicate"><Button size="small" type="text" icon={<CopyOutlined />} onClick={() => editArchetype(archetype, true)} aria-label="Duplicate" /></Tooltip>
                  {archetype.source === 'file' && (archetype.saved
                    ? <Tooltip title="Saved as a preset in this browser. Click to stop offering it in other files."><Button size="small" type="text" icon={<StarFilled />} onClick={() => forgetPreset(archetype.name)} aria-label="Remove from presets" /></Tooltip>
                    : <Tooltip title="Save as a preset in this browser, to have it in every file you open or start"><Button size="small" type="text" icon={<StarOutlined />} onClick={() => savePreset(archetype)} aria-label="Save as preset" /></Tooltip>)}
                  {archetype.source === 'saved' && (
                    <Popconfirm title={`Remove the preset “${archetype.name}” from this browser?`} description={used ? `${used} Tarnished in this file use it; copy it into the file first (Customize) or they lose it.` : 'Files that already carry it keep their copy.'} onConfirm={() => forgetPreset(archetype.name)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Remove preset" />
                    </Popconfirm>
                  )}
                  {archetype.source === 'file' && (
                    <Popconfirm title={`Delete “${archetype.name}” from this file?`} description={used ? `${used} Tarnished use it; it is removed from their styles.` : archetype.saved ? 'It stays in your presets.' : undefined} onConfirm={() => remove(archetype.name)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Delete" />
                    </Popconfirm>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Empty description={filter === 'build' ? 'This Tarnished has no styles; it uses the plain player-like AI.' : 'Nothing here yet'} />}

      {editing?.kind === 'personality' && (
        <PersonalityModal
          title={editing.title}
          initial={editing.initial}
          original={editing.original}
          archetypes={archetypes}
          saved={editing.saved}
          onCancel={() => setEditing(null)}
          onSave={(draft, keep) => savePersonality(draft, keep, editing.original)}
        />
      )}
      {editing?.kind === 'style' && (
        <StyleModal title={editing.title} initial={editing.initial} original={editing.original} archetypes={archetypes} saved={editing.saved} onCancel={() => setEditing(null)} onSave={(draft, keep) => saveStyle(draft, keep, editing.original)} />
      )}
    </div>
  );
}
