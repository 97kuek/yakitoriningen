import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60_000;

/**
 * Detects new app versions without reloading on its own.
 * The page reloads only after the operator asks for the update.
 */
export function useAppUpdate(onError: (message: string) => void) {
  const updateRequested = useRef(false);
  const reloadAfterUpdate = () => {
    if (!updateRequested.current) return;
    updateRequested.current = false;
    window.location.reload();
  };
  useEffect(() => {
    // Workbox can classify a rapid deployment as an external update. The native
    // controller event also covers that case, but only reloads on an explicit click.
    navigator.serviceWorker?.addEventListener(
      'controllerchange',
      reloadAfterUpdate,
    );
    return () =>
      navigator.serviceWorker?.removeEventListener(
        'controllerchange',
        reloadAfterUpdate,
      );
  }, []);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload: reloadAfterUpdate,
    onRegisterError: () =>
      onError(
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
    const interval = window.setInterval(
      checkForUpdates,
      UPDATE_CHECK_INTERVAL_MS,
    );
    return () => {
      window.removeEventListener('focus', checkForUpdates);
      window.removeEventListener('online', checkForUpdates);
      document.removeEventListener('visibilitychange', checkForUpdates);
      window.clearInterval(interval);
    };
  }, []);
  /** Install the waiting version; the page reloads when it takes control. */
  const applyUpdate = async () => {
    updateRequested.current = true;
    try {
      await updateServiceWorker(true);
    } catch (error) {
      updateRequested.current = false;
      throw error;
    }
  };
  return {
    offlineReady: offlineReady || !!navigator.serviceWorker?.controller,
    needRefresh,
    applyUpdate,
  };
}
