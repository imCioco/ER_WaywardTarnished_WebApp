import { Segmented, Select, Space, Typography } from 'antd';

type Mode = 'inherit' | 'never' | 'custom';

type Props = {
  label: string;
  value: string[] | undefined;
  choices: string[];
  onChange: (value: string[] | undefined) => void;
};

export function GestureField({ label, value, choices, onChange }: Props) {
  const mode: Mode = value === undefined ? 'inherit' : value.length === 0 ? 'never' : 'custom';
  const setMode = (next: Mode) => onChange(next === 'inherit' ? undefined : next === 'never' ? [] : (value?.length ? value : choices.slice(0, 1)));
  return (
    <div className="gesture-field">
      <Space direction="vertical" size={7} style={{ width: '100%' }}>
        <Typography.Text strong>{label}</Typography.Text>
        <Segmented block value={mode} options={[{ value: 'inherit', label: 'Inherit shared' }, { value: 'never', label: 'Never' }, { value: 'custom', label: 'Custom selection' }]} onChange={(next) => setMode(next as Mode)} />
        {mode === 'custom' && <Select mode="multiple" value={value} options={choices.map((choice) => ({ value: choice, label: choice.replaceAll('_', ' ') }))} onChange={onChange} optionFilterProp="label" placeholder="Choose one or more gestures" />}
      </Space>
    </div>
  );
}
