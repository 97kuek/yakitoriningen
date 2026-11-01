import { IconButton, Button } from './components/controls';
import { useEffect, useRef, useState } from 'react';
import { ZodError } from 'zod';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { count, emptyQuantities } from './domain/model';
import { newId } from './lib/id';

import type { Snapshot } from './domain/model';
import { canonical } from './application/serialization';
import { cashier } from './bootstrap';
import { useExclusiveTab } from './useExclusiveTab';
import { encodeBackup } from './application/backup';
import type { ActionHandler, CommandSaver, Shared } from './ui';
import { Recovery } from './components/Recovery';
import { Checkout } from './components/Checkout';
import type { Draft } from './components/Checkout';
import { Waiting } from './components/Waiting';
import { Startup } from './components/Startup';
import { History } from './components/History';
import { Settings } from './components/Settings';
import type { SettingsSection } from './components/Settings';
import { Icon } from './components/Icon';
import type { IconName } from './components/Icon';
import { Help } from './components/Help';

const store = cashier;
function errorText(error: unknown) {
  if (error instanceof SyntaxError)
    return 'バックアップを読み取れません。保存したファイルを選び直してください。';
  if (error instanceof ZodError)
    return '入力内容かバックアップファイルを確認してください。';
  if (!(error instanceof Error))
    return '記録を確認できません。入力し直さず、保存状態を読み直してください。';
  if (error.name === 'QuotaExceededError')
    return '保存できる空き容量がありません。会計を止め、バックアップを確認してください。';
  if (
    /^(UnknownError|OpenFailedError|DatabaseClosedError|InvalidStateError|AbortError|VersionError)$/.test(
      error.name,
    )
  )
    return '記録を保存・確認できません。入力し直さず、保存状態を読み直してください。';
  if (error.message.startsWith('バックアップが不整合'))
    return 'バックアップの内容が一致しません。別のバックアップを選んでください。';
  return error.message
    .replace(
      '保存先または世代が変わりました。',
      '保存データが切り替わりました。',
    )
    .replace(
      '同じ操作IDで異なる入力は保存できません。',
      '前回の記録と内容が異なります。画面を開き直して確認してください。',
    )
    .replaceAll('確定操作ID', '会計の確認番号')
    .replaceAll('世代', '保存データ')
    .replaceAll('DB', '記録')
    .replaceAll('価格の版', '価格設定')
    .replaceAll('照合', '確認');
}
export default function App() {
  const tabOwnership = useExclusiveTab();
  const [snapshot, setSnapshot] = useState<Snapshot | null | undefined>();
  const [started, setStarted] = useState(false);
  const [tab, setTab] = useState('会計');
  const [settingsInitial, setSettingsInitial] =
    useState<SettingsSection>('price');
  const [helpOpen, setHelpOpen] = useState(false);
  const [lastHandoff, setLastHandoff] = useState<{
    orderId: string;
    completionId: string;
  } | null>(null);
  const [resumeOrderIds, setResumeOrderIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [draft, setDraft] = useState<Draft>({
    quantities: emptyQuantities(),
    price: null,
  });
  const [verifiedBackup, setVerifiedBackup] = useState<Snapshot | null>(null);
  const lock = useRef(false);
  const pendingBeforeAction = useRef<Set<string>>(new Set());
  const previousGeneration = useRef<string | null>(null);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () =>
      setError(
        'オフライン起動の準備を確認できません。営業前に再接続して確認してください。',
      ),
  });
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const checkForUpdates = () => {
      if (!navigator.onLine || document.visibilityState !== 'visible') return;
      void navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.update())
        .catch(() => {
          /* A failed update check must not interrupt the current sale. */
        });
    };
    window.addEventListener('focus', checkForUpdates);
    window.addEventListener('online', checkForUpdates);
    document.addEventListener('visibilitychange', checkForUpdates);
    const interval = window.setInterval(checkForUpdates, 60_000);
    return () => {
      window.removeEventListener('focus', checkForUpdates);
      window.removeEventListener('online', checkForUpdates);
      document.removeEventListener('visibilitychange', checkForUpdates);
      window.clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    const subscription = store.watch({
      next: (next) => {
        try {
          if (next) encodeBackup(next);
          setSnapshot(next);
          setFatal(false);
        } catch (e) {
          setFatal(true);
          setError(errorText(e));
        }
      },
      error: (e) => {
        setError(errorText(e));
        setFatal(true);
      },
    });
    const network = () => setOnline(navigator.onLine);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    return () => {
      subscription();
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
    };
  }, []);
  useEffect(() => {
    if (!snapshot) return;
    if (
      previousGeneration.current &&
      previousGeneration.current !== snapshot.meta.generation
    ) {
      setStarted(false);
      setDraft({ quantities: emptyQuantities(), price: null });
      setVerifiedBackup(null);
    }
    previousGeneration.current = snapshot.meta.generation;
  }, [snapshot?.meta.generation]);
  const perform: ActionHandler = async (work) => {
    if (lock.current || tabOwnership.state !== 'owned') return;
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
      setError(errorText(e));
    } finally {
      try {
        const next = await store.read();
        if (next) encodeBackup(next);
        setSnapshot(next);
        setFatal(false);
      } catch (e) {
        setError(
          `保存結果を確認してください。入力や入金をやり直さず、保存状態を読み直してください。 ${errorText(e)}`,
        );
        setFatal(true);
      }
      lock.current = false;
      setBusy(false);
    }
  };
  const saveCommand: CommandSaver = async (command, id = newId()) => {
    if (!snapshot || fatal) throw new Error('保存状態を確認してください。');
    const context = {
      databaseId: snapshot.meta.databaseId,
      generation: snapshot.meta.generation,
    };
    await store.prepare(id, context, command);
    return store.execute(id, context);
  };
  const resetAfterRestore = () => {
    setStarted(false);
    setTab('会計');
    setDraft({ quantities: emptyQuantities(), price: null });
    setVerifiedBackup(null);
    setLastHandoff(null);
  };
  const shared: Shared | null = snapshot
    ? {
        perform,
        saveCommand,
        busy,
        errorMessage: error,
        context: {
          databaseId: snapshot.meta.databaseId,
          generation: snapshot.meta.generation,
        },
      }
    : null;
  const unresolved =
    snapshot?.operations.filter(
      (op) =>
        op.status === 'pending' &&
        (!busy || pendingBeforeAction.current.has(op.id)) &&
        !(
          op.command.type === 'pay' &&
          snapshot.orders.some(
            (o) => o.status === 'pending' && o.confirmOperationId === op.id,
          )
        ),
    ) ?? [];
  return (
    <>
      <header className="app-header">
        <a href="#main" className="brand">
          <img src="/assets/shop-logo.png" alt="" width="232" height="58" />
          <h1 className="sr-only">焼き鳥人間</h1>
        </a>
        {started && snapshot && (
          <nav className="tabs" aria-label="画面の切り替え">
            {(
              [
                { key: '会計', label: '会計', icon: 'cash' },
                { key: '履歴・集計', label: '注文履歴', icon: 'chart' },
                { key: '設定・データ', label: '設定', icon: 'settings' },
              ] as { key: string; label: string; icon: IconName }[]
            ).map((item) => (
              <Button
                variant="secondary"
                type="button"
                key={item.key}
                disabled={busy || fatal || tabOwnership.state !== 'owned'}
                className={tab === item.key ? 'active' : ''}
                aria-current={tab === item.key ? 'page' : undefined}
                onClick={() => {
                  setTab(item.key);
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Button>
            ))}
          </nav>
        )}
        <div className="header-status">
          <span
            className="connection-status"
            title={online ? 'オンライン' : 'オフライン'}
            aria-label={online ? 'オンライン' : 'オフライン'}
          >
            <Icon name={online ? 'wifi' : 'offline'} />
          </span>
          <span
            className={`storage-status${offlineReady || navigator.serviceWorker?.controller ? ' ready' : ''}`}
            title={
              offlineReady || navigator.serviceWorker?.controller
                ? 'オフライン起動の準備済み'
                : 'オフライン起動は要確認'
            }
          >
            <Icon name="shield" />
            <span>
              {offlineReady || navigator.serviceWorker?.controller
                ? '通信なしOK'
                : '準備中'}
            </span>
          </span>
          <IconButton
            variant="plain"
            type="button"
            className="icon-button"
            onClick={() => setHelpOpen(true)}
            label="使い方"
            icon="help"
          />
        </div>
      </header>
      <Help open={helpOpen} onClose={() => setHelpOpen(false)} />
      <main id="main">
        {tabOwnership.state === 'blocked' && (
          <div className="error-banner" role="alert">
            <strong>別の画面で使用中です</strong>
            <p>
              同じブラウザで開いている会計画面を閉じてから、この画面で再確認してください。
            </p>
            <Button
              variant="secondary"
              type="button"
              className="secondary"
              onClick={tabOwnership.retry}
            >
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
              variant="secondary"
              type="button"
              className="secondary"
              onClick={() => perform(async () => {})}
            >
              保存状態を読み直す
            </Button>
          </div>
        )}
        {needRefresh && (
          <div className="notice update-notice">
            <strong>アプリの更新があります</strong>
            <span>
              会計が終わったら、記録を保存・確認してから更新してください。
            </span>
            <IconButton
              icon="refresh"
              label="更新する"
              variant="secondary"
              disabled={
                tabOwnership.state !== 'owned' ||
                !snapshot ||
                count(draft.quantities) > 0 ||
                snapshot.orders.some((o) => o.status === 'pending') ||
                snapshot.operations.some((op) => op.status === 'pending') ||
                canonical(snapshot) !== canonical(verifiedBackup)
              }
              onClick={() => {
                void updateServiceWorker(true);
              }}
            />
          </div>
        )}
        <fieldset
          className="app-content"
          disabled={busy || fatal || tabOwnership.state !== 'owned'}
          aria-busy={busy}
        >
          {snapshot === undefined ? (
            <p className="loading">保存状態を確認しています…</p>
          ) : !started || !snapshot || !shared ? (
            <Startup
              key={snapshot?.meta.generation ?? 'empty'}
              snapshot={snapshot}
              store={store}
              perform={perform}
              errorMessage={error}
              onStart={() => {
                setResumeOrderIds(
                  snapshot?.orders
                    .filter((o) => o.status === 'pending')
                    .map((o) => o.id) ?? [],
                );
                setStarted(true);
              }}
              onRestored={resetAfterRestore}
              onVerified={setVerifiedBackup}
            />
          ) : (
            <>
              <div className="session-bar">
                <div>
                  <strong>{snapshot.meta.event}</strong>
                  <span>営業日 {snapshot.meta.day}</span>
                </div>
                <span>
                  保存済み{' '}
                  {snapshot.orders.filter((o) => o.received !== null).length}件
                  {busy ? ' ／ 保存中…' : ''}
                </span>
              </div>
              <Recovery
                operations={unresolved}
                snapshot={snapshot}
                store={store}
                draft={draft}
                setDraft={setDraft}
                {...shared}
              />
              {tab === '会計' && (
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
              )}
              {tab === '履歴・集計' && (
                <History snapshot={snapshot} store={store} {...shared} />
              )}
              <div hidden={tab !== '設定・データ'}>
                <Settings
                  snapshot={snapshot}
                  store={store}
                  section={settingsInitial}
                  onSectionChange={setSettingsInitial}
                  onRestored={resetAfterRestore}
                  onVerified={setVerifiedBackup}
                  hasDraft={count(draft.quantities) > 0}
                  {...shared}
                />
              </div>
            </>
          )}
        </fieldset>
      </main>
    </>
  );
}
