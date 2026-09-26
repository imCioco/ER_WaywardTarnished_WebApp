import { useMemo } from 'react';
import { Avatar, Select } from 'antd';
import type { CatalogItem, ItemCatalog } from '../catalog';
import type { ItemKind } from '../types';

type Group = { label: string; items: CatalogItem[] };

type Props = {
  catalog: ItemCatalog;
  kind: ItemKind;
  /** Items to offer; several groups become labelled sections. */
  groups: Group[];
  value?: number;
  emptyLabel?: string;
  allowClear?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
};

type Option = { value?: number; label: string; search?: string; detail?: string; title?: string; options?: Option[] };

export function ItemIcon({ catalog, kind, id, size = 30 }: { catalog: ItemCatalog; kind: ItemKind; id: number; size?: number }) {
  const icon = id >= 0 ? catalog.icon(kind, id) : undefined;
  return <Avatar shape="square" size={size} src={icon} className="item-avatar">{icon ? null : id < 0 ? '–' : '#'}</Avatar>;
}

export function ItemSelect({ catalog, kind, groups, value, emptyLabel, allowClear, placeholder, disabled, onChange }: Props) {
  const options = useMemo(() => {
    const toOption = (item: CatalogItem): Option => ({ value: item.id, label: item.name, search: `${item.name} ${item.id}`, detail: item.dlc ? 'DLC' : undefined });
    const empty = emptyLabel ? [{ value: -1, label: emptyLabel, search: `${emptyLabel} -1` }] : [];
    const filled = groups.filter((group) => group.items.length);
    if (filled.length <= 1) return [...empty, ...(filled[0]?.items ?? []).map(toOption)];
    return [...empty, ...filled.map((group) => ({ label: group.label, title: group.label, options: group.items.map(toOption) }))];
  }, [groups, emptyLabel]);
  const known = value !== undefined && (value === -1 ? Boolean(emptyLabel) : groups.some((group) => group.items.some((item) => item.id === value)));

  return (
    <Select<number, Option>
      showSearch={{ optionFilterProp: 'search' }}
      value={known ? value : undefined}
      options={options}
      placeholder={placeholder ?? 'Search by name or ID'}
      allowClear={allowClear}
      disabled={disabled}
      onChange={(next) => onChange(next ?? undefined)}
      virtual
      listHeight={360}
      listItemHeight={46}
      className="item-select"
      classNames={{ popup: { root: 'item-select-popup' } }}
      optionRender={(option) => (
        <div className="item-option">
          <ItemIcon catalog={catalog} kind={kind} id={Number(option.value)} />
          <span className="item-option-name">{option.data.label}</span>
          <span className="item-option-id">{option.data.detail ? `${option.data.detail} · ` : ''}{option.value}</span>
        </div>
      )}
      labelRender={(selected) => (
        <span className="item-select-label">
          <ItemIcon catalog={catalog} kind={kind} id={Number(selected.value)} size={22} />
          <span>{selected.label}</span>
        </span>
      )}
    />
  );
}
