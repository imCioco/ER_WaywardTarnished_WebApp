import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert, App as AntApp, Badge, Breadcrumb, Button, ConfigProvider, Empty,
  Input, Layout, List, Modal, Space, Spin, Tag, Tooltip, Typography,
} from 'antd';
import {
  ApartmentOutlined, CheckCircleOutlined, CodeOutlined, DatabaseOutlined, DownloadOutlined,
  FileAddOutlined, FolderOpenOutlined, FormOutlined, PlusOutlined, RedoOutlined,
  MenuOutlined, SettingOutlined, TeamOutlined, ThunderboltOutlined, UndoOutlined, UploadOutlined,
} from '@ant-design/icons';
import { ItemCatalog, loadBundledCatalog, loadCatalog } from './catalog';
import { copyLibrary, newEnemy, parseLibrary, poolChoiceCount, serializeLibrary, validateLibrary, type GoodsLookup } from './library';
import type { LibraryDocument, Tarnished, ValidationResult } from './types';
import { EnemyEditor } from './components/EnemyEditor';
import { SharedSettings } from './components/SharedSettings';
import './styles.css';

type View = 'overview' | 'equipment' | 'behavior' | 'shared';
const DRAFT_KEY = 'wayward-tarnished-library-studio-draft-v2';

function Studio() {
  const { message, modal } = AntApp.useApp();
  const [document, setDocument] = useState<LibraryDocument | null>(null);
  const [catalog, setCatalog] = useState(new ItemCatalog());
  const [catalogProgress, setCatalogProgress] = useState('Loading item names and icons…');
  const [gestures, setGestures] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<View>('overview');
  const [search, setSearch] = useState('');
  const [filename, setFilename] = useState('wayward-tarnished-library.toml');
  const [savedText, setSavedText] = useState('');
  const [rawOpen, setRawOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const past = useRef<LibraryDocument[]>([]);
  const future = useRef<LibraryDocument[]>([]);
  const documentRef = useRef<LibraryDocument | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const catalogInput = useRef<HTMLInputElement>(null);

  useEffect(() => { documentRef.current = document; }, [document]);
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}base.toml`).then((response) => response.text()),
      fetch(`${import.meta.env.BASE_URL}gestures.txt`).then((response) => response.text()),
    ]).then(([base, gestureText]) => {
      const gestureNames = gestureText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      setGestures(gestureNames);
      const draft = localStorage.getItem(DRAFT_KEY);
      const baseDocument = parseLibrary(base);
      const draftDocument = draft ? parseLibrary(draft) : null;
      const hasRealDraft = Boolean(draftDocument && serializeLibrary(draftDocument) !== serializeLibrary(baseDocument));
      const loaded = hasRealDraft ? draftDocument! : baseDocument;
      setDocument(loaded);
      const text = serializeLibrary(loaded);
      setSavedText(hasRealDraft ? '' : text);
      if (hasRealDraft) message.info('Your browser draft was restored.'); else localStorage.removeItem(DRAFT_KEY);
    }).catch((error: unknown) => message.error(error instanceof Error ? error.message : 'Could not load the base library.'));
    loadBundledCatalog().then((loaded) => {
      setCatalog(loaded);
      setCatalogProgress(`${loaded.size.toLocaleString()} items · icons ready`);
    }).catch((error: unknown) => {
      setCatalogProgress('Bundled resources unavailable');
      message.error(error instanceof Error ? error.message : 'Could not load item resources.');
    });
  }, [message]);

  useEffect(() => {
    if (!document) return;
    const timer = window.setTimeout(() => {
      const text = serializeLibrary(document);
      if (text === savedText) localStorage.removeItem(DRAFT_KEY); else localStorage.setItem(DRAFT_KEY, text);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [document, savedText]);

  const commit = useCallback((next: LibraryDocument) => {
    if (documentRef.current) past.current = [...past.current.slice(-79), copyLibrary(documentRef.current)];
    future.current = [];
    setDocument(next);
  }, []);
  const resetHistory = (next: LibraryDocument) => {
    past.current = [];
    future.current = [];
    setDocument(next);
    setSelected(0);
  };
  const undo = () => {
    if (!past.current.length || !documentRef.current) return;
    future.current.push(copyLibrary(documentRef.current));
    setDocument(past.current.pop()!);
  };
  const redo = () => {
    if (!future.current.length || !documentRef.current) return;
    past.current.push(copyLibrary(documentRef.current));
    setDocument(future.current.pop()!);
  };

  const entries = document?.tarnished ?? [];
  const selectedEntry = entries[selected];
  const filteredEntries = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => `${entry.name} ${entry.id}`.toLowerCase().includes(search.toLowerCase()));
  const styleNames = useMemo(() => document ? [...new Set([...Object.keys(document.styles ?? {}), ...Object.keys(document.personalities ?? {})])].sort() : [], [document]);
  const serialized = useMemo(() => document ? serializeLibrary(document) : '', [document]);
  const dirty = Boolean(document && serialized !== savedText);
  const goodsLookup = useCallback<GoodsLookup>((id) => {
    const item = catalog.get('goods', id);
    return item ? { name: item.name, usable: Number(item.aiUseJudgeId) > 0, limit: catalog.stackLimit(id) } : undefined;
  }, [catalog]);
  const randomPools = entries.filter((entry) => entry.pool).length;
  const poolChoices = entries.reduce((count, entry) => count + poolChoiceCount(entry.pool), 0);

  const updateEntry = (entry: Tarnished) => {
    if (!document) return;
    const next = copyLibrary(document);
    next.tarnished[selected] = entry;
    commit(next);
  };
  const createEntry = (mode: 'gear' | 'pool') => {
    if (!document) return;
    const next = copyLibrary(document);
    next.tarnished.push(newEnemy(next.tarnished, mode));
    commit(next);
    setSelected(next.tarnished.length - 1);
    setView('overview');
  };
  const duplicateEntry = () => {
    if (!document || !selectedEntry) return;
    const next = copyLibrary(document);
    const duplicate = copyLibrary(selectedEntry);
    const base = `${duplicate.id}-copy`;
    let id = base;
    let suffix = 2;
    while (next.tarnished.some((entry) => entry.id === id)) id = `${base}-${suffix++}`;
    duplicate.id = id;
    duplicate.name = `${duplicate.name} Copy`;
    next.tarnished.splice(selected + 1, 0, duplicate);
    commit(next);
    setSelected(selected + 1);
  };
  const deleteEntry = () => {
    if (!document) return;
    const next = copyLibrary(document);
    next.tarnished.splice(selected, 1);
    commit(next);
    setSelected(Math.max(0, Math.min(selected, next.tarnished.length - 1)));
  };
  const newLibrary = async () => {
    const base = parseLibrary(await fetch(`${import.meta.env.BASE_URL}base.toml`).then((response) => response.text()));
    base.tarnished = [];
    resetHistory(base);
    setFilename('my-tarnished-library.toml');
    setSavedText('');
    message.success('New library created with the current shared settings.');
  };
  const openLibrary = async (file: File) => {
    try {
      const next = parseLibrary(await file.text());
      resetHistory(next);
      setFilename(file.name);
      setSavedText(serializeLibrary(next));
      message.success(`Opened ${file.name}`);
    } catch (error) { message.error(error instanceof Error ? error.message : 'Could not open that library.'); }
  };
  const download = () => {
    if (!document) return;
    const result = validateLibrary(document, gestures, catalog.size ? goodsLookup : undefined);
    if (result.errors.length) { setValidation(result); return; }
    const blob = new Blob([serialized], { type: 'application/toml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = filename.toLowerCase().endsWith('.toml') ? filename : `${filename}.toml`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSavedText(serialized);
    localStorage.removeItem(DRAFT_KEY);
    message.success('Library downloaded.');
  };
  const showValidation = () => setValidation(document ? validateLibrary(document, gestures, catalog.size ? goodsLookup : undefined) : null);
  const openRaw = () => { setRawText(serialized); setRawOpen(true); };
  const applyRaw = () => {
    try { commit(parseLibrary(rawText)); setRawOpen(false); message.success('Advanced TOML applied.'); }
    catch (error) { message.error(error instanceof Error ? error.message : 'The TOML could not be parsed.'); }
  };
  const replaceCatalog = async (files: File[]) => {
    try {
      setCatalogProgress('Reading selected resources…');
      const next = await loadCatalog(files);
      setCatalog(next);
      setCatalogProgress(`${next.size.toLocaleString()} items · icons ${next.database ? 'ready' : 'not found'}`);
      message.success('Item resources loaded for this browser session.');
    } catch (error) { message.error(error instanceof Error ? error.message : 'Could not load those resources.'); }
  };

  if (!document) return <div className="startup"><Spin size="large" /><Typography.Title level={3}>Opening Library Studio</Typography.Title><Typography.Text type="secondary">Loading the current Wayward Tarnished format…</Typography.Text></div>;

  const viewItems: { key: View; icon: ReactNode; label: string; hint: string }[] = [
    { key: 'overview', icon: <FormOutlined />, label: 'Overview', hint: 'Identity, availability and growth' },
    { key: 'equipment', icon: <ApartmentOutlined />, label: 'Equipment', hint: selectedEntry?.pool ? 'Random pool and consumables' : 'Level loadouts and consumables' },
    { key: 'behavior', icon: <TeamOutlined />, label: 'Names & behavior', hint: 'Names, AI styles and gestures' },
    { key: 'shared', icon: <SettingOutlined />, label: 'Shared settings', hint: 'Library-wide names, gestures, consumables' },
  ];
  const stats = [
    { label: 'Tarnished', value: entries.length, icon: <TeamOutlined /> },
    { label: 'Random pools', value: randomPools, icon: <ThunderboltOutlined /> },
    { label: 'Pool choices', value: poolChoices, icon: <ApartmentOutlined /> },
    { label: 'Catalog items', value: catalog.size, icon: <DatabaseOutlined /> },
  ];
  return (
    <Layout className="studio-shell">
      <Layout.Sider width={292} theme="light" className="studio-sider" breakpoint="lg" collapsedWidth={0} trigger={<MenuOutlined />}>
        <div className="brand-block"><div className="brand-mark">WT</div><div><Typography.Text strong>Library Studio</Typography.Text><Typography.Text type="secondary">Wayward Tarnished</Typography.Text></div></div>
        <Input.Search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Tarnished" allowClear className="sidebar-search" />
        <div className="library-label"><Typography.Text className="sidebar-label">TARNISHED LIBRARY</Typography.Text><Badge count={entries.length} color="#171717" /></div>
        <div className="enemy-list">
          <List
            dataSource={filteredEntries}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Tarnished found" /> }}
            renderItem={({ entry, index }) => (
              <button className={`enemy-list-item ${index === selected ? 'selected' : ''}`} onClick={() => { setSelected(index); if (view === 'shared') setView('overview'); }}>
                <span className="enemy-list-icon">{entry.pool ? <ThunderboltOutlined /> : <TeamOutlined />}</span>
                <span><strong>{entry.name}</strong><small>{entry.pool ? 'Random pool' : `${entry.gear?.length ?? 0} loadouts`} · {entry.id}</small></span>
              </button>
            )}
          />
        </div>
        <div className="create-actions"><Button icon={<PlusOutlined />} onClick={() => createEntry('gear')}>Fixed build</Button><Button type="primary" icon={<ThunderboltOutlined />} onClick={() => createEntry('pool')}>Random pool</Button></div>
        <div className="sider-footer">
          <div className="catalog-status"><DatabaseOutlined /><span><strong>Item resources</strong><small>{catalogProgress}</small></span></div>
          <Button block icon={<UploadOutlined />} onClick={() => catalogInput.current?.click()}>Replace resources</Button>
        </div>
      </Layout.Sider>
      <Layout className="main-layout">
        <header className="command-bar">
          <Breadcrumb items={view === 'shared' ? [{ title: 'Library Studio' }, { title: 'Shared settings' }] : [{ title: 'Library Studio' }, { title: selectedEntry?.name ?? 'Library' }, { title: viewItems.find((item) => item.key === view)?.label }]} />
          <Space wrap>
            <Button type="text" icon={<UndoOutlined />} disabled={!past.current.length} onClick={undo} aria-label="Undo" />
            <Button type="text" icon={<RedoOutlined />} disabled={!future.current.length} onClick={redo} aria-label="Redo" />
            <Button icon={<FileAddOutlined />} onClick={() => void newLibrary()}>New</Button>
            <Button icon={<FolderOpenOutlined />} onClick={() => fileInput.current?.click()}>Open</Button>
            <Button icon={<CodeOutlined />} onClick={openRaw}>Advanced TOML</Button>
            <Button icon={<CheckCircleOutlined />} onClick={showValidation}>Validate</Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={download}>Download TOML</Button>
          </Space>
        </header>
        <Layout.Content className="content-shell">
          <section className="page-intro">
            <div><Typography.Title>Build your Tarnished library</Typography.Title><Typography.Paragraph>Design fixed enemies and random class pools, then download a valid library file for the mod.</Typography.Paragraph></div>
            <div className="intro-side">
              <div className="stat-strip" aria-label="Library summary">
                {stats.map((stat) => <Tooltip key={stat.label} title={stat.label}><div className="stat-chip">{stat.icon}<strong>{stat.value.toLocaleString()}</strong><span>{stat.label}</span></div></Tooltip>)}
              </div>
              <Space><Tag color={dirty ? 'gold' : 'green'}>{dirty ? 'Unsaved browser draft' : 'Downloaded copy is current'}</Tag><Typography.Text type="secondary">{filename}</Typography.Text></Space>
            </div>
          </section>
          <nav className="workspace-tabs" role="tablist" aria-label="Workspace">
            {viewItems.map((item) => (
              <button key={item.key} role="tab" aria-selected={view === item.key} className={`workspace-tab ${view === item.key ? 'selected' : ''}`} onClick={() => setView(item.key)}>
                <span className="workspace-tab-icon">{item.icon}</span>
                <span><strong>{item.label}</strong><small>{item.hint}</small></span>
              </button>
            ))}
          </nav>
          <section className="work-surface">
            {view === 'shared' ? <SharedSettings document={document} catalog={catalog} gestures={gestures} onChange={commit} /> : selectedEntry ? <EnemyEditor entry={selectedEntry} view={view} catalog={catalog} gestureNames={gestures} styleNames={styleNames} sharedConsumables={document.consumables?.pool} onChange={updateEntry} onDuplicate={duplicateEntry} onDelete={deleteEntry} /> : <div className="empty-editor"><Empty description="Create a fixed build or random pool to begin" /><Space><Button onClick={() => createEntry('gear')}>Create fixed build</Button><Button type="primary" onClick={() => createEntry('pool')}>Create random pool</Button></Space></div>}
          </section>
        </Layout.Content>
      </Layout>
      <input ref={fileInput} type="file" accept=".toml,text/plain" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void openLibrary(file); event.target.value = ''; }} />
      <input ref={catalogInput} type="file" multiple hidden onChange={(event) => { if (event.target.files?.length) void replaceCatalog([...event.target.files]); event.target.value = ''; }} />
      <Modal open={rawOpen} title="Advanced TOML editor" width="min(1100px, 94vw)" onCancel={() => setRawOpen(false)} onOk={applyRaw} okText="Apply TOML">
        <Alert type="info" showIcon message="Complete library source" description="This editor covers templates, faces, styles, personalities, custom attributes and any future fields that do not yet have a visual form." />
        <Input.TextArea className="toml-editor" value={rawText} onChange={(event) => setRawText(event.target.value)} spellCheck={false} />
      </Modal>
      <Modal open={Boolean(validation)} title={validation?.errors.length ? 'Library needs corrections' : 'Library is valid'} onCancel={() => setValidation(null)} footer={<Button type="primary" onClick={() => setValidation(null)}>Close</Button>}>
        {validation && <><Alert type={validation.errors.length ? 'error' : 'success'} showIcon message={validation.errors.length ? `${validation.errors.length} error${validation.errors.length === 1 ? '' : 's'} found` : 'No blocking problems found'} description={validation.errors.length ? 'Correct these items before downloading.' : 'This file is ready for the mod’s deeper regulation check.'} />{validation.errors.map((error) => <Alert key={error} type="error" message={error} />)}{validation.warnings.map((warning) => <Alert key={warning} type="warning" message={warning} />)}</>}
      </Modal>
    </Layout>
  );
}

export default function App() {
  return (
    <ConfigProvider theme={{
      token: { colorPrimary: '#202020', colorText: '#191919', colorTextSecondary: '#6b6b6b', colorBgLayout: '#f3f3f1', colorBgContainer: '#ffffff', colorBorder: '#d8d8d5', borderRadius: 0, borderRadiusLG: 0, borderRadiusSM: 0, fontFamily: 'Inter, Segoe UI, Arial, sans-serif', controlHeight: 38 },
      components: { Button: { primaryShadow: 'none' }, Card: { headerBg: '#fafaf9' }, Menu: { itemSelectedBg: '#ededeb', itemSelectedColor: '#111111', itemHoverBg: '#f5f5f3' } },
    }}><AntApp><Studio /></AntApp></ConfigProvider>
  );
}
