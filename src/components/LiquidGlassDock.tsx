import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Compass, Dices, Plus, SlidersHorizontal } from 'lucide-react';

export type DockTabId = 'explore' | 'picker' | 'saved' | 'personal';

interface LiquidGlassDockProps {
  activeTab: DockTabId;
  onSelectTab: (tab: DockTabId) => void;
  onOpenAdd: () => void;
}

const TABS: Array<{ id: DockTabId; label: string; Icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'explore', label: 'Khám phá', Icon: Compass },
  { id: 'picker', label: 'Chọn món', Icon: Dices },
  { id: 'saved', label: 'Đã lưu', Icon: Bookmark },
  { id: 'personal', label: 'Cá nhân', Icon: SlidersHorizontal },
];

export const LiquidGlassDock: React.FC<LiquidGlassDockProps> = ({
  activeTab,
  onSelectTab,
  onOpenAdd,
}) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const lensRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverTab, setHoverTab] = useState<DockTabId | null>(null);

  const pointerActiveRef = useRef(false);
  const startXRef = useRef(0);
  const movedRef = useRef(false);
  const committedOnUpRef = useRef(false);
  const lastHoveredTabRef = useRef<DockTabId>(activeTab);
  const rafRef = useRef<number | null>(null);
  const pendingShiftPctRef = useRef<number>(0);

  const activeIdx = Math.max(
    0,
    TABS.findIndex((t) => t.id === (hoverTab || activeTab))
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const applyLensTransform = (shiftPct: number) => {
    pendingShiftPctRef.current = shiftPct;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (lensRef.current) {
        lensRef.current.style.transform = `translate3d(${pendingShiftPctRef.current}%, -2px, 0) scale(1.1, 1.14)`;
      }
    });
  };

  const computeFromClientX = (clientX: number) => {
    const el = barRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const innerWidth = Math.max(1, rect.width - 10);
    const relX = Math.min(Math.max(0, clientX - rect.left - 5), innerWidth);
    const ratio = relX / innerWidth;
    const tabIdx = Math.min(3, Math.max(0, Math.floor(ratio * 4)));
    // Each tab lens is 25% of inner bar -> shifting by 100% equals 1 full tab slot
    const shiftPct = Math.min(300, Math.max(0, (ratio * 4 - 0.5) * 100));
    return { tabId: TABS[tabIdx].id, shiftPct };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerActiveRef.current = true;
    startXRef.current = e.clientX;
    movedRef.current = false;
    committedOnUpRef.current = false;
    lastHoveredTabRef.current = activeTab;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    if (!movedRef.current) {
      if (Math.abs(e.clientX - startXRef.current) <= 7) return;
      movedRef.current = true;
      setIsScrubbing(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    const calc = computeFromClientX(e.clientX);
    if (!calc) return;
    // Slide the Liquid Glass droplet & preview target ONLY; do NOT switch pages until release!
    applyLensTransform(calc.shiftPct);
    if (calc.tabId !== lastHoveredTabRef.current) {
      lastHoveredTabRef.current = calc.tabId;
      setHoverTab(calc.tabId);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(7);
        } catch {
          // ignore
        }
      }
    }
  };

  const finishScrub = (clientX?: number) => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const wasScrubbing = movedRef.current;
    let targetTab = activeTab;
    if (wasScrubbing && typeof clientX === 'number') {
      const calc = computeFromClientX(clientX);
      if (calc) {
        targetTab = calc.tabId;
      }
    }

    const targetIdx = Math.max(
      0,
      TABS.findIndex((t) => t.id === targetTab)
    );
    if (lensRef.current) {
      lensRef.current.style.transform = `translate3d(${targetIdx * 100}%, 0, 0)`;
    }

    setIsScrubbing(false);
    setHoverTab(null);

    if (wasScrubbing && targetTab !== activeTab) {
      committedOnUpRef.current = true;
      onSelectTab(targetTab);
    }
  };

  return (
    <nav className="bottom-dock-wrap" aria-label="Điều hướng chính">
      <div
        ref={barRef}
        className={`bottom-dock-bar lg-surface-strong lg-sheen ${isScrubbing ? 'scrubbing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishScrub(e.clientX)}
        onPointerCancel={() => finishScrub()}
        style={{ touchAction: 'none', userSelect: 'none' }}
        title="Chạm hoặc giữ rồi kéo ngang để lướt chuyển tab kiểu Liquid Glass"
      >
        {/* GPU-Only Floating Liquid Glass Droplet Lens */}
        <div
          ref={lensRef}
          className={`lg-dock-lens ${isScrubbing ? 'is-scrubbing' : ''}`}
          style={{
            left: 5,
            width: 'calc((100% - 10px) / 4)',
            transform: isScrubbing ? undefined : `translate3d(${activeIdx * 100}%, 0, 0)`,
          }}
          aria-hidden="true"
        />

        {TABS.map(({ id, label, Icon }) => {
          const isActive = (hoverTab || activeTab) === id;
          return (
            <button
              key={id}
              type="button"
              className={`dock-tab-btn ${isActive ? 'active' : ''} ${
                isScrubbing && isActive ? 'scrub-magnify' : ''
              }`}
              onClick={() => {
                if (!movedRef.current && !committedOnUpRef.current) {
                  onSelectTab(id);
                }
                committedOnUpRef.current = false;
              }}
              style={{ position: 'relative', zIndex: 2 }}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="dock-fab-add"
        onClick={onOpenAdd}
        aria-label="Thêm quán ăn mới"
        title="Thêm quán ăn Ninh Bình"
      >
        <Plus size={25} strokeWidth={2.6} />
      </button>
    </nav>
  );
};
