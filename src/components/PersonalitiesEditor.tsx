import { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Popconfirm, Segmented, Space, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined, ExperimentOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { PERSONALITIES_AT_ONCE } from '../constants';
import { archetypes as listArchetypes, type Archetype } from '../library';
import type { LibraryDocument } from '../types';
import { ArchetypePopover, StyleSelect, archetypeDetail, kindLabel } from './ArchetypeInfo';
import { PersonalityModal, StyleModal, type PersonalityDraft } from './PersonalityModal';

type Props = {
  document: LibraryDocument;
  /** The mod's base.toml: its styles and personalities apply to this file too. */
  base?: LibraryDocument;
  selected?: number;
  onChange: (document: LibraryDocument) => void;
};

type Filter = 'all' | 'build' | 'personality' | 'style';

type Editing =
  | { kind: 'personality'; title: string; original?: string; initial: PersonalityDraft }
  | { kind: 'style'; title: string; original?: string; initial: { name: string; description: string; effect: number } };

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

export function PersonalitiesEditor({ document, base, selected, onChange }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Editing | null>(null);
  const entry = selected === undefined ? undefined : document.tarnished[selected];
  const archetypes = useMemo(() => listArchetypes(document, base), [document, base]);
  const byName = useMemo(() => new Map(archetypes.map((archetype) => [archetype.name, archetype])), [archetypes]);
  const chosen = entry?.styles ?? [];
  const usage = (name: string) => document.tarnished.filter((tarnished) => tarnished.styles?.includes(name)).length;

  const change = (action: (next: LibraryDocument) => void) => {
    const next = structuredClone(document);
    action(next);
    onChange(next);
  };
  const setStyles = (styles: string[]) => change((next) => { if (selected !== undefined) next.tarnished[selected].styles = styles; });
  const toggle = (name: string) => setStyles(chosen.includes(name) ? chosen.filter((style) => style !== name) : [...chosen, name]);

  const newPersonality = () => setEditing({ kind: 'personality', title: 'New personality', initial: { name: '', description: '', personality: { odds: {} } } });
  const editArchetype = (archetype: Archetype, copy = false) => {
    const original = copy || archetype.inherited ? undefined : archetype.name;
    const name = copy ? `${archetype.name}-copy` : archetype.name;
    const description = archetype.description ?? '';
    const title = copy ? `Copy of ${archetype.name}` : archetype.inherited ? `Customize ${archetype.name}` : `Edit ${archetype.name}`;
    if (archetype.kind === 'style') setEditing({ kind: 'style', title, original, initial: { name, description, effect: archetype.effect ?? 0 } });
    else setEditing({ kind: 'personality', title, original, initial: { name, description, personality: structuredClone(archetype.personality!) } });
  };
  const savePersonality = (draft: PersonalityDraft, original?: string) => change((next) => {
    if (original && original !== draft.name) { removeArchetype(next, original); replaceStyle(next, original, draft.name); }
    next.personalities = { ...(next.personalities ?? {}), [draft.name]: draft.personality };
    setDescription(next, draft.name, draft.description);
    setEditing(null);
  });
  const saveStyle = (draft: { name: string; description: string; effect: number }, original?: string) => change((next) => {
    if (original && original !== draft.name) { removeArchetype(next, original); replaceStyle(next, original, draft.name); }
    next.styles = { ...(next.styles ?? {}), [draft.name]: draft.effect };
    setDescription(next, draft.name, draft.description);
    setEditing(null);
  });
  const remove = (name: string) => change((next) => { removeArchetype(next, name); replaceStyle(next, name); });

  const shown = archetypes.filter((archetype) => filter === 'all' || (filter === 'build' ? chosen.includes(archetype.name) : archetype.kind === filter));
  const missing = chosen.filter((name) => !byName.has(name));

  return (
    <div className="editor-page">
      <div className="editor-titlebar">
        <div>
          <Typography.Title level={2}>AI personalities</Typography.Title>
          <Typography.Text type="secondary">How {entry ? entry.name : 'each Tarnished'} fights: the game’s player-like AI, leaning toward one of these styles.</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => setEditing({ kind: 'style', title: 'Add vanilla style', initial: { name: '', description: '', effect: 0 } })}>Add vanilla style</Button>
          <Button type="primary" icon={<ExperimentOutlined />} onClick={newPersonality}>New personality</Button>
        </Space>
      </div>

      {entry && (
        <Card title={`${entry.name}’s AI styles`} className="form-card build-styles">
          <Typography.Paragraph type="secondary">Each time this Tarnished appears it draws one of these. With none, it fights with the plain player-like AI, like the Nameless White Mask. Hover over a style to see what it does.</Typography.Paragraph>
          <StyleSelect archetypes={archetypes} value={chosen} onChange={setStyles} />
          {missing.length > 0 && <Alert type="error" showIcon message={`Not defined in this library or base.toml: ${missing.join(', ')}`} />}
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
          <Typography.Paragraph type="secondary"><strong>Vanilla styles</strong> borrow a named NPC invader’s behavior through its SpEffect. <strong>Custom personalities</strong> set their own odds for each action; the mod writes them into the game when a Tarnished with one spawns.</Typography.Paragraph>
        </div>
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          options={[
            { value: 'all', label: `All (${archetypes.length})` },
            ...(entry ? [{ value: 'build', label: `In this build (${chosen.length})` }] : []),
            { value: 'personality', label: 'Custom' },
            { value: 'style', label: 'Vanilla' },
          ]}
        />
      </div>

      <Alert type="info" showIcon className="slot-note" message={`Define as many personalities as you like; up to ${PERSONALITIES_AT_ONCE} different custom ones can be in play at once.`} description={`Any number of Tarnished can share a personality. A Tarnished that arrives while ${PERSONALITIES_AT_ONCE} other custom personalities are in use fights without its own. Vanilla styles have no limit.`} />

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
                    {archetype.inherited && <Tooltip title="Defined in the mod’s base.toml, which the mod loads before this file"><Tag>base.toml</Tag></Tooltip>}
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
                  {!archetype.inherited && (
                    <Popconfirm title={`Delete “${archetype.name}”?`} description={used ? `${used} Tarnished use it; it is removed from their styles.` : undefined} onConfirm={() => remove(archetype.name)}>
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
          onCancel={() => setEditing(null)}
          onSave={(draft) => savePersonality(draft, editing.original)}
        />
      )}
      {editing?.kind === 'style' && (
        <StyleModal title={editing.title} initial={editing.initial} original={editing.original} archetypes={archetypes} onCancel={() => setEditing(null)} onSave={(draft) => saveStyle(draft, editing.original)} />
      )}
    </div>
  );
}
