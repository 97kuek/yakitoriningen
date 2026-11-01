import { useEffect, type RefObject } from 'react';

/** Checkout keys use the rendered buttons, preserving validation and disabled states. */
export function useCheckoutKeys(
  root: RefObject<HTMLElement | null>,
  primary: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        (event.key !== 'Enter' && !/^[1-9]$/.test(event.key)) ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const panel = root.current;
      const button = primary.current;
      const target = event.target;
      if (
        !panel ||
        !button ||
        panel.closest('[hidden]') ||
        !panel.getClientRects().length ||
        document.querySelector('dialog[open]')
      )
        return;
      if (!(target instanceof HTMLElement)) return;
      const inside = panel.contains(target);
      if (!inside && target !== document.body) return;
      if (event.key !== 'Enter') {
        if (target.closest('input, textarea, select, [contenteditable="true"]'))
          return;
        const product = panel.querySelector<HTMLButtonElement>(
          `button[data-product-key="${event.key}"]`,
        );
        if (!product || product.matches(':disabled')) return;
        event.preventDefault();
        if (!event.repeat) product.click();
        return;
      }

      // Recovered payments may be displayed together. Require focus to choose one.
      if (
        !inside &&
        (panel.parentElement?.querySelectorAll('.payment').length ?? 0) > 1
      )
        return;
      if (
        inside &&
        target.closest('button') &&
        !target.closest('.stepper, .cash-buttons') &&
        target.closest('button') !== button
      )
        return;
      if (
        inside &&
        target.matches('input') &&
        !target.matches('input[type="number"]')
      )
        return;
      event.preventDefault();
      if (event.repeat || button.matches(':disabled')) return;
      button.click();
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [root, primary]);
}
