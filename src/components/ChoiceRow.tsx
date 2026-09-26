import { Avatar, Button, Space, Tag, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ItemCatalog } from '../catalog';
import type { ArmorChoice, Consumable, ItemChoice, ItemKind, WeightedChoice } from '../types';
import { choiceId } from '../library';
import { ItemIcon } from './ItemSelect';

type Props = {
  catalog: ItemCatalog;
  kind: ItemKind;
  value: ItemChoice | ArmorChoice | Consumable;
  armorSet?: boolean;
  detail?: string;
  readOnly?: boolean;
  onEdit: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
};

export function ChoiceRow({ catalog, kind, value, armorSet, detail, readOnly, onEdit, onDuplicate, onDelete }: Props) {
  const set = armorSet ? (Array.isArray(value) ? value as number[] : (value as { set: number[] }).set) : undefined;
  const metadata = !Array.isArray(value) && typeof value === 'object' ? value as WeightedChoice & Consumable & { set?: number[] } : undefined;
  const id = armorSet ? set?.find((piece) => piece >= 0) ?? -1 : choiceId(value as ItemChoice);
  const title = armorSet ? (set?.map((piece) => catalog.name('armor', piece)).join(' · ') || 'Empty armor set') : catalog.name(kind, id);
  const icon = id >= 0 ? catalog.icon(kind, id) : undefined;
  return (
    <div className={`choice-row ${readOnly ? 'read-only' : ''}`} onDoubleClick={readOnly ? undefined : onEdit}>
      {set ? (
        <div className="armor-icons">{set.map((piece, index) => <ItemIcon key={index} catalog={catalog} kind="armor" id={piece} size={20} />)}</div>
      ) : <Avatar shape="square" size={42} src={icon} className="item-avatar">{icon ? null : '#'}</Avatar>}
      <div className="choice-copy">
        <Typography.Text strong ellipsis={{ tooltip: title }}>{title}</Typography.Text>
        <Space size={4} wrap>
          <Typography.Text type="secondary">{armorSet ? '4-piece preset' : detail ? `${detail} · ID ${id}` : `ID ${id}`}</Typography.Text>
          {metadata?.count !== undefined && <Tag>×{metadata.count}</Tag>}
          {metadata?.level !== undefined && <Tag>Level {metadata.level}</Tag>}
          {metadata?.weight !== undefined && <Tag>Weight {metadata.weight}</Tag>}
          {metadata?.ash !== undefined && <Tag>{catalog.name('ash', metadata.ash).replace(/^Ash of War: /, 'Ash: ')}</Tag>}
          {metadata?.upgrade !== undefined && <Tag>+{metadata.upgrade}</Tag>}
        </Space>
      </div>
      {!readOnly && <Space size={0} className="row-actions">
        <Button type="text" icon={<EditOutlined />} aria-label="Edit choice" onClick={onEdit} />
        {onDuplicate && <Button type="text" icon={<CopyOutlined />} aria-label="Duplicate choice" onClick={onDuplicate} />}
        <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete choice" onClick={onDelete} />
      </Space>}
    </div>
  );
}
