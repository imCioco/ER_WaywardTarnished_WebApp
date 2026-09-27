import { useMemo, useState } from 'react';
import { Button, Card, Flex, Form, InputNumber, Progress, Segmented, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { CHANCE_GROUPS, ROLE_HELP } from '../constants';
import { allows, appearanceOdds, chanceGroup, shares, type MergedLibrary, type Role } from '../simulate';
import type { Chances, Tarnished } from '../types';

const ROLE_LABELS: Record<Role, string> = { invader: 'Invader', hunter: 'Hunter', host: 'Host', cooperator: 'Cooperator', summon: 'Summon' };
const GROUP_LABELS: Record<string, string> = Object.fromEntries(CHANCE_GROUPS.map((group) => [group.key, group.label]));

const percent = (value: number) => `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;

/** How often one entry appears in each of its roles at a player level. */
export function EntryOdds({ entry, library }: { entry: Tarnished; library: MergedLibrary }) {
  const [level, setLevel] = useState(50);
  const withEntry = useMemo(() => ({ ...library, entries: [...library.entries.filter((other) => other.id !== entry.id), ...(entry.enabled === false ? [] : [entry])] }), [library, entry]);
  const roles = (Object.keys(ROLE_LABELS) as Role[]).filter((role) => allows(entry, role));
  const inRange = (entry.min_level ?? 0) <= level && level <= (entry.max_level ?? 713);
  return (
    <div className="entry-odds">
      <Flex align="center" gap={8} wrap>
        <Typography.Text type="secondary">Chance to be the one picked, for a player at level</Typography.Text>
        <InputNumber size="small" min={1} max={713} value={level} onChange={(value) => setLevel(Number(value ?? 1))} />
      </Flex>
      {entry.enabled === false ? <Typography.Text type="secondary">Disabled: never picked.</Typography.Text> : !inRange ? <Typography.Text type="secondary">Outside its level range at this level.</Typography.Text> : (
        <Flex gap={6} wrap className="entry-odds-tags">
          {roles.map((role) => {
            const odds = appearanceOdds(withEntry, role, level);
            const mine = odds.find((item) => item.entry.id === entry.id);
            return <Tooltip key={role} title={`${ROLE_HELP[role]} ${odds.length} entries can appear as ${ROLE_LABELS[role].toLowerCase()} at this level.`}><Tag>{ROLE_LABELS[role]} {mine ? percent(mine.percent) : '0%'}</Tag></Tooltip>;
          })}
        </Flex>
      )}
    </div>
  );
}

type PanelProps = {
  library: MergedLibrary;
  chances?: Chances;
  includeBase: boolean;
  onIncludeBase: (value: boolean) => void;
  onChances: (chances: Chances | undefined) => void;
  onTest: (entry: Tarnished, level: number) => void;
};

/** `[chances]` for whole groups, and a table of who appears how often. */
export function OddsPanel({ library, chances, includeBase, onIncludeBase, onChances, onTest }: PanelProps) {
  const [role, setRole] = useState<Role>('invader');
  const [level, setLevel] = useState(50);
  const [dlc, setDlc] = useState(true);
  const odds = useMemo(() => appearanceOdds(library, role, level, dlc), [library, role, level, dlc]);
  const setGroup = (key: keyof Chances, value: number | null) => {
    const next = { ...(chances ?? {}) };
    if (value === null) delete next[key]; else next[key] = value;
    onChances(Object.keys(next).length ? next : undefined);
  };
  const rollWho = () => {
    const values = shares(odds.map((item) => item.entry), library.chances);
    let roll = Math.random() * values.reduce((sum, value) => sum + value, 0);
    const index = values.findIndex((value) => (roll -= value) < 0);
    const picked = odds[Math.max(index, 0)]?.entry;
    if (picked) onTest(picked, level);
  };
  return (
    <Card title="How often each Tarnished appears" className="form-card span-2">
      <Typography.Paragraph type="secondary">Every time a Tarnished is needed, one entry is drawn from those allowed in that role and at the player’s level. By default each entry’s chance is its <strong>weight</strong> divided by the sum of the weights. An entry’s own <strong>fixed chance</strong> (set in its Overview) or a <strong>group percentage</strong> below fixes a share instead; what no percentage claims is shared by weight, and the total is always 100%.</Typography.Paragraph>
      <Form layout="vertical" component="div">
        <div className="three-column-fields">
          {CHANCE_GROUPS.map((group) => (
            <Form.Item key={group.key} label={group.label} tooltip={group.help} help={chances?.[group.key] === undefined ? 'Empty: by weight' : 'Shared by weight inside the group'}>
              <InputNumber min={0} max={100} step={1} value={chances?.[group.key]} placeholder="by weight" suffix="%" onChange={(value) => setGroup(group.key, value === null ? null : Number(value))} style={{ width: '100%' }} />
            </Form.Item>
          ))}
        </div>
      </Form>
      <Flex gap={16} align="center" wrap className="odds-preview-controls">
        <Segmented value={role} onChange={(value) => setRole(value as Role)} options={(Object.keys(ROLE_LABELS) as Role[]).map((key) => ({ value: key, label: <Tooltip title={ROLE_HELP[key]}>{ROLE_LABELS[key]}</Tooltip> }))} />
        <Space><Typography.Text>Player level</Typography.Text><InputNumber min={1} max={713} value={level} onChange={(value) => setLevel(Number(value ?? 1))} /></Space>
        <Tooltip title="Entries marked as using Shadow of the Erdtree items are left out without the DLC"><Space><Switch checked={dlc} onChange={setDlc} size="small" /><Typography.Text>DLC installed</Typography.Text></Space></Tooltip>
        <Tooltip title="The mod loads its base.toml before this file, so its Tarnished appear too unless this file replaces them"><Space><Switch checked={includeBase} onChange={onIncludeBase} size="small" /><Typography.Text>With base.toml’s Tarnished</Typography.Text></Space></Tooltip>
        <Tooltip title="Draw one entry by these odds and build a Tarnished from it"><Button icon={<ExperimentOutlined />} onClick={rollWho} disabled={!odds.length}>Roll who appears</Button></Tooltip>
      </Flex>
      <Table
        size="small"
        rowKey={(item) => item.entry.id}
        pagination={false}
        dataSource={odds}
        locale={{ emptyText: 'Nobody can appear in this role at this level.' }}
        scroll={{ x: 640 }}
        columns={[
          { title: 'Tarnished', key: 'name', render: (_: unknown, item) => <Flex vertical><Typography.Text strong>{item.entry.name}</Typography.Text><Typography.Text type="secondary" className="odds-id">{item.entry.id}</Typography.Text></Flex> },
          { title: 'Group', key: 'group', width: 140, render: (_: unknown, item) => <Tag>{GROUP_LABELS[chanceGroup(item.entry)]}</Tag> },
          { title: 'Set by', key: 'rule', width: 150, render: (_: unknown, item) => item.entry.chance !== undefined ? <Tag>fixed {item.entry.chance}%</Tag> : library.chances[chanceGroup(item.entry)] !== undefined ? <Typography.Text type="secondary">group, weight {item.entry.weight ?? 10}</Typography.Text> : <Typography.Text type="secondary">weight {item.entry.weight ?? 10}</Typography.Text> },
          { title: 'Chance', key: 'percent', width: 220, render: (_: unknown, item) => <Progress percent={item.percent} size="small" strokeColor="#3a3a3a" format={() => percent(item.percent)} /> },
          { title: '', key: 'test', width: 60, render: (_: unknown, item) => <Tooltip title="Build one of these"><Button size="small" type="text" icon={<ExperimentOutlined />} onClick={() => onTest(item.entry, level)} aria-label="Test build" /></Tooltip> },
        ]}
      />
    </Card>
  );
}
