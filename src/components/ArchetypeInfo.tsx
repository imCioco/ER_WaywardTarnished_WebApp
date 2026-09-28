import type { ReactNode } from 'react';
import { Popover, Select, Space, Tag, Typography } from 'antd';
import type { Archetype } from '../library';

export function kindLabel(archetype: Archetype): string {
  return archetype.kind === 'style' ? 'Vanilla style' : 'Custom personality';
}

/** Where an archetype comes from, as a short tag. */
export function sourceLabel(archetype: Archetype): string {
  return archetype.source === 'base' ? 'base.toml preset' : archetype.source === 'saved' ? 'Saved preset' : 'In this file';
}

export function archetypeDetail(archetype: Archetype): string {
  if (archetype.kind === 'style') return `NPC personality SpEffect ${archetype.effect}`;
  const changed = Object.keys(archetype.personality?.odds ?? {}).length;
  return `${changed} action${changed === 1 ? '' : 's'} changed`;
}

export function ArchetypeSummary({ archetype }: { archetype: Archetype }) {
  return (
    <div className="archetype-popover">
      <Space size={4} wrap>
        <Tag>{kindLabel(archetype)}</Tag>
        <Tag>{sourceLabel(archetype)}</Tag>
      </Space>
      <Typography.Paragraph className="archetype-description">{archetype.description || <Typography.Text type="secondary">No description yet.</Typography.Text>}</Typography.Paragraph>
      <Typography.Text type="secondary" className="archetype-meta">{archetypeDetail(archetype)}</Typography.Text>
    </div>
  );
}

/** Shows an archetype's description in a popover on hover. */
export function ArchetypePopover({ archetype, children, placement = 'top' }: { archetype?: Archetype; children: ReactNode; placement?: 'top' | 'right' | 'left' }) {
  if (!archetype) return <>{children}</>;
  return (
    <Popover title={archetype.name} content={<ArchetypeSummary archetype={archetype} />} placement={placement} mouseEnterDelay={0.25} zIndex={1200} classNames={{ root: 'archetype-popover-root' }}>
      <span className="archetype-hover">{children}</span>
    </Popover>
  );
}

type SelectProps = { archetypes: Archetype[]; value: string[]; onChange: (value: string[]) => void };

/** The AI styles picker: each option and chosen tag shows its description on hover. */
export function StyleSelect({ archetypes, value, onChange }: SelectProps) {
  const byName = new Map(archetypes.map((archetype) => [archetype.name, archetype]));
  return (
    <Select
      mode="multiple"
      value={value}
      onChange={onChange}
      placeholder="No styles: the plain player-like AI"
      showSearch={{ optionFilterProp: 'search' }}
      options={[
        { label: 'Custom personalities', title: 'Custom personalities', options: archetypes.filter((archetype) => archetype.kind === 'personality').map((archetype) => ({ value: archetype.name, label: archetype.name, search: `${archetype.name} ${archetype.description ?? ''}` })) },
        { label: 'Vanilla styles', title: 'Vanilla styles', options: archetypes.filter((archetype) => archetype.kind === 'style').map((archetype) => ({ value: archetype.name, label: archetype.name, search: `${archetype.name} ${archetype.description ?? ''}` })) },
      ]}
      optionRender={(option) => (
        <ArchetypePopover archetype={byName.get(String(option.value))} placement="right">
          <div className="style-option"><strong>{option.label}</strong><small>{byName.get(String(option.value))?.description}</small></div>
        </ArchetypePopover>
      )}
      tagRender={({ value: name, closable, onClose }) => {
        const archetype = byName.get(String(name));
        return (
          <ArchetypePopover archetype={archetype}>
            <Tag closable={closable} onClose={onClose} onMouseDown={(event) => event.stopPropagation()} color={archetype ? undefined : 'red'} className="style-tag">{String(name)}</Tag>
          </ArchetypePopover>
        );
      }}
      listHeight={380}
      className="style-select"
    />
  );
}
