import { useEffect, useRef, useState } from 'react';

interface UseSheetDragDismissOptions {
  onDismiss: () => void;
  thresholdPx?: number;
  isOpen?: boolean;
}

/**
 * Provides smooth iOS Liquid Glass pull-down-to-dismiss physics for bottom sheets and modals.
 * Binds to both the top grabber/header zone and top-of-scroll overscroll pulls.
 */
export function useSheetDragDismiss({
  onDismiss,
  thresholdPx = 88,
  isOpen = true,
}: UseSheetDragDismissOptions) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startY: number;
    startTime: number;
    dy: number;
    raf: number | null;
    closing: boolean;
  }>({
    active: false,
    pointerId: null,
    startY: 0,
    startTime: 0,
    dy: 0,
    raf: null,
    closing: false,
  });

  const touchPullRef = useRef<{
    active: boolean;
    startY: number;
    startX: number;
    startTime: number;
    dy: number;
    locked: boolean;
  }>({
    active: false,
    startY: 0,
    startX: 0,
    startTime: 0,
    dy: 0,
    locked: false,
  });

  useEffect(() => {
    if (isOpen) {
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      dragRef.current.closing = false;
      dragRef.current.active = false;
      touchPullRef.current.active = false;
      touchPullRef.current.locked = false;
      const panel = panelRef.current;
      const overlay = overlayRef.current;
      if (panel) {
        panel.style.transition = '';
        panel.style.transform = '';
        panel.style.opacity = '';
        panel.style.borderRadius = '';
        panel.style.animation = '';
        panel.style.willChange = 'auto';
      }
      if (overlay) {
        overlay.style.transition = '';
        overlay.style.opacity = '';
        overlay.style.background = '';
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const st = dragRef.current;
    return () => {
      if (st.raf) cancelAnimationFrame(st.raf);
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, []);

  const paintDrag = (dy: number) => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) {
      const clampedDy = dy >= 0 ? dy * 0.92 : dy * 0.14; // gentle fluid resistance
      const scale = dy > 0 ? Math.max(0.94, 1 - dy / 3000) : 1;
      const radiusBoost = dy > 0 ? Math.min(12, dy / 16) : 0;
      panel.style.animation = 'none';
      panel.style.transition = 'none';
      panel.style.willChange = 'transform';
      panel.style.transform = `translate3d(0, ${clampedDy}px, 0) scale(${scale})`;
      if (radiusBoost > 0) {
        panel.style.borderRadius = `${32 + radiusBoost}px ${32 + radiusBoost}px 0 0`;
      }
    }
    if (overlay) {
      const fade = dy > 0 ? Math.max(0.15, 1 - dy / 420) : 1;
      overlay.style.transition = 'none';
      overlay.style.background = `rgba(0, 0, 0, ${0.46 * fade})`;
    }
  };

  const resetVisuals = () => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) {
      panel.style.transition = 'transform 0.48s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.42s ease';
      panel.style.transform = 'translate3d(0, 0, 0) scale(1)';
      panel.style.borderRadius = '';
      panel.style.willChange = 'auto';
    }
    if (overlay) {
      overlay.style.transition = 'background 0.42s ease';
      overlay.style.background = '';
    }
  };

  const dismissAnimated = () => {
    if (dragRef.current.closing) return;
    dragRef.current.closing = true;
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) {
      panel.style.animation = 'none';
      panel.style.willChange = 'transform, opacity';
      panel.style.transition =
        'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.26s ease';
      panel.style.transform = 'translate3d(0, 102%, 0) scale(0.95)';
      panel.style.opacity = '0';
    }
    if (overlay) {
      overlay.style.animation = 'none';
      overlay.style.transition = 'opacity 0.28s ease';
      overlay.style.opacity = '0';
    }
    if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = window.setTimeout(() => {
      dismissTimerRef.current = null;
      dragRef.current.closing = false;
      onDismiss();
    }, 290);
  };

  const finishDrag = (dy: number, elapsedMs: number) => {
    setIsDragging(false);
    if (handleRef.current) {
      handleRef.current.classList.remove('is-grabbing');
    }
    const velocity = dy / Math.max(16, elapsedMs);
    if (dy > thresholdPx || (dy > 48 && velocity > 0.55)) {
      dismissAnimated();
    } else {
      resetVisuals();
    }
  };

  // Top Grabber / Header Pointer Handlers
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.closing) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea')) return;

    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      startTime: Date.now(),
      dy: 0,
      raf: null,
      closing: false,
    };
    setIsDragging(true);
    if (handleRef.current) {
      handleRef.current.classList.add('is-grabbing');
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore capture restrictions
    }
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    st.dy = e.clientY - st.startY;
    if (st.raf) return;
    st.raf = requestAnimationFrame(() => {
      st.raf = null;
      paintDrag(dragRef.current.dy);
    });
  };

  const onHandlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragRef.current;
    if (!st.active || (st.pointerId !== null && st.pointerId !== e.pointerId)) return;
    if (st.raf) {
      cancelAnimationFrame(st.raf);
      st.raf = null;
    }
    st.active = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    finishDrag(st.dy, Date.now() - st.startTime);
  };

  // Body Overscroll-at-Top Touch Pull Handlers (seamless continuous pull down when scrollTop <= 0)
  const onBodyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dragRef.current.closing) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input[type="range"], .lg-slider, .ios-swipe-row, textarea, select')) return;
    const t = e.touches?.[0];
    if (!t) return;
    const body = scrollBodyRef.current;
    if (!body || body.scrollTop > 2) return;
    touchPullRef.current = {
      active: true,
      startY: t.clientY,
      startX: t.clientX,
      startTime: Date.now(),
      dy: 0,
      locked: false,
    };
  };

  const onBodyTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const tp = touchPullRef.current;
    if (!tp.active) return;
    const body = scrollBodyRef.current;
    const t = e.touches?.[0];
    if (!t || !body) return;

    const dy = t.clientY - tp.startY;
    const dx = t.clientX - tp.startX;

    if (!tp.locked) {
      if (body.scrollTop > 2 || dy < 8 || Math.abs(dx) > dy) {
        tp.active = false;
        return;
      }
      tp.locked = true;
      setIsDragging(true);
      handleRef.current?.classList.add('is-grabbing');
    }

    if (tp.locked) {
      tp.dy = Math.max(0, dy);
      paintDrag(tp.dy);
    }
  };

  const onBodyTouchEnd = () => {
    const tp = touchPullRef.current;
    if (!tp.active) return;
    tp.active = false;
    if (tp.locked) {
      tp.locked = false;
      finishDrag(tp.dy, Date.now() - tp.startTime);
    }
  };

  return {
    overlayRef,
    panelRef,
    handleRef,
    scrollBodyRef,
    isDragging,
    dismissAnimated,
    handleGrabProps: {
      onPointerDown: onHandlePointerDown,
      onPointerMove: onHandlePointerMove,
      onPointerUp: onHandlePointerEnd,
      onPointerCancel: onHandlePointerEnd,
    },
    bodyPullProps: {
      onTouchStart: onBodyTouchStart,
      onTouchMove: onBodyTouchMove,
      onTouchEnd: onBodyTouchEnd,
      onTouchCancel: onBodyTouchEnd,
    },
  };
}
