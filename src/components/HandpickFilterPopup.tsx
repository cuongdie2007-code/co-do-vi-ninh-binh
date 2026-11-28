import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { TASTE_OPTIONS } from '../data/themes';
import { useAnimatedMount } from '../hooks/useAnimatedMount';
import { TasteKey } from '../types/restaurant';
import { playTapTick } from '../utils/feedbackUtils';
import { VenueTierKey } from '../utils/restaurantUtils';

export type HandpickPriceBand = 'under50' | '50to120' | '120to250' | 'over250';
export type HandpickSortMode = 'smart' | 'nearest' | 'rating' | 'cheap';

export interface HandpickFilterState {
  studentBudgetOnly: boolean;
  onlyOpen: boolean;
  minRating45: boolean;
  popularOnly: boolean;
  onlyHasPrice: boolean;
  onlyHasPhoto: boolean;
  hasReviews: boolean;
  onlyUserAdded: boolean;
  radiusKm: number | null;
  tiers: VenueTierKey[];
  priceBands: HandpickPriceBand[];
  tastes: TasteKey[];
  sortBy: HandpickSortMode;
}

export const DEFAULT_HANDPICK_FILTERS: HandpickFilterState = {
  studentBudgetOnly: false,
  onlyOpen: false,
  minRating45: false,
  popularOnly: false,
  onlyHasPrice: false,
  onlyHasPhoto: false,
  hasReviews: false,
  onlyUserAdded: false,
  radiusKm: null,
  tiers: [],
  priceBands: [],
  tastes: [],
  sortBy: 'smart',
};

export const HANDPICK_PRICE_BANDS: Array<{
  key: HandpickPriceBand;
  label: string;
  minK: number;
  maxK: number;
}> = [
  { key: 'under50', label: '💸 < 50k', minK: 0, maxK: 50 },
  { key: '50to120', label: '💵 50k–120k', minK: 50, maxK: 120 },
  { key: '120to250', label: '💴 120k–250k', minK: 120, maxK: 250 },
  { key: 'over250', label: '🥂 > 250k', minK: 250, maxK: 99999 },
];

export const HANDPICK_TIER_OPTIONS: Array<{ key: VenueTierKey; label: string }> = [
  { key: 'low', label: '🥣 Quán nhỏ' },
  { key: 'mid', label: '🍲 Bình dân' },
  { key: 'high', label: '🏛️ Nhà hàng' },
];

export const HANDPICK_SORT_OPTIONS: Array<{ key: HandpickSortMode; label: string }> = [
  { key: 'smart', label: '✨ Hợp gu' },
  { key: 'nearest', label: '📍 Gần nhất' },
  { key: 'rating', label: '⭐ Sao cao' },
  { key: 'cheap', label: '💸 Giá mềm' },
];

export const HANDPICK_QUICK_TOGGLES: Array<{
  key:
    | 'studentBudgetOnly'
    | 'onlyOpen'
    | 'minRating45'
    | 'popularOnly'
    | 'onlyHasPrice'
    | 'onlyHasPhoto'
    | 'hasReviews'
    | 'onlyUserAdded';
  label: string;
}> = [
  { key: 'studentBudgetOnly', label: '🎓 Sinh viên ≤ 60k' },
  { key: 'onlyOpen', label: '🟢 Đang mở' },
  { key: 'minRating45', label: '⭐ Từ 4.5★+' },
  { key: 'popularOnly', label: '🔥 ≥ 50 đánh giá' },
  { key: 'onlyHasPrice', label: '💰 Có ghi giá' },
  { key: 'onlyHasPhoto', label: '🖼️ Có ảnh quán' },
  { key: 'hasReviews', label: '💬 Có review' },
  { key: 'onlyUserAdded', label: '➕ Quán tự thêm' },
];

export function countActiveHandpickFilters(f: HandpickFilterState): number {
  let count = 0;
  for (const t of HANDPICK_QUICK_TOGGLES) {
    if (f[t.key]) count += 1;
  }
  if (f.radiusKm !== null) count += 1;
  count += f.tiers.length;
  count += f.priceBands.length;
  count += f.tastes.length;
  if (f.sortBy !== 'smart') count += 1;
  return count;
}

export interface HandpickFilterAnchorRect {
  top: number;
  right: number;
  maxHeight: number;
}

interface HandpickFilterPopupProps {
  isOpen: boolean;
  anchorRect: HandpickFilterAnchorRect | null;
  portalContainer: HTMLElement | null;
  filters: HandpickFilterState;
  onChangeFilters: React.Dispatch<React.SetStateAction<HandpickFilterState>>;
  matchedCount: number;
  handpickTab: 'saved' | 'all';
  allMatchedCount: number;
  onSwitchToAllTab: () => void;
  onSelectAllMatched: () => void;
  allMatchedSelected: boolean;
  soundEnabled?: boolean;
  onClose: () => void;
}

export const HandpickFilterPopup: React.FC<HandpickFilterPopupProps> = ({
  isOpen,
  anchorRect,
  portalContainer,
  filters,
  onChangeFilters,
  matchedCount,
  handpickTab,
  allMatchedCount,
  onSwitchToAllTab,
  onSelectAllMatched,
  allMatchedSelected,
  soundEnabled = true,
  onClose,
}) => {
  const mount = useAnimatedMount(isOpen, 210);
  const activeCount = countActiveHandpickFilters(filters);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!mount.mounted || !portalContainer) return null;

  const toggleArrItem = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleToggleQuick = (key: (typeof HANDPICK_QUICK_TOGGLES)[number]['key']) => {
    playTapTick(soundEnabled);
    onChangeFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetAll = () => {
    playTapTick(soundEnabled);
    onChangeFilters(DEFAULT_HANDPICK_FILTERS);
  };

  return createPortal(
    <>
      <div
        className={`top-popover-backdrop ${mount.closing ? 'is-closing' : ''}`}
        style={{ zIndex: 44 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bộ lọc Tự chọn"
        className={`lg-surface-strong lg-sheen codovi-hyperos-filter-popup ${
          mount.closing ? 'is-closing' : ''
        }`}
        style={{
          top: anchorRect?.top ?? 96,
          right: anchorRect?.right ?? 14,
          maxHeight: anchorRect?.maxHeight ?? 460,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky HyperOS Popup Header */}
        <div className="codovi-hyperos-popup-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <SlidersHorizontal size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
              Bộ lọc Tự chọn
            </span>
            {activeCount > 0 && (
              <span className="codovi-hyperos-count-badge">{activeCount}</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {activeCount > 0 && (
              <button
                type="button"
                className="lg-pill"
                style={{ minHeight: 28, padding: '2px 9px', fontSize: 11.5 }}
                onClick={handleResetAll}
              >
                <RotateCcw size={11} /> Đặt lại
              </button>
            )}
            <button
              type="button"
              className="lg-pill active"
              style={{ minHeight: 28, padding: '2px 11px', fontSize: 11.5, fontWeight: 700 }}
              onClick={onClose}
            >
              Xong
            </button>
          </div>
        </div>

        {/* Scrollable Combinable Options */}
        <div className="codovi-hyperos-popup-body">
          {/* 1. Quick Combinable Toggles */}
          <div className="codovi-hyperos-section">
            <div className="codovi-hyperos-section-title">
              <span>Tiêu chí nhanh · bật nhiều cùng lúc</span>
            </div>
            <div className="codovi-hyperos-grid-2">
              {HANDPICK_QUICK_TOGGLES.map((opt) => {
                const active = filters[opt.key];
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    className={`codovi-hyperos-tile ${active ? 'active' : ''}`}
                    onClick={() => handleToggleQuick(opt.key)}
                  >
                    <span className="codovi-hyperos-tile-label">{opt.label}</span>
                    {active && <Check size={13} className="codovi-hyperos-tile-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hyperos-menu-divider" />

          {/* 2. Radius around current anchor/GPS */}
          <div className="codovi-hyperos-section">
            <div className="codovi-hyperos-section-title">
              <span>Khoảng cách quanh bạn</span>
            </div>
            <div className="codovi-hyperos-wrap-row">
              {[1, 2, 5, 10].map((rKm) => {
                const active = filters.radiusKm === rKm;
                return (
                  <button
                    key={rKm}
                    type="button"
                    aria-pressed={active}
                    className={`codovi-hyperos-tile compact ${active ? 'active' : ''}`}
                    onClick={() => {
                      playTapTick(soundEnabled);
                      onChangeFilters((prev) => ({
                        ...prev,
                        radiusKm: prev.radiusKm === rKm ? null : rKm,
                      }));
                    }}
                  >
                    <span>📍 &lt; {rKm}km</span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={filters.radiusKm === null}
                className={`codovi-hyperos-tile compact ${filters.radiusKm === null ? 'active' : ''}`}
                onClick={() => {
                  playTapTick(soundEnabled);
                  onChangeFilters((prev) => ({ ...prev, radiusKm: null }));
                }}
              >
                <span>🌏 Toàn NB</span>
              </button>
            </div>
          </div>

          <div className="hyperos-menu-divider" />

          {/* 3. Combinable Venue Tiers */}
          <div className="codovi-hyperos-section">
            <div className="codovi-hyperos-section-title">
              <span>Hạng quán · chọn nhiều</span>
            </div>
            <div className="codovi-hyperos-grid-3">
              {HANDPICK_TIER_OPTIONS.map((t) => {
                const active = filters.tiers.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={active}
                    className={`codovi-hyperos-tile compact ${active ? 'active' : ''}`}
                    onClick={() => {
                      playTapTick(soundEnabled);
                      onChangeFilters((prev) => ({
                        ...prev,
                        tiers: toggleArrItem(prev.tiers, t.key),
                      }));
                    }}
                  >
                    <span className="codovi-hyperos-tile-label">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hyperos-menu-divider" />

          {/* 4. Combinable Estimated Price Bands */}
          <div className="codovi-hyperos-section">
            <div className="codovi-hyperos-section-title">
              <span>Khoảng giá · chọn nhiều</span>
            </div>
            <div className="codovi-hyperos-grid-2">
              {HANDPICK_PRICE_BANDS.map((band) => {
                const active = filters.priceBands.includes(band.key);
                return (
                  <button
                    key={band.key}
                    type="button"
                    aria-pressed={active}
                    className={`codovi-hyperos-tile ${active ? 'active' : ''}`}
                    onClick={() => {
                      playTapTick(soundEnabled);
                      onChangeFilters((prev) => ({
                        ...prev,
                        priceBands: toggleArrItem(prev.priceBands, band.key),
                      }));
                    }}
                  >
                    <span className="codovi-hyperos-tile-label">{band.label}</span>
                    {active && <Check size={13} className="codovi-hyperos-tile-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hyperos-menu-divider" />

          {/* 5. Explore Taste Categories (Multi-select) */}
          <div className="codovi-hyperos-section">
            <div className="codovi-hyperos-section-title">
              <span>Món ăn & Phong vị · chọn nhiều</span>
              {filters.tastes.length > 0 && (
                <button
                  type="button"
                  className="codovi-hyperos-clear-link"
                  onClick={() => {
                    playTapTick(soundEnabled);
                    onChangeFilters((prev) => ({ ...prev, tastes: [] }));
                  }}
                >
                  Xoá món ({filters.tastes.length})
                </button>
              )}
            </div>
            <div className="codovi-hyperos-grid-2">
              {TASTE_OPTIONS.map((taste) => {
                const active = filters.tastes.includes(taste.key);
                return (
                  <button
                    key={taste.key}
                    type="button"
                    aria-pressed={active}
                    className={`codovi-hyperos-tile ${active ? 'active' : ''}`}
                    onClick={() => {
                      playTapTick(soundEnabled);
                      onChangeFilters((prev) => ({
                        ...prev,
                        tastes: toggleArrItem(prev.tastes, taste.key),
                      }));
                    }}
                  >
                    <span className="codovi-hyperos-tile-label">
                      <span aria-hidden="true">{taste.emoji}</span> {taste.label}
                    </span>
                    {active && <Check size={13} className="codovi-hyperos-tile-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hyperos-menu-divider" />

          {/* 6. Sort Order */}
          <div className="codovi-hyperos-section">
            <div className="codovi-hyperos-section-title">
              <span>Sắp xếp kết quả</span>
            </div>
            <div className="codovi-hyperos-grid-2">
              {HANDPICK_SORT_OPTIONS.map((s) => {
                const active = filters.sortBy === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={active}
                    className={`codovi-hyperos-tile ${active ? 'active' : ''}`}
                    onClick={() => {
                      playTapTick(soundEnabled);
                      onChangeFilters((prev) => ({ ...prev, sortBy: s.key }));
                    }}
                  >
                    <span className="codovi-hyperos-tile-label">{s.label}</span>
                    {active && <Check size={13} className="codovi-hyperos-tile-check" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky HyperOS Popup Footer */}
        <div className="codovi-hyperos-popup-foot">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              <strong style={{ color: 'var(--accent)' }}>{matchedCount}</strong> quán khớp
            </div>
            {handpickTab === 'saved' && matchedCount === 0 && allMatchedCount > 0 && (
              <button
                type="button"
                className="codovi-hyperos-clear-link"
                style={{ padding: 0, marginTop: 2 }}
                onClick={() => {
                  onSwitchToAllTab();
                  onClose();
                }}
              >
                Mở {allMatchedCount} quán ở Tất cả →
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {matchedCount > 0 && (
              <button
                type="button"
                className={`lg-pill ${allMatchedSelected ? 'active' : ''}`}
                style={{ minHeight: 32, padding: '4px 10px', fontSize: 11.5 }}
                onClick={onSelectAllMatched}
              >
                <Sparkles size={12} />{' '}
                {allMatchedSelected ? 'Bỏ chọn hết' : `Chọn hết (${matchedCount})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    portalContainer
  );
};
