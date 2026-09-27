import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert, App as AntApp, Avatar, Badge, Breadcrumb, Button, Card, ConfigProvider, Empty, Flex,
  Input, Layout, Listy, Modal, Space, Spin, Statistic, Tag, Tooltip, Typography,
} from 'antd';
import {
  ApartmentOutlined, AppstoreOutlined, CheckCircleOutlined, CodeOutlined, DownloadOutlined,
  FileAddOutlined, FolderOpenOutlined, FormOutlined, PlusOutlined, RedoOutlined,
  MenuOutlined, RobotOutlined, SettingOutlined, TeamOutlined, ThunderboltOutlined, ToolOutlined, UndoOutlined,
} from '@ant-design/icons';
import { ItemCatalog, loadBundledCatalog } from './catalog';
import { archetypes as listArchetypes, copyLibrary, newEnemy, parseLibrary, poolChoiceCount, serializeLibrary, validateLibrary, type GoodsLookup } from './library';
import { loadRules, mergeLibraries, type Rules } from './simulate';
import type { Consumable, ItemKind, LibraryDocument, Tarnished, ValidationResult } from './types';
import { EnemyEditor } from './components/EnemyEditor';
import { SharedSettings } from './components/SharedSettings';
import { PersonalitiesEditor } from './components/PersonalitiesEditor';
import './styles.css';

type View = 'overview' | 'equipment' | 'behavior' | 'personalities' | 'shared';
const DRAFT_KEY = 'wayward-tarnished-library-studio-draft-v2';

function Studio() {
  const { message } = AntApp.useApp();
  const [document, setDocument] = useState<LibraryDocument | null>(null);
  const [catalog, setCatalog] = useState(new ItemCatalog());
  const [rules, setRules] = useState<Rules>();
  const [gestures, setGestures] = useState<string[]>([]);
  // The mod loads its base.toml first, so a library inherits its consumables, styles and personalities.
  const [baseDocument, setBaseDocument] = useState<LibraryDocument>();
  const basePool: Consumable[] = baseDocument?.consumables?.pool ?? [];
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<View>('overview');
  const [search, setSearch] = useState('');
  const [filename, setFilename] = useState('wayward-tarnished-library.toml');
  const [savedText, setSavedText] = useState('');
  const [rawOpen, setRawOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [includeBaseChoice, setIncludeBaseChoice] = useState<boolean>();
  const past = useRef<LibraryDocument[]>([]);
  const future = useRef<LibraryDocument[]>([]);
  const documentRef = useRef<LibraryDocument | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { documentRef.current = document; }, [document]);
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}base.toml`, { cache: 'no-cache' }).then((response) => response.text()),
      fetch(`${import.meta.env.BASE_URL}gestures.txt`, { cache: 'no-cache' }).then((response) => response.text()),
    ]).then(([base, gestureText]) => {
      const gestureNames = gestureText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      setGestures(gestureNames);
      const draft = localStorage.getItem(DRAFT_KEY);
      const baseDocument = parseLibrary(base);
      setBaseDocument(baseDocument);
      const draftDocument = draft ? parseLibrary(draft) : null;
      const hasRealDraft = Boolean(draftDocument && serializeLibrary(draftDocument) !== serializeLibrary(baseDocument));
      const loaded = hasRealDraft ? draftDocument! : baseDocument;
      setDocument(loaded);
      const text = serializeLibrary(loaded);
      setSavedText(hasRealDraft ? '' : text);
      if (hasRealDraft) message.info('Your browser draft was restored.'); else localStorage.removeItem(DRAFT_KEY);
    }).catch((error: unknown) => message.error(error instanceof Error ? error.message : 'Could not load the base library.'));
    loadBundledCatalog().then(setCatalog).catch((error: unknown) => message.error(error instanceof Error ? error.message : 'Could not load item names and icons.'));
    loadRules().then(setRules).catch((error: unknown) => message.error(error instanceof Error ? error.message : 'Could not load the item rules for test builds.'));
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
  const serialized = useMemo(() => document ? serializeLibrary(document) : '', [document]);
  const dirty = Boolean(document && serialized !== savedText);
  const goodsLookup = useCallback<GoodsLookup>((id) => {
    const item = catalog.get('goods', id);
    return item ? { name: item.name, usable: !catalog.hasAiUse || Number(item.aiUseJudgeId) > 0, limit: catalog.stackLimit(id) } : undefined;
  }, [catalog]);
  const validationOptions = () => ({
    gestures,
    base: baseDocument,
    goods: catalog.size ? goodsLookup : undefined,
    isDlcItem: catalog.size ? (kind: ItemKind, id: number) => Boolean(catalog.get(kind, id)?.dlc) : undefined,
  });
  // A file that holds every base.toml entry is a replacement for it, so its odds leave base.toml's Tarnished out.
  const replacesBase = Boolean(baseDocument && document && baseDocument.tarnished.every((base) => document.tarnished.some((entry) => entry.id === base.id)));
  const includeBase = includeBaseChoice ?? !replacesBase;
  const library = useMemo(() => mergeLibraries(document ?? { tarnished: [] }, baseDocument, includeBase), [document, baseDocument, includeBase]);
  const archetypes = useMemo(() => (document ? listArchetypes(document, baseDocument) : []), [document, baseDocument]);

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
    const base = parseLibrary(await fetch(`${import.meta.env.BASE_URL}base.toml`, { cache: 'no-cache' }).then((response) => response.text()));
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
    const result = validateLibrary(document, validationOptions());
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
  const showValidation = () => setValidation(document ? validateLibrary(document, validationOptions()) : null);
  const openRaw = () => { setRawText(serialized); setRawOpen(true); };
  const applyRaw = () => {
    try { commit(parseLibrary(rawText)); setRawOpen(false); message.success('Advanced TOML applied.'); }
    catch (error) { message.error(error instanceof Error ? error.message : 'The TOML could not be parsed.'); }
  };

  if (!document) return <div className="startup"><Spin size="large" /><Typography.Title level={3}>Opening Library Studio</Typography.Title><Typography.Text type="secondary">Loading the current Wayward Tarnished format…</Typography.Text></div>;

  const viewItems: { key: View; icon: ReactNode; label: string; hint: string }[] = [
    { key: 'overview', icon: <FormOutlined />, label: 'Overview', hint: 'Identity, roles, how often it appears, attributes and stat plans' },
    { key: 'equipment', icon: <ApartmentOutlined />, label: 'Equipment', hint: selectedEntry?.pool ? 'Random item pool and consumables' : 'Level loadouts and consumables' },
    { key: 'behavior', icon: <TeamOutlined />, label: 'Names & gestures', hint: 'Names, titles, greetings and victories' },
    { key: 'personalities', icon: <RobotOutlined />, label: 'AI personalities', hint: 'Fighting styles and custom personalities' },
    { key: 'shared', icon: <SettingOutlined />, label: 'Shared settings', hint: 'Appearance odds, shared names, gestures and consumables for the whole library' },
  ];
  const fixedBuilds = entries.filter((entry) => !entry.pool).length;
  const classLibraries = entries.filter((entry) => entry.pool).length;
  const disabled = entries.filter((entry) => entry.enabled === false).length;
  const poolItems = entries.reduce((count, entry) => count + poolChoiceCount(entry.pool), 0);
  const stats = [
    { label: 'Tarnished entries', value: entries.length, icon: <TeamOutlined />, help: `Every Tarnished defined in this file: fixed builds and class libraries together${disabled ? ` (${disabled} disabled)` : ''}. Each one can appear many times, as different people.` },
    { label: 'Fixed builds', value: fixedBuilds, icon: <ToolOutlined />, help: 'Entries with hand-made loadouts by level: the gear you pick, with options per slot, that changes as the player levels up.' },
    { label: 'Class libraries', value: classLibraries, icon: <ThunderboltOutlined />, help: 'Entries that draw random gear from item pools each time one appears, like the Strength or Faith classes. Shown as “Random pool” in the list.' },
    { label: 'Pool items', value: poolItems, icon: <AppstoreOutlined />, help: 'All weapons, catalysts, armor sets, talismans, spells and Ashes of War the class libraries can draw from, added up.' },
    { label: 'AI styles', value: archetypes.length, icon: <RobotOutlined />, help: 'Vanilla styles and custom personalities this file can give its Tarnished, including those it inherits from the mod’s base.toml.' },
  ];
  const command = (title: string, button: ReactNode) => <Tooltip title={title} placement="bottom">{button}</Tooltip>;
  return (
    <Layout className="studio-shell">
      <Layout.Sider width={292} theme="light" className="studio-sider" breakpoint="lg" collapsedWidth={0} trigger={<MenuOutlined />}>
        <Flex align="center" gap={11} className="brand-block">
          <Avatar shape="square" size={42} className="brand-mark">WT</Avatar>
          <Flex vertical><Typography.Text strong>Library Studio</Typography.Text><Typography.Text type="secondary">Wayward Tarnished</Typography.Text></Flex>
        </Flex>
        <Input.Search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Tarnished" allowClear className="sidebar-search" />
        <Flex justify="space-between" align="center" className="library-label"><Typography.Text className="sidebar-label">TARNISHED LIBRARY</Typography.Text><Badge count={entries.length} color="#171717" showZero /></Flex>
        <div className="enemy-list">
          {filteredEntries.length ? (
            <Listy
              items={filteredEntries}
              rowKey={(item) => item.index}
              virtual={false}
              classNames={{ item: 'plain-listy-item' }}
              itemRender={({ entry, index }) => (
                <Flex align="center" gap={10} role="button" tabIndex={0} className={`enemy-item ${index === selected ? 'selected' : ''} ${entry.enabled === false ? 'disabled' : ''}`} onClick={() => { setSelected(index); if (view === 'shared') setView('overview'); }} onKeyDown={(event) => { if (event.key === 'Enter') { setSelected(index); if (view === 'shared') setView('overview'); } }}>
                  <Avatar shape="square" size={30} icon={entry.pool ? <ThunderboltOutlined /> : <TeamOutlined />} className="enemy-item-icon" />
                  <Flex vertical className="enemy-item-copy">
                    <Typography.Text strong ellipsis className="enemy-item-name">{entry.name}</Typography.Text>
                    <Typography.Text type="secondary" ellipsis className="enemy-item-detail">{`${entry.pool ? 'Random pool' : `${entry.gear?.length ?? 0} loadouts`}${entry.chance !== undefined ? ` · ${entry.chance}%` : ''}${entry.enabled === false ? ' · disabled' : ''} · ${entry.id}`}</Typography.Text>
                  </Flex>
                </Flex>
              )}
            />
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Tarnished found" />}
        </div>
        <div className="create-actions">
          <Tooltip title="A Tarnished with hand-made loadouts by level"><Button icon={<PlusOutlined />} onClick={() => createEntry('gear')}>Fixed build</Button></Tooltip>
          <Tooltip title="A class library: random gear drawn from item pools each time"><Button type="primary" icon={<ThunderboltOutlined />} onClick={() => createEntry('pool')}>Random pool</Button></Tooltip>
        </div>
      </Layout.Sider>
      <Layout className="main-layout">
        <header className="command-bar">
          <Breadcrumb items={view === 'shared' || (view === 'personalities' && !selectedEntry) ? [{ title: 'Library Studio' }, { title: viewItems.find((item) => item.key === view)?.label }] : [{ title: 'Library Studio' }, { title: selectedEntry?.name ?? 'Library' }, { title: viewItems.find((item) => item.key === view)?.label }]} />
          <Space wrap>
            {command('Undo the last change', <Button type="text" icon={<UndoOutlined />} disabled={!past.current.length} onClick={undo} aria-label="Undo" />)}
            {command('Redo the change you undid', <Button type="text" icon={<RedoOutlined />} disabled={!future.current.length} onClick={redo} aria-label="Redo" />)}
            {command('Create a new library: keeps the mod’s shared settings, starts with no Tarnished', <Button icon={<FileAddOutlined />} onClick={() => void newLibrary()}>New</Button>)}
            {command('Open a library .toml file from your computer', <Button icon={<FolderOpenOutlined />} onClick={() => fileInput.current?.click()}>Open</Button>)}
            {command('View and edit the complete TOML source, including templates, faces and fields without a form', <Button icon={<CodeOutlined />} onClick={openRaw}>Advanced TOML</Button>)}
            {command('Check the library for errors and warnings before you install it', <Button icon={<CheckCircleOutlined />} onClick={showValidation}>Validate</Button>)}
            {command('Validate, then save the library as a .toml file for WaywardTarnished\\library\\ next to the mod', <Button type="primary" icon={<DownloadOutlined />} onClick={download}>Download TOML</Button>)}
          </Space>
        </header>
        <Layout.Content className="content-shell">
          <section className="page-intro">
            <div><Typography.Title>Build your Tarnished library</Typography.Title><Typography.Paragraph>Design fixed enemies and random class pools, test how they turn out, then download a valid library file for the mod.</Typography.Paragraph></div>
            <div className="intro-side">
              <Flex wrap gap={8} className="stat-cards" aria-label="Library summary">
                {stats.map((stat) => (
                  <Tooltip key={stat.label} title={stat.help}>
                    <Card size="small" className="stat-card"><Statistic title={stat.label} value={stat.value} prefix={stat.icon} /></Card>
                  </Tooltip>
                ))}
              </Flex>
              <Space>
                <Tooltip title={dirty ? 'Your changes are kept in this browser until you download the file' : 'Nothing changed since you opened or downloaded this file'}><Tag color={dirty ? 'gold' : 'green'}>{dirty ? 'Unsaved browser draft' : 'Downloaded copy is current'}</Tag></Tooltip>
                <Typography.Text type="secondary">{filename}</Typography.Text>
              </Space>
            </div>
          </section>
          <Card
            className="work-surface"
            activeTabKey={view}
            onTabChange={(key) => setView(key as View)}
            tabList={viewItems.map((item) => ({ key: item.key, label: <Tooltip title={item.hint} mouseEnterDelay={0.4}><span>{item.icon}<span className="tab-label">{item.label}</span></span></Tooltip> }))}
            styles={{ body: { padding: 0 } }}
          >
            {view === 'personalities' ? <PersonalitiesEditor document={document} base={baseDocument} selected={selectedEntry ? selected : undefined} onChange={commit} />
              : view === 'shared' ? <SharedSettings document={document} catalog={catalog} gestures={gestures} basePool={basePool} library={library} includeBase={includeBase} onIncludeBase={setIncludeBaseChoice} rules={rules} archetypes={archetypes} onChange={commit} />
              : selectedEntry ? <EnemyEditor entry={selectedEntry} view={view} catalog={catalog} gestureNames={gestures} sharedConsumables={document.consumables?.pool?.length ? document.consumables.pool : basePool} sharedKinds={document.consumables?.kinds ?? baseDocument?.consumables?.kinds} library={library} rules={rules} archetypes={archetypes} onChange={updateEntry} onDuplicate={duplicateEntry} onDelete={deleteEntry} />
              : <div className="empty-editor"><Empty description="Create a fixed build or random pool to begin" /><Space><Button onClick={() => createEntry('gear')}>Create fixed build</Button><Button type="primary" onClick={() => createEntry('pool')}>Create random pool</Button></Space></div>}
          </Card>
        </Layout.Content>
      </Layout>
      <input ref={fileInput} type="file" accept=".toml,text/plain" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void openLibrary(file); event.target.value = ''; }} />
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
      components: { Button: { primaryShadow: 'none' }, Card: { headerBg: '#fafaf9' }, Select: { optionSelectedBg: '#e6e6e3', optionSelectedColor: '#111111', optionActiveBg: '#f3f3f1' }, Menu: { itemSelectedBg: '#ededeb', itemSelectedColor: '#111111', itemHoverBg: '#f5f5f3' }, Statistic: { contentFontSize: 20, titleFontSize: 12 } },
    }}><AntApp><Studio /></AntApp></ConfigProvider>
  );
}
