import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  Flame,
  RotateCcw,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import {
  CompanionType,
  Restaurant,
  TasteKey,
  UserProfile,
} from '../types/restaurant';
import { TASTE_OPTIONS } from '../data/themes';
import {
  calcDistanceKm,
  classifyRestaurantTastes,
  classifyVenueByPrice,
  computePersonalScore,
  getRestaurantOpenStatus,
  getUserAnchorCoords,
  matchesDietaryFilters,
  VENUE_TIER_FILTER_OPTIONS,
} from '../utils/restaurantUtils';
import { useSheetDragDismiss } from '../hooks/useSheetDragDismiss';
import { TinderSwipeDeck } from './TinderSwipeDeck';

interface TinderFullScreenModalProps {
  restaurants: Restaurant[];
  profile: UserProfile;
  onClose: () => void;
  onSelectRestaurant: (r: Restaurant) => void;
  onRecordPick: (r: Restaurant, mode: 'swipe', companion: CompanionType) => void;
  onToggleFavorite: (id: string) => void;
  onToggleWishlist: (id: string) => void;
}

const COMPANIONS: Array<{ key: CompanionType; label: string; emoji: string }> = [
  { key: 'solo', label: 'Một mình', emoji: '🧍' },
  { key: 'couple', label: 'Cặp đôi', emoji: '💑' },
  { key: 'family', label: 'Gia đình', emoji: '👨‍👩‍👧‍👦' },
  { key: 'friends', label: 'Nhóm bạn', emoji: '🍻' },
  { key: 'guests', label: 'Tiếp khách', emoji: '🎩' },
];

export const TinderFullScreenModal: React.FC<TinderFullScreenModalProps> = ({
  restaurants,
  profile,
  onClose,
  onSelectRestaurant,
  onRecordPick,
  onToggleFavorite,
  onToggleWishlist,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [companion, setCompanion] = useState<CompanionType>(profile.defaultCompanion);
  const [selectedTastes, setSelectedTastes] = useState<TasteKey[]>([]);
  const [radiusKm, setRadiusKm] = useState<number>(profile.maxRadiusKm || 15);
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);

  const { overlayRef, panelRef, handleRef, dismissAnimated, handleGrabProps } =
    useSheetDragDismiss({ onDismiss: onClose });

  const anchor = useMemo(() => getUserAnchorCoords(profile), [profile]);

  const candidates = useMemo(() => {
    const now = new Date();
    return restaurants
      .filter((r) => {
        if (!matchesDietaryFilters(r, profile, now)) return false;
        if (onlyOpen && !getRestaurantOpenStatus(r, now).isOpenNow) return false;
        if (onlySaved) {
          const m = profile.metaById[r.id];
          if (!m?.favorite && !m?.wishlist) return false;
        }
        if (calcDistanceKm(anchor, r.location) > radiusKm) return false;
        if (selectedTastes.length > 0) {
          const tastes = classifyRestaurantTastes(r);
          if (!selectedTastes.some((t) => tastes.includes(t))) return false;
        }
        if (budgetFilter !== 'all') {
          const { tier } = classifyVenueByPrice(r, profile.metaById[r.id]?.customPrice);
          if (tier !== budgetFilter) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          computePersonalScore(b, profile, anchor, now) -
          computePersonalScore(a, profile, anchor, now)
      );
  }, [restaurants, profile, onlyOpen, onlySaved, radiusKm, selectedTastes, budgetFilter, anchor]);

  const activeFilterCount =
    selectedTastes.length +
    (onlyOpen ? 1 : 0) +
    (onlySaved ? 1 : 0) +
    (budgetFilter !== 'all' ? 1 : 0) +
    (radiusKm !== 15 ? 1 : 0);

  return (
    <div ref={overlayRef} className="sheet-overlay" onClick={dismissAnimated}>
      <div
        ref={panelRef}
        className="sheet-panel lg-surface-strong"
        onClick={(e) => e.stopPropagation()}
        style={{
          height: '96%',
          maxHeight: '96%',
          padding: '0 14px calc(14px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Top Liquid Glass Grab Handle + Compact Arena Header */}
        <div className="sheet-grab-zone" {...handleGrabProps} style={{ flexShrink: 0 }}>
          <div ref={handleRef} className="sheet-handle" />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              paddingBottom: 6,
            }}
          >
            <button
              type="button"
              className="lg-pill"
              style={{ minHeight: 34, padding: '4px 11px', fontSize: 12.5 }}
              onClick={dismissAnimated}
            >
              <ChevronLeft size={15} /> Quay lại
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Flame size={15} color="#fb923c" />
              <span style={{ fontSize: 14, fontWeight: 800 }}>Lướt Tinder</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                {candidates.length} quán
              </span>
            </div>

            <button
              type="button"
              className={`lg-pill ${showFilters || activeFilterCount > 0 ? 'active' : ''}`}
              style={{ minHeight: 34, padding: '4px 11px', fontSize: 12 }}
              onClick={() => setShowFilters((v) => !v)}
            >
              {showFilters ? <X size={14} /> : <SlidersHorizontal size={14} />}
              Lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
          </div>
        </div>

        {/* Collapsible Liquid Glass Quick Filter Drawer (closed by default so zero scroll needed!) */}
        {showFilters && (
          <div
            className="lg-surface"
            style={{
              borderRadius: 22,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
              flexShrink: 0,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={11} /> ĐI CÙNG AI?
              </div>
              <div className="h-scroll-row">
                {COMPANIONS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`lg-pill ${companion === c.key ? 'active' : ''}`}
                    style={{ minHeight: 30, fontSize: 11.5 }}
                    onClick={() => setCompanion(c.key)}
                  >
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-scroll-row">
              <button
                type="button"
                className={`lg-pill ${onlyOpen ? 'active' : ''}`}
                style={{ minHeight: 30, fontSize: 11.5 }}
                onClick={() => setOnlyOpen((v) => !v)}
              >
                🟢 Đang mở
              </button>
              <button
                type="button"
                className={`lg-pill ${onlySaved ? 'active' : ''}`}
                style={{ minHeight: 30, fontSize: 11.5 }}
                onClick={() => setOnlySaved((v) => !v)}
              >
                ❤️ Đã lưu
              </button>
              {[1.5, 3, 5, 15].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`lg-pill ${radiusKm === r ? 'active' : ''}`}
                  style={{ minHeight: 30, fontSize: 11.5 }}
                  onClick={() => setRadiusKm(r)}
                >
                  📍 {r === 15 ? 'Toàn NB' : `< ${r}km`}
                </button>
              ))}
            </div>

            <div className="h-scroll-row">
              {VENUE_TIER_FILTER_OPTIONS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={`lg-pill ${budgetFilter === b.key ? 'active' : ''}`}
                  style={{ minHeight: 28, fontSize: 11 }}
                  onClick={() => setBudgetFilter(b.key as any)}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="h-scroll-row">
              {TASTE_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`lg-pill ${selectedTastes.includes(t.key) ? 'active' : ''}`}
                  style={{ minHeight: 28, fontSize: 11 }}
                  onClick={() =>
                    setSelectedTastes((prev) =>
                      prev.includes(t.key) ? prev.filter((k) => k !== t.key) : [...prev, t.key]
                    )
                  }
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full-Height Zero-Scroll Tinder Deck Arena */}
        {candidates.length === 0 ? (
          <div
            className="lg-surface"
            style={{
              flex: 1,
              borderRadius: 24,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 38 }}>🍲</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Không có quán nào khớp bộ lọc này</div>
            <button
              type="button"
              className="lg-btn-accent"
              onClick={() => {
                setSelectedTastes([]);
                setOnlyOpen(false);
                setOnlySaved(false);
                setBudgetFilter('all');
                setRadiusKm(15);
              }}
            >
              <RotateCcw size={15} /> Đặt lại bộ lọc Tinder
            </button>
          </div>
        ) : (
          <TinderSwipeDeck
            key={`${onlyOpen}-${onlySaved}-${radiusKm}-${budgetFilter}-${selectedTastes.join(',')}`}
            candidates={candidates}
            anchor={anchor}
            metaById={profile.metaById}
            fullHeight={true}
            onSelectRestaurant={onSelectRestaurant}
            onLike={(r) => {
              if (!profile.metaById[r.id]?.favorite) {
                onToggleFavorite(r.id);
              }
              onRecordPick(r, 'swipe', companion);
            }}
            onSaveWishlist={(r) => {
              if (!profile.metaById[r.id]?.wishlist) {
                onToggleWishlist(r.id);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
