import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Button, Dialog, IconButton } from './components/controls';
import { count } from './domain/model';
import type { Snapshot } from './domain/model';
import {
  contextOf,
  pendingOrders,
  unresolvedOperations,
} from './domain/snapshot';
import { newId } from './lib/id';
import { cashier, backupHistory, draftCache } from './bootstrap';
import { useDraft } from './hooks/useDraft';
import { validateSnapshot, encodeBackup } from './application/backup';
import { dailySnapshot } from './application/daily-backup';
import { download } from './presentation/download';
import { ordersCsv } from './presentation/orders-csv';
import { CloseDay } from './components/CloseDay';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useExclusiveTab } from './hooks/useExclusiveTab';
import { useLeaveConfirmation } from './hooks/useLeaveConfirmation';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { errorMessage } from './presentation/error-message';
import { festivalTitle } from './presentation/festival';
import { emptyDraft } from './ui';
import type { ActionHandler, CommandSaver, Handoff, Shared } from './ui';
import { Checkout } from './components/Checkout';
import { Help } from './components/Help';
import { History } from './components/History';
import { Icon } from './components/Icon';
import type { IconName } from './components/Icon';
import { Recovery } from './components/Recovery';
import { Settings } from './components/Settings';
import { Startup } from './components/Startup';
import { StorageWarning } from './components/StorageWarning';
const Summary = lazy(() =>
  import('./components/Summary').then((module) => ({
    default: module.Summary,
  })),
);
import { Waiting } from './components/Waiting';

type Screen = 'home' | 'checkout' | 'history' | 'summary' | 'settings';
const screens: { key: Screen; label: string; icon: IconName }[] = [
  { key: 'checkout', label: '会計', icon: 'cash' },
  { key: 'history', label: '注文履歴', icon: 'details' },
  { key: 'settings', label: '設定', icon: 'settings' },
];

const store = cashier;

/** Rejects a snapshot that would not survive a backup round trip. */
function checkedSnapshot(snapshot: Snapshot | null) {
  if (snapshot) validateSnapshot(snapshot);
  return snapshot;
}

export default function App() {
  const tabOwnership = useExclusiveTab();
  const online = useOnlineStatus();
  const [snapshot, setSnapshot] = useState<Snapshot | null | undefined>();
  const [started, setStarted] = useState(false);
  const [exportedBackup, setExportedBackup] = useState<Snapshot['meta'] | null>(
    null,
  );
  const [, backupChanged] = useState(0);
  const [screen, setScreen] = useState<Screen>('home');
  const [summaryVisited, setSummaryVisited] = useState(false);
  const [nextScreen, setNextScreen] = useState<Screen | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [summaryDirty, setSummaryDirty] = useState(false);
  const [lastHandoff, setLastHandoff] = useState<Handoff | null>(null);
  const [resumeOrderIds, setResumeOrderIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState(false);
  const [draft, setDraft] = useDraft(
    snapshot,
    draftCache,
    tabOwnership.state === 'owned',
  );
  const lock = useRef(false);
  const pendingBeforeAction = useRef<Set<string>>(new Set());
  const previousGeneration = useRef<string | null>(null);
  const update = useAppUpdate(setError);
  useLeaveConfirmation(
    settingsDirty ||
      summaryDirty ||
      count(draft.quantities) > 0 ||
      !!snapshot?.orders.some((order) => order.status === 'pending'),
  );

  function navigate(next: Screen) {
    if (next === screen) return;
    if (
      (screen === 'settings' && settingsDirty) ||
      (screen === 'summary' && summaryDirty)
    ) {
      setNextScreen(next);
      return;
    }
    if (next === 'summary') setSummaryVisited(true);
    setScreen(next);
  }

  useEffect(
    () =>
      store.watch({
        next: (next) => {
          try {
            setSnapshot(checkedSnapshot(next));
            setFatal(false);
          } catch (e) {
            setFatal(true);
            setError(errorMessage(e));
          }
        },
        error: (e) => {
          setError(errorMessage(e));
          setFatal(true);
        },
      }),
    [],
  );
  const discardLocalState = () => {
    setStarted(false);
    setScreen('home');
    setDraft(emptyDraft());
    setSettingsDirty(false);
    setSummaryDirty(false);
    setNextScreen(null);
  };
  useEffect(() => {
    if (!snapshot) return;
    if (
      previousGeneration.current &&
      previousGeneration.current !== snapshot.meta.generation
    )
      discardLocalState();
    previousGeneration.current = snapshot.meta.generation;
  }, [snapshot?.meta.generation]);

  const owned = tabOwnership.state === 'owned';
  const perform: ActionHandler = async (work) => {
    if (lock.current || !owned) return;
    lock.current = true;
    pendingBeforeAction.current = new Set(
      snapshot?.operations
        .filter((op) => op.status === 'pending')
        .map((op) => op.id) ?? [],
    );
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      try {
        setSnapshot(checkedSnapshot(await store.read()));
        setFatal(false);
      } catch (e) {
        setError(
          `保存結果を確認してください。入力や入金をやり直さず、保存状態を読み直してください。 ${errorMessage(e)}`,
        );
        setFatal(true);
      }
      lock.current = false;
      setBusy(false);
    }
  };
  const saveCommand: CommandSaver = async (command, id = newId()) => {
    if (!snapshot || fatal) throw new Error('保存状態を確認してください。');
    const context = contextOf(snapshot.meta);
    await store.prepare(id, context, command);
    return store.execute(id, context);
  };
  const restartSession = () => {
    discardLocalState();
    setScreen('home');
    setLastHandoff(null);
  };
  const exportBackup = async () => {
    const current = await store.read();
    if (!current) throw new Error('営業の記録がありません。');
    const text = encodeBackup(dailySnapshot(current));
    download(text, `${current.meta.day}-yakitori.json`);
    return current;
  };
  const exportDailyFiles = async () => {
    const current = await store.read();
    if (!current) throw new Error('営業の記録がありません。');
    const daily = dailySnapshot(current);
    const json = encodeBackup(daily);
    const csv = ordersCsv(daily);
    download(json, `${current.meta.day}-yakitori.json`);
    download(csv, `${current.meta.day}-yakitori.csv`, 'text/csv;charset=utf-8');
    setExportedBackup(current.meta);
    return current;
  };
  const shared: Shared | null = snapshot
    ? {
        perform,
        saveCommand,
        busy,
        errorMessage: error,
        context: contextOf(snapshot.meta),
      }
    : null;
  // While saving, show only operations that were already pending before this action.
  const unresolved = snapshot
    ? unresolvedOperations(snapshot).filter(
        (op) => !busy || pendingBeforeAction.current.has(op.id),
      )
    : [];
  const hasDraft = count(draft.quantities) > 0;
  const locked = busy || fatal || !owned;
  const unfinished =
    settingsDirty ||
    summaryDirty ||
    hasDraft ||
    !!snapshot?.orders.some((o) => o.status === 'pending') ||
    !!snapshot?.operations.some((op) => op.status === 'pending');
  const updateBlocked = locked || snapshot === undefined || unfinished;
  return (
    <>
      <header className="app-header">
        <a
          href="#main"
          className="brand"
          aria-label="焼き鳥人間・会計へ戻る"
          onClick={(event) => {
            event.preventDefault();
            if (!locked) navigate(started ? 'checkout' : 'home');
          }}
        >
          <h1 className="sr-only">焼き鳥人間</h1>
          <img
            className="brand-logo"
            src="/assets/logo-brush.webp"
            alt=""
            width="640"
            height="230"
          />
        </a>
        {started && snapshot && screen !== 'home' && screen !== 'summary' && (
          <nav className="tabs" aria-label="画面の切り替え">
            {screens.map((item) => (
              <Button
                variant="secondary"
                key={item.key}
                disabled={locked}
                className={screen === item.key ? 'active' : ''}
                aria-current={screen === item.key ? 'page' : undefined}
                onClick={() => navigate(item.key)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Button>
            ))}
          </nav>
        )}
        <div className="header-status">
          {screen !== 'home' && (
            <Button
              variant="plain"
              aria-label="ホームへ戻る"
              title="ホームへ戻る"
              disabled={locked}
              onClick={() => navigate('home')}
            >
              <Icon name="home" />
              ホーム
            </Button>
          )}
          <span
            className="connection-status"
            title={
              online
                ? 'インターネットに接続しています。記録はこのPCに保存され、他の端末とは同期しません。'
                : 'インターネット未接続です。会計は続けられ、記録はこのPCに保存されます。'
            }
            aria-label={
              online ? 'オンライン・端末間同期なし' : 'オフライン・このPCに保存'
            }
          >
            <Icon name={online ? 'wifi' : 'offline'} />
            <span>{online ? 'オンライン' : 'オフライン'}</span>
          </span>
          <IconButton
            className="icon-button"
            onClick={() => setHelpOpen(true)}
            label="このアプリについて"
            icon="help"
          />
        </div>
      </header>
      <StorageWarning
        blocked={unfinished || locked || screen === 'home'}
        busy={busy}
        errorMessage={error}
        onBackup={
          snapshot
            ? () =>
                perform(async () => {
                  await exportBackup();
                })
            : undefined
        }
      />
      <Help open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Dialog
        open={nextScreen !== null}
        onClose={() => setNextScreen(null)}
        title="変更が保存されていません"
        footer={
          <>
            <Button onClick={() => setNextScreen(null)}>編集に戻る</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (nextScreen) setScreen(nextScreen);
                setNextScreen(null);
              }}
            >
              未保存のまま移動
            </Button>
          </>
        }
      >
        <p>
          入力内容は残ります。変更を反映するには、元の画面で保存してください。
        </p>
      </Dialog>
      <main id="main">
        {tabOwnership.state === 'blocked' && (
          <div className="error-banner" role="alert">
            <strong>別の画面で使用中です</strong>
            <p>
              同じブラウザで開いている会計画面を閉じてから、この画面で再確認してください。
            </p>
            <Button className="secondary" onClick={tabOwnership.retry}>
              この画面で再確認
            </Button>
          </div>
        )}
        {tabOwnership.state === 'unsupported' && (
          <div className="error-banner" role="alert">
            <strong>このブラウザでは同時利用を防げません</strong>
            <p>ChromeまたはEdgeの通常のウィンドウで開いてください。</p>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <strong>
              {fatal
                ? '保存状態を確認できません'
                : '操作を完了できませんでした'}
            </strong>
            <p>{error}</p>
            <Button
              className="secondary"
              onClick={() => perform(async () => {})}
            >
              保存状態を読み直す
            </Button>
          </div>
        )}
        {update.needRefresh && (
          <div className="notice update-notice">
            <strong>アプリの更新があります</strong>
            <span>
              記録を残して画面を更新します。バックアップの読み込みは不要です。
            </span>
            <IconButton
              icon="refresh"
              label="更新する"
              variant="secondary"
              disabled={updateBlocked}
              onClick={() => {
                setBusy(true);
                void update.applyUpdate().catch(() => {
                  setBusy(false);
                  setError(
                    '更新できませんでした。接続を確認して、もう一度お試しください。',
                  );
                });
              }}
            />
          </div>
        )}
        <fieldset className="app-content" disabled={locked} aria-busy={busy}>
          {snapshot === undefined ? (
            <p className="loading">保存状態を確認しています…</p>
          ) : (
            <>
              {screen === 'home' && (
                <Startup
                  key={snapshot?.meta.generation ?? 'empty'}
                  snapshot={snapshot}
                  store={store}
                  perform={perform}
                  errorMessage={error}
                  onStart={() => {
                    if (!started)
                      setResumeOrderIds(
                        snapshot
                          ? pendingOrders(snapshot).map((o) => o.id)
                          : [],
                      );
                    setStarted(true);
                    setScreen('checkout');
                  }}
                  onSummary={() => navigate('summary')}
                  onRestart={restartSession}
                  exportBackup={exportBackup}
                  hasDraft={hasDraft || settingsDirty || summaryDirty}
                />
              )}
              {screen !== 'home' && snapshot && shared && (
                <div className="session-bar">
                  <strong>{festivalTitle(snapshot)}</strong>
                  <div className="session-actions">
                    <span role="status">{busy ? '保存中…' : ''}</span>
                    <IconButton
                      icon="refresh"
                      label="注文と札の記録を更新"
                      disabled={busy}
                      onClick={() => perform(async () => {})}
                    />
                    {screen !== 'summary' && (
                      <CloseDay
                        snapshot={snapshot}
                        store={store}
                        lastBackupSequence={backupHistory.lastSequence(
                          snapshot.meta,
                        )}
                        blocked={unfinished}
                        exported={exportedBackup}
                        onConfirmBackup={(meta) => {
                          backupHistory.record(meta);
                          backupChanged((version) => version + 1);
                        }}
                        onFinish={restartSession}
                        exportBackup={exportDailyFiles}
                        {...shared}
                      />
                    )}
                  </div>
                </div>
              )}
              {started && snapshot && shared && (
                <div hidden={screen === 'home' || screen === 'summary'}>
                  <Recovery
                    operations={unresolved}
                    snapshot={snapshot}
                    store={store}
                    draft={draft}
                    setDraft={setDraft}
                    {...shared}
                  />
                  <div hidden={screen !== 'checkout'}>
                    <div className="counter-layout">
                      <Checkout
                        snapshot={snapshot}
                        draft={draft}
                        setDraft={setDraft}
                        store={store}
                        resumeOrderIds={resumeOrderIds}
                        {...shared}
                      />
                      <Waiting
                        snapshot={snapshot}
                        lastHandoff={lastHandoff}
                        onHandoffChange={setLastHandoff}
                        {...shared}
                      />
                    </div>
                  </div>
                  {screen === 'history' && (
                    <History snapshot={snapshot} store={store} {...shared} />
                  )}
                  <div hidden={screen !== 'settings'}>
                    <Settings
                      snapshot={snapshot}
                      store={store}
                      onRestart={restartSession}
                      hasDraft={hasDraft}
                      exportBackup={exportBackup}
                      onDirtyChange={setSettingsDirty}
                      {...shared}
                    />
                  </div>
                </div>
              )}
              {(screen === 'summary' || summaryVisited) && (
                <div hidden={screen !== 'summary'}>
                  <Suspense
                    fallback={<p className="loading">集計を開いています…</p>}
                  >
                    <Summary
                      key={`${snapshot?.meta.databaseId ?? 'empty'}:${snapshot?.meta.generation ?? ''}`}
                      snapshot={snapshot}
                      perform={perform}
                      saveCommand={saveCommand}
                      busy={busy}
                      onDirtyChange={setSummaryDirty}
                    />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </fieldset>
      </main>
    </>
  );
}
