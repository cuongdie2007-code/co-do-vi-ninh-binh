import { useEffect } from 'react';

const TEXT_INPUT_SELECTOR =
  'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]), textarea, select';

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur !== document.body) {
    const style = window.getComputedStyle(cur);
    const oy = style.overflowY;
    if (oy === 'auto' || oy === 'scroll') {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

function isPinnedTopInput(el: HTMLElement | null): boolean {
  return Boolean(el && (el.dataset.noKbScroll === 'true' || el.closest('header')));
}

function alignInputNearTop(el: HTMLElement) {
  if (!el || !document.contains(el)) return;
  if (isPinnedTopInput(el)) {
    if (window.scrollY !== 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    return;
  }
  const scroller = findScrollParent(el);
  if (!scroller) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  // Scroll focused input (and its label slightly above) right up near top (+18px margin)
  const targetTop = Math.max(0, scroller.scrollTop + (elRect.top - scrollerRect.top) - 24);
  scroller.scrollTo({ top: targetTop, behavior: 'smooth' });
}

/**
 * Syncs mobile VisualViewport height & pushes focused text inputs cleanly to the top
 * so virtual keyboards never cover Search, Notes, Price, or Form fields.
 */
export function useMobileKeyboardLift() {
  useEffect(() => {
    const root = document.documentElement;
    let t1: number | null = null;
    let t2: number | null = null;
    let blurTimer: number | null = null;

    const updateViewportVars = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const kbHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      root.style.setProperty('--vv-top', `${Math.max(0, Math.round(vv.offsetTop))}px`);
      root.style.setProperty('--kb-inset', `${Math.round(kbHeight)}px`);
      document.body.classList.toggle('kb-open', kbHeight > 95);

      const active = document.activeElement as HTMLElement | null;
      if (kbHeight > 95 && active && active.matches(TEXT_INPUT_SELECTOR)) {
        alignInputNearTop(active);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.matches(TEXT_INPUT_SELECTOR)) return;

      if (blurTimer) {
        window.clearTimeout(blurTimer);
        blurTimer = null;
      }

      if (isPinnedTopInput(target)) {
        document.body.classList.remove('input-focused');
        if (window.scrollY !== 0) {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
        return;
      }

      document.body.classList.add('input-focused');

      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      t1 = window.setTimeout(() => alignInputNearTop(target), 65);
      t2 = window.setTimeout(() => alignInputNearTop(target), 310);
    };

    const onFocusOut = () => {
      if (blurTimer) window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || !active.matches(TEXT_INPUT_SELECTOR)) {
          document.body.classList.remove('input-focused');
          document.body.classList.remove('kb-open');
          root.style.removeProperty('--kb-inset');
          if (window.visualViewport) {
            root.style.setProperty('--vvh', `${Math.round(window.visualViewport.height)}px`);
            root.style.setProperty('--vv-top', `${Math.max(0, Math.round(window.visualViewport.offsetTop))}px`);
          }
        }
      }, 120);
    };

    updateViewportVars();
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    return () => {
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      if (blurTimer) window.clearTimeout(blurTimer);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);
}
