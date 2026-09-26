import { Card, Form, InputNumber, Select, Typography } from 'antd';
import type { ItemCatalog } from '../catalog';
import type { Consumable, LibraryDocument } from '../types';
import { ConsumablesEditor } from './ConsumablesEditor';

type Props = { document: LibraryDocument; catalog: ItemCatalog; gestures: string[]; onChange: (document: LibraryDocument) => void };

export function SharedSettings({ document, catalog, gestures, onChange }: Props) {
  const pool = document.consumables?.pool;
  const updateConsumables = (values: { kinds?: number; pool?: Consumable[] }) => {
    const consumables = { ...(document.consumables ?? {}), ...values };
    for (const key of ['kinds', 'pool'] as const) if (consumables[key] === undefined) delete consumables[key];
    const next: LibraryDocument = { ...document, consumables };
    if (!Object.keys(consumables).length) delete next.consumables;
    onChange(next);
  };
  const updateNames = (sex: 'male' | 'female', values: string[]) => onChange({ ...document, names: { ...(document.names ?? {}), [sex]: values } });
  const updateGestures = (field: 'greetings' | 'victories', values: string[]) => onChange({ ...document, gestures: { ...(document.gestures ?? {}), [field]: values } });
  return (
    <div className="editor-page">
      <div className="editor-titlebar"><div><Typography.Title level={2}>Shared library settings</Typography.Title><Typography.Text type="secondary">Defaults used when an individual Tarnished does not provide its own values.</Typography.Text></div></div>
      <div className="form-grid">
        <Card title="Shared names" className="form-card span-2">
          <Form layout="vertical">
            <Form.Item label="Male names"><Select mode="tags" tokenSeparators={[',']} value={document.names?.male ?? []} onChange={(values) => updateNames('male', values)} /></Form.Item>
            <Form.Item label="Female names"><Select mode="tags" tokenSeparators={[',']} value={document.names?.female ?? []} onChange={(values) => updateNames('female', values)} /></Form.Item>
          </Form>
        </Card>
        <Card title="Greeting gestures" className="form-card">
          <Select mode="multiple" value={document.gestures?.greetings ?? []} options={gestures.map((gesture) => ({ value: gesture, label: gesture.replaceAll('_', ' ') }))} onChange={(values) => updateGestures('greetings', values)} optionFilterProp="label" />
        </Card>
        <Card title="Victory gestures" className="form-card">
          <Select mode="multiple" value={document.gestures?.victories ?? []} options={gestures.map((gesture) => ({ value: gesture, label: gesture.replaceAll('_', ' ') }))} onChange={(values) => updateGestures('victories', values)} optionFilterProp="label" />
        </Card>
        <Card title="Shared consumables" className="form-card span-2">
          <Typography.Paragraph type="secondary">Each Tarnished draws this many different consumables within its level from the pool below, or from its own list when it has one. A later library file’s non-empty pool replaces this one.</Typography.Paragraph>
          <Form layout="vertical"><Form.Item label="Different consumables per Tarnished" className="kinds-field"><InputNumber min={0} max={9} value={document.consumables?.kinds} placeholder="inherit" onChange={(kinds) => updateConsumables({ kinds: kinds === null ? undefined : Number(kinds) })} /></Form.Item></Form>
          <ConsumablesEditor catalog={catalog} value={pool ?? []} onChange={(next) => updateConsumables({ pool: next?.length ? next : undefined })} />
        </Card>
        <Card title="Advanced definitions" className="form-card span-2">
          <Typography.Paragraph>Templates, faces, styles and personalities remain in the library and are preserved by the editor. Use <strong>Advanced TOML</strong> in the command bar to edit their complete definitions.</Typography.Paragraph>
        </Card>
      </div>
    </div>
  );
}
