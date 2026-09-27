import { useMemo, useState } from 'react';
import { Alert, Button, Card, Collapse, Empty, Flex, Form, InputNumber, Modal, Popconfirm, Segmented, Select, Slider, Space, Switch, Table, Tag, Timeline, Tooltip, Typography } from 'antd';
import { DeleteOutlined, ExperimentOutlined, LineChartOutlined, PlusOutlined } from '@ant-design/icons';
import { CLASS_STATS, SOFT_CAPS, STATS, STAT_SHORT } from '../constants';
import { baseLevel, startingSets } from '../library';
import { growthTable, planValues, type Rules } from '../simulate';
import type { StatPlan, Tarnished } from '../types';
import { AttributeBreakdown, SourceLegend } from './AttributeBreakdown';

type Props = {
  entry: Tarnished;
  rules?: Rules;
  onChange: (entry: Tarnished) => void;
  onTest: () => void;
};

const PREVIEW_LEVELS = [1, 10, 20, 30, 40, 50, 60, 80, 100, 125, 150, 200];

function HowItWorks() {
  return (
    <Collapse
      className="growth-guide"
      items={[{
        key: 'guide',
        label: <strong>How attributes are raised, with examples</strong>,
        children: (
          <div className="growth-guide-body">
            <Typography.Paragraph>Every Tarnished targets your level plus or minus the INI’s <code>level_spread</code> (5 by default), never below its class. Each level above the class’s starting level is one attribute point, spent in this order:</Typography.Paragraph>
            <Timeline
              className="growth-steps"
              items={[
                { color: '#595959', content: <><Typography.Text strong>1. Gear requirements</Typography.Text><br />Strength, dexterity, intelligence, faith and arcane go up to what every weapon and spell needs, and endurance to what keeps the gear under medium load (69%), so it never fat-rolls. These come first, even past the level.</> },
                { color: '#4f6d9a', content: <><Typography.Text strong>2. Stat plan (optional)</Typography.Text><br />The highest plan at or below the level: each attribute below its planned value is raised, one point per attribute in turn, while points last.</> },
                { color: '#262626', content: <><Typography.Text strong>3. Growth weights</Typography.Text><br />Whatever is left is shared by the weights. Points past a soft cap count double, past the second cap four times, so builds spread out the way players do. Attributes with weight 0 only grow once every weighted one is at 99.</> },
              ]}
            />
            <Typography.Title level={5}>Examples</Typography.Title>
            <ul>
              <li><code>vigor 4, strength 5</code>: strength gets five points for every four of vigor, until strength passes 55; from then each strength point counts double, so vigor catches up. Past vigor 40 the same happens the other way.</li>
              <li><code>vigor 1, dexterity 1</code>: an even split, but a katana needing 15 dexterity is paid first, and the growth split starts from there.</li>
              <li>A plan at level 60 with <code>vigor 40, dexterity 40</code>: a level-80 Tarnished reaches at least 40/40 and spends its other 20 levels by growth. At level 50 the plan does not apply yet.</li>
              <li>A greatsword needing 31 strength gets 31 strength at level 30 even with <code>strength 0</code>: requirements always win.</li>
            </ul>
            <Typography.Title level={5}>Soft caps</Typography.Title>
            <Table
              size="small"
              pagination={false}
              bordered
              rowKey="cap"
              columns={[{ title: '', dataIndex: 'cap', key: 'cap' }, ...STATS.map((stat) => ({ title: STAT_SHORT[stat], dataIndex: stat, key: stat, align: 'center' as const }))]}
              dataSource={[
                { cap: 'Counts double past', ...Object.fromEntries(STATS.map((stat, index) => [stat, SOFT_CAPS[index][0]])) },
                { cap: 'Counts ×4 past', ...Object.fromEntries(STATS.map((stat, index) => [stat, SOFT_CAPS[index][1]])) },
              ]}
            />
          </div>
        ),
      }]}
    />
  );
}

/** Attributes by level for one start, with each level's breakdown. */
function GrowthPreview({ entry, rules, open, onClose }: { entry: Tarnished; rules?: Rules; open: boolean; onClose: () => void }) {
  const classes = entry.attributes ? [] : Array.isArray(entry.class) ? entry.class : entry.class ? [entry.class] : [];
  const [className, setClassName] = useState<string | undefined>(classes[0]);
  const [withGear, setWithGear] = useState(Boolean(entry.gear?.length));
  const start = entry.attributes ? startingSets(entry)[0] : CLASS_STATS[className && classes.includes(className) ? className : classes[0]] ?? startingSets(entry)[0];
  const [selected, setSelected] = useState(60);
  const levels = useMemo(() => {
    const lowest = start ? baseLevel(start) : 1;
    return [...new Set([lowest, ...PREVIEW_LEVELS, ...(entry.stats ?? []).map((plan) => plan.level)].filter((level) => level >= lowest))].sort((a, b) => a - b);
  }, [entry.stats, start]);
  const table = useMemo(() => (start ? growthTable(entry, start, levels, rules, withGear) : []), [entry, start, levels, rules, withGear]);
  const focus = useMemo(() => (start ? growthTable(entry, start, [selected], rules, withGear)[0] : undefined), [entry, start, selected, rules, withGear]);
  if (!start) return null;
  const startLevel = baseLevel(start);
  return (
    <Modal open={open} onCancel={onClose} footer={<Button type="primary" onClick={onClose}>Close</Button>} width="min(1180px, 96vw)" title={`Growth preview: ${entry.name}`} destroyOnHidden>
      <Typography.Paragraph type="secondary">Attributes this entry reaches at each level, without the random parts of a build: {entry.gear?.length ? 'gear requirements use each loadout’s first options' : 'class libraries draw gear at random, so only growth and plans are shown'}. Use <strong>Test build</strong> for a complete, random Tarnished.</Typography.Paragraph>
      <Flex gap={16} wrap align="center" className="growth-preview-controls">
        {classes.length > 1 && <Space><Typography.Text>Class</Typography.Text><Select value={className} onChange={setClassName} style={{ width: 150 }} options={classes.map((name) => ({ value: name, label: name }))} /></Space>}
        <Tooltip title={entry.gear?.length ? 'Raise attributes for the loadout the level can use, as the mod does' : 'Only for entries with fixed loadouts'}>
          <Space><Switch checked={withGear && Boolean(entry.gear?.length)} disabled={!entry.gear?.length || !rules} onChange={setWithGear} /><Typography.Text>Include gear requirements</Typography.Text></Space>
        </Tooltip>
        <Typography.Text type="secondary">Starts at level {startLevel}</Typography.Text>
      </Flex>
      <Card size="small" className="growth-focus" title={<Flex align="center" gap={16} wrap><span>At level</span><Slider min={startLevel} max={250} value={Math.max(selected, startLevel)} onChange={setSelected} style={{ width: 260, margin: 0 }} /><InputNumber min={startLevel} max={713} value={Math.max(selected, startLevel)} onChange={(value) => setSelected(Number(value ?? startLevel))} size="small" /></Flex>} extra={focus?.plan ? <Tag>level {focus.plan.level} plan</Tag> : <Tag>no plan</Tag>}>
        {focus && <><SourceLegend /><AttributeBreakdown allocation={focus.allocation} planned={focus.plan ? planValues(focus.plan) : undefined} /></>}
        {focus && focus.allocation.overspent > 0 && <Alert type="warning" showIcon message={`The level ${focus.gearLevel} loadout needs ${focus.allocation.overspent} more points than this level gives.`} />}
      </Card>
      <Table
        size="small"
        pagination={false}
        rowKey="level"
        className="growth-table"
        scroll={{ x: 760 }}
        onRow={(row) => ({ onClick: () => setSelected(row.level), className: row.level === selected ? 'growth-row-selected' : undefined })}
        columns={[
          { title: 'Level', dataIndex: 'level', key: 'level', width: 70, render: (level: number) => <strong>{level}</strong> },
          ...STATS.map((stat, index) => ({
            title: <Tooltip title={stat}>{STAT_SHORT[stat]}</Tooltip>,
            key: stat,
            align: 'center' as const,
            render: (_: unknown, row: (typeof table)[number]) => {
              const { allocation } = row;
              const hint = [allocation.requirement[index] && `${allocation.requirement[index]} for gear`, allocation.plan[index] && `${allocation.plan[index]} for the plan`, allocation.growth[index] && `${allocation.growth[index]} from growth`].filter(Boolean).join(', ');
              return <Tooltip title={hint || 'Class value'}><span className={`growth-cell ${allocation.plan[index] ? 'planned' : allocation.growth[index] ? 'grew' : allocation.requirement[index] ? 'needed' : ''}`}>{allocation.stats[index]}</span></Tooltip>;
            },
          })),
          { title: 'Plan', key: 'plan', width: 80, render: (_: unknown, row: (typeof table)[number]) => (row.plan ? <Tag>{row.plan.level}</Tag> : <Typography.Text type="secondary">–</Typography.Text>) },
          ...(entry.gear?.length && withGear ? [{ title: 'Loadout', key: 'gear', width: 90, render: (_: unknown, row: (typeof table)[number]) => row.gearLevel !== undefined ? <Tag>from {row.gearLevel}</Tag> : '–' }] : []),
        ]}
        dataSource={table}
      />
    </Modal>
  );
}

export function AttributesCard({ entry, rules, onChange, onTest }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const patch = (values: Partial<Tarnished>) => onChange({ ...entry, ...values });
  const growth = entry.growth ?? {};
  const growthTotal = STATS.reduce((sum, stat) => sum + Number(growth[stat] ?? 0), 0);
  const custom = Boolean(entry.attributes);
  const classes = Array.isArray(entry.class) ? entry.class : entry.class ? [entry.class] : [];
  const starts = startingSets(entry);
  const lowestStart = starts.length ? Math.min(...starts.map(baseLevel)) : 1;
  const plans = entry.stats ?? [];

  const setStart = (mode: string) => {
    const next = structuredClone(entry);
    if (mode === 'custom') {
      const first = CLASS_STATS[classes[0]] ?? [10, 10, 10, 10, 10, 10, 10, 10];
      next.attributes = Object.fromEntries(STATS.map((stat, index) => [stat, first[index]]));
      delete next.class;
    } else {
      delete next.attributes;
      if (!next.class) next.class = 'vagabond';
    }
    onChange(next);
  };
  const setPlans = (next: StatPlan[]) => {
    const copy = structuredClone(entry);
    if (next.length) copy.stats = [...next].sort((a, b) => a.level - b.level); else delete copy.stats;
    onChange(copy);
  };
  const setPlanValue = (index: number, key: string, value: number | null) => {
    const next = structuredClone(plans);
    const plan = next[index] as Record<string, number>;
    if (value === null || (key !== 'level' && value === 0)) delete plan[key]; else plan[key] = value;
    if (key !== 'level') setPlans(next);
    else { const copy = structuredClone(entry); copy.stats = next; onChange(copy); }
  };
  const addPlan = () => {
    const last = plans.at(-1);
    const level = last ? last.level + 40 : 60;
    setPlans([...plans, { level, ...(last ? Object.fromEntries(STATS.filter((stat) => last[stat as keyof StatPlan]).map((stat) => [stat, last[stat as keyof StatPlan]])) : { vigor: 40 }) }]);
  };
  const pointsFor = (plan: StatPlan) => {
    const start = starts[0];
    if (!start) return 0;
    return STATS.reduce((sum, stat, index) => sum + Math.max(0, Number(plan[stat as keyof StatPlan] ?? 0) - start[index]), 0);
  };

  return (
    <Card
      title="Attributes"
      className="form-card span-2"
      extra={(
        <Space wrap>
          <Tooltip title="See the attributes this entry reaches at every level, split by where the points come from"><Button icon={<LineChartOutlined />} onClick={() => setPreviewOpen(true)}>Preview growth</Button></Tooltip>
          <Tooltip title="Build one complete, random Tarnished from this entry: level, gear, attributes, items and style"><Button type="primary" icon={<ExperimentOutlined />} onClick={onTest}>Test build</Button></Tooltip>
        </Space>
      )}
    >
      <HowItWorks />
      <Form layout="vertical" component="div">
        <Typography.Title level={5} className="attributes-subtitle">Starting point</Typography.Title>
        <Flex gap={16} wrap align="center" className="start-mode">
          <Segmented value={custom ? 'custom' : 'class'} onChange={(value) => setStart(String(value))} options={[{ value: 'class', label: 'Starting class' }, { value: 'custom', label: 'Custom attributes' }]} />
          <Typography.Text type="secondary">{custom ? `Starts at level ${lowestStart} (the sum of the attributes minus 79, as in the game).` : `Set in Identity. ${classes.length > 1 ? 'One class is picked per Tarnished; ' : ''}starts at level ${lowestStart}.`}</Typography.Text>
        </Flex>
        {custom && (
          <div className="stats-grid">
            {STATS.map((stat) => <Form.Item key={stat} label={stat}><InputNumber min={1} max={99} value={entry.attributes?.[stat]} onChange={(value) => patch({ attributes: { ...(entry.attributes ?? {}), [stat]: Number(value ?? 1) } })} /></Form.Item>)}
          </div>
        )}

        <Typography.Title level={5} className="attributes-subtitle">Growth weights</Typography.Title>
        <Typography.Paragraph type="secondary">How the points left after the gear and the stat plan are shared. Only the ratios matter: 4 and 2 is the same as 2 and 1.</Typography.Paragraph>
        <div className="stats-grid">
          {STATS.map((stat) => {
            const value = Number(growth[stat] ?? 0);
            return (
              <Form.Item key={stat} label={stat} help={growthTotal && value ? `${Math.round((100 * value) / growthTotal)}% of growth` : 'not grown'}>
                <InputNumber min={0} max={255} value={value} onChange={(next) => patch({ growth: { ...growth, [stat]: Number(next ?? 0) } })} />
              </Form.Item>
            );
          })}
        </div>
        {!growthTotal && <Alert type="warning" showIcon message="No growth weights" description="Points left after the gear are then spread over the lowest attributes. Give the build’s main attributes a weight." />}

        <Flex justify="space-between" align="end" gap={12} className="plans-heading">
          <div>
            <Typography.Title level={5} className="attributes-subtitle">Stat plans</Typography.Title>
            <Typography.Text type="secondary">Optional targets by level, for builds that must reach a breakpoint, like 40 vigor by 60. Empty cells are left to growth.</Typography.Text>
          </div>
          <Button icon={<PlusOutlined />} onClick={addPlan}>Add plan</Button>
        </Flex>
        {plans.length ? (
          <Table
            size="small"
            pagination={false}
            rowKey={(_, index) => String(index)}
            scroll={{ x: 900 }}
            className="plans-table"
            dataSource={plans}
            columns={[
              { title: <Tooltip title="Applies from this level until the next plan">From level</Tooltip>, key: 'level', width: 96, render: (_: unknown, plan: StatPlan, index: number) => <InputNumber size="small" min={0} max={713} value={plan.level} onChange={(value) => setPlanValue(index, 'level', value === null ? 0 : Number(value))} onBlur={() => setPlans(plans)} /> },
              ...STATS.map((stat) => ({
                title: <Tooltip title={stat}>{STAT_SHORT[stat]}</Tooltip>,
                key: stat,
                render: (_: unknown, plan: StatPlan, index: number) => <InputNumber size="small" min={0} max={99} value={plan[stat as keyof StatPlan] || null} placeholder="–" onChange={(value) => setPlanValue(index, stat, value === null ? null : Number(value))} />,
              })),
              {
                title: 'Points', key: 'points', width: 110,
                render: (_: unknown, plan: StatPlan) => {
                  const needed = pointsFor(plan);
                  const available = Math.max(plan.level - lowestStart, 0);
                  return needed > available
                    ? <Tooltip title={`Needs ${needed} points but level ${plan.level} gives ${available}; it is reached as far as the points go.`}><Tag color="warning">{needed} / {available}</Tag></Tooltip>
                    : <Tooltip title={`${needed} of the ${available} points level ${plan.level} gives`}><Typography.Text type="secondary">{needed} / {available}</Typography.Text></Tooltip>;
                },
              },
              { title: '', key: 'remove', width: 44, render: (_: unknown, __: StatPlan, index: number) => <Popconfirm title="Remove this plan?" onConfirm={() => setPlans(plans.filter((_plan, other) => other !== index))}><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Remove plan" /></Popconfirm> },
            ]}
          />
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No stat plans: attributes follow the gear and growth only." />}
      </Form>
      <GrowthPreview key={previewOpen ? 'open' : 'closed'} entry={entry} rules={rules} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </Card>
  );
}
