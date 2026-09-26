import { Avatar, Button, Space, Tag, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ItemCatalog } from '../catalog';
import type { ArmorChoice, ItemChoice, ItemKind, WeightedChoice } from '../types';
import { choiceId } from '../library';

type Props = {
  catalog: ItemCatalog;
  kind: ItemKind;
  value: ItemChoice | ArmorChoice;
  armorSet?: boolean;
  onEdit: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
};

export function ChoiceRow({ catalog, kind, value, armorSet, onEdit, onDuplicate, onDelete }: Props) {
  const set = armorSet ? (Array.isArray(value) ? value as number[] : (value as { set: number[] }).set) : undefined;
  const metadata = !Array.isArray(value) && typeof value === 'object' ? value as WeightedChoice & { set?: number[] } : undefined;
  const id = armorSet ? set?.find((piece) => piece >= 0) ?? -1 : choiceId(value as ItemChoice);
  const title = armorSet ? (set?.map((piece) => catalog.name('armor', piece)).join(' · ') || 'Empty armor set') : catalog.name(kind, id);
  const icon = id >= 0 ? catalog.icon(kind, id) : undefined;
  return (
    <div className="choice-row" onDoubleClick={onEdit}>
      <Avatar shape="square" size={42} src={icon} className="item-avatar">{icon ? null : '#'}</Avatar>
      <div className="choice-copy">
        <Typography.Text strong ellipsis={{ tooltip: title }}>{title}</Typography.Text>
        <Space size={4} wrap>
          <Typography.Text type="secondary">{armorSet ? '4-piece preset' : `ID ${id}`}</Typography.Text>
          {metadata?.level !== undefined && <Tag>Level {metadata.level}</Tag>}
          {metadata?.weight !== undefined && <Tag>Weight {metadata.weight}</Tag>}
          {metadata?.ash !== undefined && <Tag>Ash {metadata.ash}</Tag>}
          {metadata?.upgrade !== undefined && <Tag>+{metadata.upgrade}</Tag>}
        </Space>
      </div>
      <Space size={0} className="row-actions">
        <Button type="text" icon={<EditOutlined />} aria-label="Edit choice" onClick={onEdit} />
        {onDuplicate && <Button type="text" icon={<CopyOutlined />} aria-label="Duplicate choice" onClick={onDuplicate} />}
        <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete choice" onClick={onDelete} />
      </Space>
    </div>
  );
}
