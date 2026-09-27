import { Badge, Flex, Space, Tooltip, Typography } from 'antd';
import { SOFT_CAPS, STATS } from '../constants';
import type { Allocation } from '../simulate';

// Where each attribute point came from, in the order the mod spends them.
export const SOURCES = [
  { key: 'base', label: 'Starting class', color: '#d6d6d2', help: 'What the class (or custom attributes) starts with.' },
  { key: 'requirement', label: 'Gear requirements', color: '#9a9a96', help: 'Raised so every weapon and spell can be used, and endurance so the gear stays under medium load.' },
  { key: 'plan', label: 'Stat plan', color: '#4f6d9a', help: 'Raised to the stat plan for this level, one point per attribute in turn.' },
  { key: 'growth', label: 'Growth', color: '#262626', help: 'The points left over, shared by the growth weights.' },
] as const;

export function SourceLegend() {
  return (
    <Space size={14} wrap className="source-legend">
      {SOURCES.map((source) => (
        <Tooltip key={source.key} title={source.help}><span><Badge color={source.color} text={source.label} /></span></Tooltip>
      ))}
    </Space>
  );
}

/** One bar per attribute, split by where its points came from, with the soft caps marked. */
export function AttributeBreakdown({ allocation, planned }: { allocation: Allocation; planned?: number[] }) {
  return (
    <div className="attribute-breakdown">
      {STATS.map((stat, index) => {
        const parts = SOURCES.map((source) => ({ ...source, value: source.key === 'base' ? allocation.base[index] : allocation[source.key][index] }));
        const [first, second] = SOFT_CAPS[index];
        return (
          <Flex key={stat} align="center" gap={10} className="attribute-row">
            <Typography.Text className="attribute-name">{stat}</Typography.Text>
            <Tooltip title={<div>{parts.filter((part) => part.value).map((part) => <div key={part.key}>{part.label}: {part.value}</div>)}{planned?.[index] ? <div>Plan target: {planned[index]}</div> : null}<div>Soft caps: {first} and {second}</div></div>}>
              <div className="attribute-track">
                {parts.filter((part) => part.value).map((part) => <span key={part.key} style={{ width: `${(part.value / 99) * 100}%`, background: part.color }} />)}
                <i style={{ left: `${(first / 99) * 100}%` }} />
                <i style={{ left: `${(second / 99) * 100}%` }} />
                {planned?.[index] ? <b style={{ left: `${(Math.min(planned[index], 99) / 99) * 100}%` }} /> : null}
              </div>
            </Tooltip>
            <Typography.Text strong className="attribute-value">{allocation.stats[index]}</Typography.Text>
          </Flex>
        );
      })}
    </div>
  );
}
