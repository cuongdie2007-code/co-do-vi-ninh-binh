import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Banknote,
  Bookmark,
  Check,
  CheckCircle2,
  Compass,
  Dices,
  Flame,
  FolderHeart,
  Heart,
  ListChecks,
  ListFilter,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import {
  CompanionType,
  Restaurant,
  TasteKey,
  UserProfile,
} from '../types/restaurant';
import {
  IndexedRestaurant,
  buildMapsDirectionUrl,
  calcDistanceKm,
  classifyRestaurantTastes,
  classifyVenueByPrice,
  computePersonalScore,
  estimateMinutes,
  formatDistance,
  getCrispPhotoUrl,
  getEffectivePrice,
  getEstimatedPriceRangeK,
  getRestaurantOpenStatus,
  getUserAnchorCoords,
  matchesDietaryFilters,
  matchesPriceSliderRange,
  normalizeShortNeighborhood,
  normalizeVietnameseSearch,
} from '../utils/restaurantUtils';
import { TASTE_OPTIONS } from '../data/themes';
import { playChimeSuccess, playTapTick, spawnCelebrationConfetti } from '../utils/feedbackUtils';
import { PhotoLuckyWheel } from './PhotoLuckyWheel';
import {
  DEFAULT_HANDPICK_FILTERS,
  HANDPICK_PRICE_BANDS,
  HANDPICK_TIER_OPTIONS,
  HandpickFilterAnchorRect,
  HandpickFilterPopup,
  HandpickFilterState,
  countActiveHandpickFilters,
} from './HandpickFilterPopup';

export type PickerMealSlot = 'any' | 'sang' | 'trua' | 'chieu' | 'toi' | 'dem';
export type PickerQuickPreset = 'all' | 'top' | 'de' | 'lau' | 'sang' | 'vat' | 'dem' | 'saved';

export interface PickerFilterState {
  preset: PickerQuickPreset;
  companion: CompanionType;
  meal: PickerMealSlot;
  selectedTastes: TasteKey[];
  radiusKm: number;
  budgetFilter: 'all' | 'low' | 'mid' | 'high';
  onlyOpen: boolean;
  onlyHasPrice: boolean;
  onlyUserAdded: boolean;
  sliceCount: number;
}

export const PICKER_QUICK_PRESETS: Array<{ key: PickerQuickPreset; label: string }> = [
  { key: 'all', label: '✨ Hợp gu nhất' },
  { key: 'top', label: '🌟 Top 4.7★+' },
  { key: 'de', label: '🐐 Dê & Cơm cháy' },
  { key: 'lau', label: '🍲 Lẩu & Nướng' },
  { key: 'sang', label: '🍜 Phở · Bún · Sáng' },
  { key: 'vat', label: '☕ Cafe · Ăn vặt' },
  { key: 'dem', label: '🌙 Ăn đêm' },
  { key: 'saved', label: '❤️ Đã lưu' },
];

export const PICKER_COMPANIONS: Array<{ key: CompanionType; label: string; emoji: string }> = [
  { key: 'solo', label: 'Một mình', emoji: '🧍' },
  { key: 'couple', label: 'Cặp đôi', emoji: '💑' },
  { key: 'family', label: 'Gia đình', emoji: '👨‍👩‍👧‍👦' },
  { key: 'friends', label: 'Nhóm bạn', emoji: '🍻' },
  { key: 'guests', label: 'Tiếp khách', emoji: '🎩' },
];

export const PICKER_MEALS: Array<{ key: PickerMealSlot; label: string; emoji: string }> = [
  { key: 'any', label: 'Mọi bữa', emoji: '✨' },
  { key: 'sang', label: 'Ăn sáng', emoji: '🌅' },
  { key: 'trua', label: 'Bữa trưa', emoji: '☀️' },
  { key: 'chieu', label: 'Chiều · Vặt', emoji: '🧋' },
  { key: 'toi', label: 'Bữa tối', emoji: '🌆' },
  { key: 'dem', label: 'Ăn đêm', emoji: '🌙' },
];

interface FoodPickerViewProps {
  restaurants: Restaurant[];
  indexedRestaurants?: IndexedRestaurant[];
  profile: UserProfile;
  filters: PickerFilterState;
  searchQuery?: string;
  choiceBadgeCount?: number;
  hasSearchText?: boolean;
  onOpenSearch?: () => void;
  onOpenChoice?: () => void;
  onResetFilters: () => void;
  onOpenTinderFullScreen: () => void;
  onOpenGroupVote?: (candidates: Restaurant[]) => void;
  onSelectRestaurant: (r: Restaurant) => void;
  onRecordPick: (r: Restaurant, mode: 'wheel' | 'swipe', companion: CompanionType) => void;
}

export const FoodPickerView: React.FC<FoodPickerViewProps> = ({
  restaurants,
  indexedRestaurants,
  profile,
  filters,
  searchQuery = '',
  choiceBadgeCount = 0,
  hasSearchText = false,
  onOpenSearch,
  onOpenChoice,
  onResetFilters,
  onOpenTinderFullScreen,
  onOpenGroupVote,
  onSelectRestaurant,
  onRecordPick,
}) => {
  const [spinStyle, setSpinStyle] = useState<'wheel' | 'slot'>('wheel');
  const [showCustomHandpick, setShowCustomHandpick] = useState(false);
  const [handpickTab, setHandpickTab] = useState<'saved' | 'all'>(() => {
    const hasMetaSaved = restaurants.some((r) => {
      const m = profile.metaById[r.id];
      return Boolean(m?.favorite || m?.wishlist || m?.visited);
    });
    const hasColSaved = (profile.collections || []).some((c) => (c.restaurantIds || []).length > 0);
    return hasMetaSaved || hasColSaved ? 'saved' : 'all';
  });
  const [handpickSearch, setHandpickSearch] = useState('');
  const [handpickedIds, setHandpickedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);

  const [handpickFilters, setHandpickFilters] = useState<HandpickFilterState>(DEFAULT_HANDPICK_FILTERS);
  const [showHandpickFilterPopup, setShowHandpickFilterPopup] = useState(false);
  const [handpickFilterAnchor, setHandpickFilterAnchor] = useState<HandpickFilterAnchorRect | null>(null);
  const [handpickPortalTarget, setHandpickPortalTarget] = useState<HTMLElement | null>(null);
  const [handpickDisplayLimit, setHandpickDisplayLimit] = useState(80);
  const handpickFilterBtnRef = useRef<HTMLButtonElement | null>(null);

  const [winner, setWinner] = useState<Restaurant | null>(null);
  const [isSlotSpinning, setIsSlotSpinning] = useState(false);
  const [reelIndex, setReelIndex] = useState(0);
  const slotTimerRef = useRef<number | null>(null);

  const anchor = useMemo(() => getUserAnchorCoords(profile), [profile]);
  const q = normalizeVietnameseSearch(searchQuery);

  const savedCollectionIdSet = useMemo(() => {
    const ids = new Set<string>();
    for (const col of profile.collections || []) {
      for (const id of col.restaurantIds || []) ids.add(id);
    }
    return ids;
  }, [profile.collections]);

  const resolvedIndexed = useMemo<IndexedRestaurant[]>(() => {
    if (indexedRestaurants && indexedRestaurants.length > 0) {
      return indexedRestaurants;
    }
    const now = new Date();
    return restaurants.map((r) => ({
      r,
      haystack: `${r.title} ${r.categoryName} ${r.address} ${r.neighborhood || ''}`.toLowerCase(),
      tastes: classifyRestaurantTastes(r),
      neighborhood: normalizeShortNeighborhood(r),
      open: getRestaurantOpenStatus(r, now),
      dietaryOk: matchesDietaryFilters(r, profile, now),
      distKm: calcDistanceKm(anchor, r.location),
      personalScore: computePersonalScore(r, profile, anchor, now),
    }));
  }, [indexedRestaurants, restaurants, profile, anchor]);

  const candidates = useMemo(() => {
    const excludedSet = new Set(excludedIds);
    const boost = (r: Restaurant) => {
      const hay = `${r.title} ${r.categoryName}`.toLowerCase();
      if (filters.companion === 'guests' || filters.companion === 'family') {
        if (/nhà hàng|cơm niêu|dê|tràng an|sen|bông lau|thành long|vũ bảo/i.test(hay)) return 25;
      }
      if (filters.companion === 'friends') {
        if (/lẩu|nướng|bia|nhậu|ốc|bbq|gogi|kichi/i.test(hay)) return 25;
      }
      if (filters.companion === 'couple') {
        if (/sushi|thái|mexico|hàn|cà phê|phố cổ|lẩu/i.test(hay)) return 22;
      }
      if (filters.companion === 'solo') {
        if (/phở|bún|miến|cơm thố|cơm tấm|bình dân|quán ăn nhỏ/i.test(hay)) return 22;
      }
      return 0;
    };

    return resolvedIndexed
      .filter((item) => {
        const { r, haystack, foldedHaystack, tastes, open, dietaryOk, distKm } = item;
        if (excludedSet.has(r.id)) return false;
        if (!dietaryOk) return false;
        if (filters.onlyOpen && !open.isOpenNow) return false;
        if (filters.onlyUserAdded && !r.isUserAdded) return false;
        if (q) {
          const hayNorm = foldedHaystack || normalizeVietnameseSearch(haystack);
          if (!hayNorm.includes(q)) return false;
        }

        const meta = profile.metaById[r.id];
        const effPrice = getEffectivePrice(r, meta?.customPrice);
        if (filters.onlyHasPrice && !effPrice) return false;
        if (filters.budgetFilter !== 'all' && classifyVenueByPrice(r, meta?.customPrice).tier !== filters.budgetFilter) {
          return false;
        }

        if (distKm > filters.radiusKm) return false;

        if (
          filters.selectedTastes.length > 0 &&
          !filters.selectedTastes.some((t) => tastes.includes(t))
        ) {
          return false;
        }

        if (filters.preset === 'top' && (r.totalScore ?? 0) < 4.7) return false;
        if (filters.preset === 'de' && !tastes.includes('de-comchay') && !tastes.includes('com-nieu')) return false;
        if (filters.preset === 'lau' && !tastes.includes('lau-nuong')) return false;
        if (filters.preset === 'sang' && !tastes.includes('pho-bun-mien')) return false;
        if (filters.preset === 'vat' && !tastes.includes('an-vat-che')) return false;
        if (filters.preset === 'dem' && !tastes.includes('an-dem')) return false;
        if (filters.preset === 'saved' && !meta?.favorite && !meta?.wishlist) return false;

        if (filters.meal === 'sang') {
          if (!tastes.includes('pho-bun-mien') && !r.categoryName.toLowerCase().includes('sáng')) {
            return false;
          }
        } else if (filters.meal === 'dem') {
          if (!tastes.includes('an-dem')) return false;
        } else if (filters.meal === 'chieu') {
          if (!tastes.includes('an-vat-che') && !tastes.includes('pho-bun-mien')) return false;
        } else if (filters.meal === 'trua' || filters.meal === 'toi') {
          if (
            !tastes.includes('com-nieu') &&
            !tastes.includes('de-comchay') &&
            !tastes.includes('lau-nuong') &&
            !tastes.includes('hai-san-ca-ro') &&
            !tastes.includes('nhau-bia') &&
            !tastes.includes('mon-chay') &&
            !tastes.includes('quoc-te')
          ) {
            return false;
          }
        }

        return true;
      })
      .map((item) => ({
        r: item.r,
        score: item.personalScore + boost(item.r),
      }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.r);
  }, [resolvedIndexed, excludedIds, profile.metaById, filters, q]);

  const wheelCandidates = useMemo(() => {
    const excludedSet = new Set(excludedIds);
    if (handpickedIds.length > 0) {
      const pickedSet = new Set(handpickedIds);
      const picked = restaurants.filter(
        (r) => pickedSet.has(r.id) && !excludedSet.has(r.id)
      );
      if (picked.length > 0) return picked;
    }
    if (shuffleSeed === 0 || candidates.length <= 1) return candidates;
    const copy = [...candidates];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = (i * 17 + shuffleSeed * 31) % (i + 1);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }, [handpickedIds, restaurants, excludedIds, candidates, shuffleSeed]);

  const activeHandpickFilterCount = useMemo(
    () => countActiveHandpickFilters(handpickFilters),
    [handpickFilters]
  );

  const { savedFilteredItems, allFilteredItems } = useMemo(() => {
    const excludedSet = new Set(excludedIds);
    const hq = normalizeVietnameseSearch(handpickSearch);
    const selectedBands = HANDPICK_PRICE_BANDS.filter((b) =>
      handpickFilters.priceBands.includes(b.key)
    );

    const matchesItem = (item: IndexedRestaurant) => {
      const { r, haystack, foldedHaystack, tastes, open, distKm } = item;
      const meta = profile.metaById[r.id];
      if (excludedSet.has(r.id) || meta?.blacklisted) return false;

      if (handpickFilters.onlyOpen && !open.isOpenNow) return false;
      if (handpickFilters.minRating45 && (r.totalScore ?? 0) < 4.5) return false;
      if (handpickFilters.popularOnly && (r.reviewsCount ?? 0) < 50) return false;
      if (handpickFilters.onlyHasPhoto && !r.imageUrl) return false;
      if (handpickFilters.hasReviews && !(r.reviews && r.reviews.length > 0)) return false;
      if (handpickFilters.onlyUserAdded && !r.isUserAdded) return false;
      if (handpickFilters.radiusKm !== null && distKm > handpickFilters.radiusKm) return false;

      const effPrice = getEffectivePrice(r, meta?.customPrice);
      if (handpickFilters.onlyHasPrice && !effPrice) return false;

      const tierInfo = classifyVenueByPrice(r, meta?.customPrice);
      if (handpickFilters.studentBudgetOnly) {
        const inBudget =
          tierInfo.tier === 'low' || matchesPriceSliderRange(r, meta?.customPrice, 0, 60);
        if (!inBudget) return false;
      }

      if (
        handpickFilters.tiers.length > 0 &&
        !handpickFilters.tiers.includes(tierInfo.tier)
      ) {
        return false;
      }

      if (selectedBands.length > 0) {
        const [pMin, pMax] = getEstimatedPriceRangeK(r, meta?.customPrice);
        const matchesBand = selectedBands.some((b) => pMin <= b.maxK && pMax >= b.minK);
        if (!matchesBand) return false;
      }

      if (
        handpickFilters.tastes.length > 0 &&
        !handpickFilters.tastes.some((t) => tastes.includes(t))
      ) {
        return false;
      }

      if (hq) {
        const hayNorm = foldedHaystack || normalizeVietnameseSearch(haystack);
        if (!hayNorm.includes(hq)) return false;
      }

      return true;
    };

    const allMatched = resolvedIndexed.filter(matchesItem);

    allMatched.sort((a, b) => {
      if (handpickFilters.sortBy === 'nearest') {
        return a.distKm - b.distKm;
      }
      if (handpickFilters.sortBy === 'rating') {
        const sDiff = (b.r.totalScore ?? 0) - (a.r.totalScore ?? 0);
        if (sDiff !== 0) return sDiff;
        return (b.r.reviewsCount ?? 0) - (a.r.reviewsCount ?? 0);
      }
      if (handpickFilters.sortBy === 'cheap') {
        const metaA = profile.metaById[a.r.id];
        const metaB = profile.metaById[b.r.id];
        const pDiff =
          getEstimatedPriceRangeK(a.r, metaA?.customPrice)[0] -
          getEstimatedPriceRangeK(b.r, metaB?.customPrice)[0];
        if (pDiff !== 0) return pDiff;
        return a.distKm - b.distKm;
      }
      return b.personalScore - a.personalScore;
    });

    const savedMatched = allMatched.filter(({ r }) => {
      const meta = profile.metaById[r.id];
      return Boolean(
        meta?.favorite ||
          meta?.wishlist ||
          meta?.visited ||
          savedCollectionIdSet.has(r.id)
      );
    });

    return { savedFilteredItems: savedMatched, allFilteredItems: allMatched };
  }, [
    resolvedIndexed,
    excludedIds,
    handpickSearch,
    handpickFilters,
    profile.metaById,
    savedCollectionIdSet,
  ]);

  const activeHandpickItems = handpickTab === 'saved' ? savedFilteredItems : allFilteredItems;
  const visibleHandpickItems = activeHandpickItems.slice(0, handpickDisplayLimit);

  const handpickedIdSet = useMemo(() => new Set(handpickedIds), [handpickedIds]);

  const allActiveMatchedSelected =
    activeHandpickItems.length > 0 &&
    activeHandpickItems.every((item) => handpickedIdSet.has(item.r.id));

  const toggleSelectAllMatched = useCallback(() => {
    if (activeHandpickItems.length === 0) return;
    const matchIds = activeHandpickItems.map((item) => item.r.id);
    const matchSet = new Set(matchIds);
    playTapTick(profile.glass.soundEnabled ?? true);
    if (allActiveMatchedSelected) {
      setHandpickedIds((prev) => prev.filter((id) => !matchSet.has(id)));
    } else {
      setHandpickedIds((prev) => Array.from(new Set([...prev, ...matchIds])));
    }
    setWinner(null);
  }, [activeHandpickItems, allActiveMatchedSelected, profile.glass.soundEnabled]);

  const handleToggleFilterPopup = useCallback(() => {
    const btn = handpickFilterBtnRef.current;
    const shell = (btn?.closest('.phone-shell') as HTMLElement | null) || document.body;
    if (btn && shell) {
      const br = btn.getBoundingClientRect();
      const sr = shell.getBoundingClientRect();
      const rawTop = Math.round(br.bottom - sr.top + 8);
      const top = Math.max(54, Math.min(rawTop, Math.max(54, sr.height - 310)));
      const maxHeight = Math.max(240, Math.min(480, sr.height - top - 14));
      const right = Math.max(12, Math.round(sr.right - br.right));
      setHandpickPortalTarget(shell);
      setHandpickFilterAnchor({ top, right, maxHeight });
    }
    playTapTick(profile.glass.soundEnabled ?? true);
    setShowHandpickFilterPopup((v) => !v);
  }, [profile.glass.soundEnabled]);

  const updateHandpickFilters = useCallback(
    (updater: React.SetStateAction<HandpickFilterState>) => {
      setHandpickFilters(updater);
      setHandpickDisplayLimit(80);
    },
    []
  );

  const handleSpinSlot = () => {
    const pool = wheelCandidates;
    if (pool.length === 0 || isSlotSpinning) return;
    if (slotTimerRef.current) window.clearTimeout(slotTimerRef.current);

    setIsSlotSpinning(true);
    setWinner(null);
    const chosenIdx = Math.floor(Math.random() * pool.length);
    const chosen = pool[chosenIdx];

    let step = 0;
    const totalSteps = 20;
    const tick = () => {
      step += 1;
      setReelIndex(Math.floor(Math.random() * pool.length));
      playTapTick(profile.glass.soundEnabled ?? true);
      if (step >= totalSteps) {
        setReelIndex(chosenIdx);
        setWinner(chosen);
        setIsSlotSpinning(false);
        playChimeSuccess(profile.glass.soundEnabled ?? true);
        if ((profile.glass.confettiEnabled ?? true) && !profile.glass.reduceMotion) {
          spawnCelebrationConfetti(document.querySelector('.phone-shell'));
        }
        return;
      }
      slotTimerRef.current = window.setTimeout(tick, 50 + Math.pow(step / totalSteps, 2.2) * 195);
    };
    tick();
  };

  const slotPool = wheelCandidates;
  const activeSlotItem = slotPool[reelIndex % Math.max(1, slotPool.length)] || null;
  const winnerPrice = winner ? getEffectivePrice(winner, profile.metaById[winner.id]?.customPrice) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {/* Open Apple Maps Header (No outer card frame) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '2px 2px 0',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="apple-section-title">Chọn món</h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {handpickedIds.length > 0 ? (
              <>
                Đang quay <strong style={{ color: 'var(--accent)' }}>{wheelCandidates.length}</strong> quán tự chọn
              </>
            ) : (
              <>
                Tất cả <strong style={{ color: 'var(--accent)' }}>{wheelCandidates.length}</strong> ảnh quán
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {onOpenSearch && (
            <button
              type="button"
              className={`apple-icon-btn ${hasSearchText ? 'active' : ''}`}
              onClick={onOpenSearch}
              aria-label="Tìm kiếm"
              title="Tìm kiếm quán cho vòng quay"
            >
              <Search size={15} />
              {hasSearchText && <span className="icon-badge-dot">•</span>}
            </button>
          )}
          {onOpenChoice && (
            <button
              type="button"
              className={`apple-icon-btn ${choiceBadgeCount > 0 ? 'active' : ''}`}
              onClick={onOpenChoice}
              aria-label="Lựa chọn"
              title="Lựa chọn món, bữa, khu vực"
            >
              <SlidersHorizontal size={15} />
              {choiceBadgeCount > 0 && <span className="icon-badge-dot">{choiceBadgeCount}</span>}
            </button>
          )}
          <button
            type="button"
            className="lg-btn-accent"
            style={{ minHeight: 36, padding: '6px 12px', fontSize: 12 }}
            onClick={onOpenTinderFullScreen}
          >
            <Flame size={14} /> Tinder
          </button>
        </div>
      </div>

      {onOpenGroupVote && (
        <button
          type="button"
          className="lg-pill"
          onClick={() => onOpenGroupVote(wheelCandidates)}
          style={{
            width: '100%',
            minHeight: 40,
            borderRadius: 15,
            justifyContent: 'space-between',
            padding: '0 13px',
            background: 'rgba(56, 189, 248, 0.14)',
            borderColor: 'rgba(56, 189, 248, 0.36)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800 }}>
            <Users size={15} /> Bình chọn nhóm (2–5 người)
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.88 }}>
            Tạo phòng & link chia sẻ →
          </span>
        </button>
      )}

      {/* Unified iOS 3-Way Segmented Control */}
      <div className="apple-segmented" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <button
          type="button"
          className={`apple-segment-btn ${spinStyle === 'wheel' && !showCustomHandpick ? 'active' : ''}`}
          onClick={() => {
            setShowHandpickFilterPopup(false);
            setShowCustomHandpick(false);
            setSpinStyle('wheel');
          }}
        >
          🖼️ Vòng ảnh ({wheelCandidates.length})
        </button>
        <button
          type="button"
          className={`apple-segment-btn ${spinStyle === 'slot' && !showCustomHandpick ? 'active' : ''}`}
          onClick={() => {
            setShowHandpickFilterPopup(false);
            setShowCustomHandpick(false);
            setSpinStyle('slot');
          }}
        >
          <Dices size={13} /> Quay nhanh
        </button>
        <button
          type="button"
          className={`apple-segment-btn ${showCustomHandpick ? 'active' : ''}`}
          onClick={() => {
            setShowHandpickFilterPopup(false);
            setShowCustomHandpick((v) => !v);
          }}
        >
          <ListChecks size={13} /> Tự chọn ({handpickedIds.length})
        </button>
      </div>

      {/* Custom Handpick Sheet with HyperOS Multi-Select Filter Icon */}
      {showCustomHandpick && (
        <div
          className="lg-surface inline-expand-panel"
          style={{
            borderRadius: 20,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 'min(430px, 58dvh)',
            overflow: 'hidden',
          }}
        >
          {/* Row 1: Saved/All Pool Tabs + Quick Select All + HyperOS Filter Icon */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 5, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
              <button
                type="button"
                className={`lg-pill ${handpickTab === 'saved' ? 'active' : ''}`}
                style={{ minHeight: 30, padding: '2px 10px', fontSize: 11.5 }}
                onClick={() => {
                  setHandpickTab('saved');
                  setHandpickDisplayLimit(80);
                }}
              >
                <Heart size={12} /> Đã lưu ({savedFilteredItems.length})
              </button>
              <button
                type="button"
                className={`lg-pill ${handpickTab === 'all' ? 'active' : ''}`}
                style={{ minHeight: 30, padding: '2px 10px', fontSize: 11.5 }}
                onClick={() => {
                  setHandpickTab('all');
                  setHandpickDisplayLimit(80);
                }}
              >
                🍽️ Tất cả ({allFilteredItems.length})
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {activeHandpickItems.length > 0 && (
                <button
                  type="button"
                  className={`lg-pill ${allActiveMatchedSelected ? 'active' : ''}`}
                  style={{ minHeight: 30, padding: '2px 9px', fontSize: 11 }}
                  onClick={toggleSelectAllMatched}
                  title="Chọn hoặc bỏ chọn toàn bộ quán đang khớp lọc"
                >
                  {allActiveMatchedSelected ? '✓ Đã chọn hết' : `Chọn hết (${activeHandpickItems.length})`}
                </button>
              )}
              <button
                ref={handpickFilterBtnRef}
                type="button"
                className={`apple-icon-btn ${showHandpickFilterPopup || activeHandpickFilterCount > 0 ? 'active' : ''}`}
                style={{ width: 34, height: 34 }}
                onClick={handleToggleFilterPopup}
                aria-label="Bộ lọc Tự chọn"
                aria-haspopup="dialog"
                aria-expanded={showHandpickFilterPopup}
                title="Mở bộ lọc Tự chọn (nhiều lựa chọn kết hợp)"
              >
                <ListFilter size={15} />
                {activeHandpickFilterCount > 0 && (
                  <span className="icon-badge-dot">{activeHandpickFilterCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Search Input + Clear Picked + Done */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: 10.5, color: 'var(--text-muted)' }} />
              <input
                className="lg-input"
                aria-label="Tìm quán trong Tự chọn"
                style={{ minHeight: 34, padding: '4px 10px 4px 28px', fontSize: 12 }}
                placeholder={
                  handpickTab === 'saved'
                    ? 'Tìm trong quán đã lưu của bạn…'
                    : 'Tìm tên quán, món ăn, đường…'
                }
                value={handpickSearch}
                onChange={(e) => {
                  setHandpickSearch(e.target.value);
                  setHandpickDisplayLimit(80);
                }}
              />
            </div>
            {handpickedIds.length > 0 && (
              <button
                type="button"
                className="lg-pill"
                style={{ minHeight: 32, padding: '2px 9px', fontSize: 11 }}
                onClick={() => setHandpickedIds([])}
              >
                Xoá ({handpickedIds.length})
              </button>
            )}
            <button
              type="button"
              className="lg-pill active"
              style={{ minHeight: 32, padding: '2px 10px', fontSize: 11 }}
              onClick={() => {
                setShowHandpickFilterPopup(false);
                setShowCustomHandpick(false);
              }}
            >
              Xong
            </button>
          </div>

          {/* Row 3: Active Combinable Filter Chips Summary (compact, removable 1-tap) */}
          {activeHandpickFilterCount > 0 && (
            <div
              className="h-scroll-row"
              style={{ gap: 5, flexShrink: 0, alignItems: 'center', minHeight: 28, padding: '1px 2px 3px' }}
            >
              {handpickFilters.studentBudgetOnly && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, studentBudgetOnly: false }))}
                >
                  🎓 SV ≤ 60k <X size={10} />
                </button>
              )}
              {handpickFilters.radiusKm !== null && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, radiusKm: null }))}
                >
                  📍 &lt; {handpickFilters.radiusKm}km <X size={10} />
                </button>
              )}
              {handpickFilters.onlyOpen && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, onlyOpen: false }))}
                >
                  🟢 Đang mở <X size={10} />
                </button>
              )}
              {handpickFilters.minRating45 && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, minRating45: false }))}
                >
                  ⭐ ≥ 4.5★ <X size={10} />
                </button>
              )}
              {handpickFilters.popularOnly && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, popularOnly: false }))}
                >
                  🔥 ≥ 50 ĐG <X size={10} />
                </button>
              )}
              {handpickFilters.onlyHasPrice && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, onlyHasPrice: false }))}
                >
                  💰 Có giá <X size={10} />
                </button>
              )}
              {handpickFilters.onlyHasPhoto && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, onlyHasPhoto: false }))}
                >
                  🖼️ Có ảnh <X size={10} />
                </button>
              )}
              {handpickFilters.hasReviews && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, hasReviews: false }))}
                >
                  💬 Có review <X size={10} />
                </button>
              )}
              {handpickFilters.onlyUserAdded && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, onlyUserAdded: false }))}
                >
                  ➕ Tự thêm <X size={10} />
                </button>
              )}
              {handpickFilters.tiers.map((tierKey) => {
                const tOpt = HANDPICK_TIER_OPTIONS.find((x) => x.key === tierKey);
                return (
                  <button
                    key={`act-tier-${tierKey}`}
                    type="button"
                    className="lg-pill active"
                    style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                    onClick={() =>
                      updateHandpickFilters((f) => ({
                        ...f,
                        tiers: f.tiers.filter((x) => x !== tierKey),
                      }))
                    }
                  >
                    {tOpt?.label || tierKey} <X size={10} />
                  </button>
                );
              })}
              {handpickFilters.priceBands.map((bandKey) => {
                const bOpt = HANDPICK_PRICE_BANDS.find((x) => x.key === bandKey);
                return (
                  <button
                    key={`act-band-${bandKey}`}
                    type="button"
                    className="lg-pill active"
                    style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                    onClick={() =>
                      updateHandpickFilters((f) => ({
                        ...f,
                        priceBands: f.priceBands.filter((x) => x !== bandKey),
                      }))
                    }
                  >
                    {bOpt?.label || bandKey} <X size={10} />
                  </button>
                );
              })}
              {handpickFilters.tastes.map((tasteKey) => {
                const tOpt = TASTE_OPTIONS.find((x) => x.key === tasteKey);
                return (
                  <button
                    key={`act-taste-${tasteKey}`}
                    type="button"
                    className="lg-pill active"
                    style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                    onClick={() =>
                      updateHandpickFilters((f) => ({
                        ...f,
                        tastes: f.tastes.filter((x) => x !== tasteKey),
                      }))
                    }
                  >
                    {tOpt ? `${tOpt.emoji} ${tOpt.label}` : tasteKey} <X size={10} />
                  </button>
                );
              })}
              {handpickFilters.sortBy !== 'smart' && (
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                  onClick={() => updateHandpickFilters((f) => ({ ...f, sortBy: 'smart' }))}
                >
                  {handpickFilters.sortBy === 'nearest'
                    ? '📍 Gần nhất'
                    : handpickFilters.sortBy === 'rating'
                    ? '⭐ Sao cao'
                    : '💸 Giá mềm'}{' '}
                  <X size={10} />
                </button>
              )}
              <button
                type="button"
                className="lg-pill"
                style={{ minHeight: 24, padding: '1px 8px', fontSize: 10.5 }}
                onClick={() => updateHandpickFilters(DEFAULT_HANDPICK_FILTERS)}
              >
                <RotateCcw size={10} /> Đặt lại
              </button>
            </div>
          )}

          {/* Row 4: Matching Restaurants Checklist */}
          <div
            className="codovi-subtle-scroll"
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              paddingRight: 2,
            }}
          >
            {visibleHandpickItems.length === 0 ? (
              <div
                style={{
                  padding: '14px 10px',
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>
                  {handpickTab === 'saved'
                    ? savedFilteredItems.length === 0 && !handpickSearch && activeHandpickFilterCount === 0
                      ? 'Chưa có quán nào trong khu Đã lưu. Hãy thả tim ❤️ quán bạn thích hoặc xem tab "Tất cả"!'
                      : 'Không có quán đã lưu nào khớp từ khoá & bộ lọc hiện tại.'
                    : 'Không tìm thấy quán nào khớp bộ lọc đang kết hợp.'}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {handpickTab === 'saved' && allFilteredItems.length > 0 && (
                    <button
                      type="button"
                      className="lg-pill active"
                      style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}
                      onClick={() => {
                        setHandpickTab('all');
                        setHandpickDisplayLimit(80);
                      }}
                    >
                      Xem {allFilteredItems.length} quán ở Tất cả →
                    </button>
                  )}
                  {(activeHandpickFilterCount > 0 || handpickSearch) && (
                    <button
                      type="button"
                      className="lg-pill"
                      style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}
                      onClick={() => {
                        setHandpickFilters(DEFAULT_HANDPICK_FILTERS);
                        setHandpickSearch('');
                      }}
                    >
                      <RotateCcw size={11} /> Đặt lại bộ lọc
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {visibleHandpickItems.map(({ r, distKm, open }) => {
                  const checked = handpickedIdSet.has(r.id);
                  const meta = profile.metaById[r.id];
                  const inCol = savedCollectionIdSet.has(r.id);
                  const effPrice = getEffectivePrice(r, meta?.customPrice);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setHandpickedIds((prev) =>
                          prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                        );
                        setWinner(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '7px 10px',
                        borderRadius: 12,
                        border: checked ? '1px solid var(--accent)' : '1px solid transparent',
                        background: checked ? 'var(--accent-soft)' : 'rgba(255,255,255,0.04)',
                        color: 'var(--text-primary)',
                        fontSize: 12.5,
                        fontWeight: checked ? 700 : 500,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                        {meta?.favorite && <Heart size={11} color="#fb7185" fill="#fb7185" style={{ flexShrink: 0 }} />}
                        {!meta?.favorite && meta?.wishlist && <Bookmark size={11} color="#38bdf8" style={{ flexShrink: 0 }} />}
                        {!meta?.favorite && !meta?.wishlist && meta?.visited && (
                          <CheckCircle2 size={11} color="#4ade80" style={{ flexShrink: 0 }} />
                        )}
                        {!meta?.favorite && !meta?.wishlist && !meta?.visited && inCol && (
                          <FolderHeart size={11} color="var(--accent)" style={{ flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {r.title}
                          </div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: 'var(--text-secondary)',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: 1,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {open.isOpenNow ? '🟢 Mở' : open.state === 'closed' ? '⚪ Đóng' : '🕒 Quán'}
                            {' · '}
                            {formatDistance(distKm)}
                            {effPrice ? ` · ${effPrice}` : ''}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {r.totalScore ? `${r.totalScore.toFixed(1)}★` : ''}
                      </span>
                      {checked && <Check size={14} color="var(--accent)" style={{ flexShrink: 0 }} />}
                    </button>
                  );
                })}
                {activeHandpickItems.length > handpickDisplayLimit && (
                  <button
                    type="button"
                    className="lg-pill"
                    style={{ minHeight: 30, fontSize: 11.5, alignSelf: 'center', marginTop: 4 }}
                    onClick={() => setHandpickDisplayLimit((n) => n + 80)}
                  >
                    Xem thêm (+{activeHandpickItems.length - handpickDisplayLimit} quán)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Anchored HyperOS Multi-Select Filter Popup */}
      <HandpickFilterPopup
        isOpen={showCustomHandpick && showHandpickFilterPopup}
        anchorRect={handpickFilterAnchor}
        portalContainer={handpickPortalTarget}
        filters={handpickFilters}
        onChangeFilters={updateHandpickFilters}
        matchedCount={activeHandpickItems.length}
        handpickTab={handpickTab}
        allMatchedCount={allFilteredItems.length}
        onSwitchToAllTab={() => {
          setHandpickTab('all');
          setHandpickDisplayLimit(80);
        }}
        onSelectAllMatched={toggleSelectAllMatched}
        allMatchedSelected={allActiveMatchedSelected}
        soundEnabled={profile.glass.soundEnabled ?? true}
        onClose={() => setShowHandpickFilterPopup(false)}
      />

      {/* Wheel / Slot Arena */}
      {candidates.length === 0 && handpickedIds.length === 0 ? (
        <div className="lg-surface" style={{ borderRadius: 22, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🍜</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Không có quán khớp lựa chọn này</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '6px 0 14px' }}>
            Nhấn biểu tượng Lựa chọn hoặc Tìm kiếm ở góc trên để chỉnh lại điều kiện nhé.
          </p>
          <button
            type="button"
            className="lg-btn-accent"
            onClick={() => {
              setExcludedIds([]);
              setHandpickedIds([]);
              setWinner(null);
              onResetFilters();
            }}
          >
            <RotateCcw size={14} /> Đặt lại tất cả lựa chọn
          </button>
        </div>
      ) : (
        <div
          className="lg-surface"
          style={{ borderRadius: 24, padding: 12, display: 'flex', flexDirection: 'column', gap: 11 }}
        >
          {spinStyle === 'wheel' ? (
            <PhotoLuckyWheel
              items={wheelCandidates}
              metaById={profile.metaById}
              soundEnabled={profile.glass.soundEnabled ?? true}
              onSpinStart={() => setWinner(null)}
              onWinner={(picked) => {
                setWinner(picked);
                playChimeSuccess(profile.glass.soundEnabled ?? true);
                if ((profile.glass.confettiEnabled ?? true) && !profile.glass.reduceMotion) {
                  spawnCelebrationConfetti(document.querySelector('.phone-shell'));
                }
              }}
              onPreviewRestaurant={onSelectRestaurant}
              onShufflePool={() => {
                setShuffleSeed((s) => s + 1);
                setWinner(null);
              }}
            />
          ) : (
            activeSlotItem && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  onClick={() => !isSlotSpinning && onSelectRestaurant(activeSlotItem)}
                  style={{
                    borderRadius: 18,
                    overflow: 'hidden',
                    border: winner ? '1.5px solid var(--accent)' : '1px solid var(--glass-hairline)',
                    height: 220,
                    position: 'relative',
                    cursor: isSlotSpinning ? 'wait' : 'pointer',
                  }}
                >
                  {!isSlotSpinning && activeSlotItem.imageUrl ? (
                    <img
                      src={getCrispPhotoUrl(activeSlotItem.imageUrl, 640) || activeSlotItem.imageUrl}
                      alt={activeSlotItem.title}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--accent-soft)',
                        fontSize: 40,
                      }}
                    >
                      {isSlotSpinning ? '🎰' : '🍽️'}
                    </div>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.82) 100%)',
                    }}
                  />
                  <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, color: '#fff' }}>
                    <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
                      {activeSlotItem.categoryName} · {normalizeShortNeighborhood(activeSlotItem)}
                    </div>
                    <div style={{ fontSize: 16.5, fontWeight: 800, lineHeight: 1.25, marginTop: 2 }}>
                      {activeSlotItem.title}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="lg-btn-accent"
                  onClick={handleSpinSlot}
                  disabled={isSlotSpinning}
                  style={{ width: '100%', minHeight: 46 }}
                >
                  <Dices size={17} /> {isSlotSpinning ? 'Đang quay...' : `Quay nhanh (${slotPool.length} quán)`}
                </button>
              </div>
            )
          )}

          {/* Clean Apple Winner Callout */}
          {winner && !isSlotSpinning && (
            <div
              className="lg-surface-quiet"
              style={{
                borderRadius: 18,
                padding: 12,
                borderColor: 'var(--accent)',
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                animation: 'slideUpSpring 0.25s var(--spring)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)' }}>
                  🎉 KẾT QUẢ CHỌN ĐƯỢC
                </span>
                <button
                  type="button"
                  onClick={() => setWinner(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                  aria-label="Đóng kết quả"
                >
                  <X size={15} />
                </button>
              </div>

              <div
                onClick={() => onSelectRestaurant(winner)}
                style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}
              >
                {winner.imageUrl && (
                  <img
                    src={getCrispPhotoUrl(winner.imageUrl, 480) || winner.imageUrl}
                    alt={winner.title}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    style={{ width: 60, height: 60, borderRadius: 13, objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{winner.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {winner.totalScore !== null && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Star size={11} fill="#fbbf24" color="#fbbf24" /> {winner.totalScore.toFixed(1)}
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <MapPin size={11} /> {formatDistance(calcDistanceKm(anchor, winner.location))} · {estimateMinutes(calcDistanceKm(anchor, winner.location))}p
                    </span>
                    {winnerPrice && (
                      <span className="price-pill-highlight" style={{ fontSize: 10.5, padding: '1.5px 7px' }}>
                        <Banknote size={10} /> {winnerPrice}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="lg-btn-accent"
                  style={{ flex: 1, minHeight: 38, padding: '6px 12px', fontSize: 12.5 }}
                  onClick={() => {
                    onRecordPick(winner, 'wheel', filters.companion);
                    onSelectRestaurant(winner);
                  }}
                >
                  <Sparkles size={14} /> Chốt đi quán này
                </button>
                <a
                  href={buildMapsDirectionUrl(winner, profile.glass.mapsApp || 'google')}
                  target="_blank"
                  rel="noreferrer"
                  className="lg-pill"
                  style={{ minHeight: 38, padding: '6px 11px', fontSize: 12, textDecoration: 'none' }}
                >
                  <Compass size={14} /> {profile.glass.mapsApp === 'apple' ? 'Apple Maps' : 'Maps'}
                </a>
                <button
                  type="button"
                  className="lg-pill"
                  style={{ minHeight: 38, padding: '6px 10px', fontSize: 12, color: '#fca5a5' }}
                  onClick={() => {
                    setExcludedIds((prev) => [...prev, winner.id]);
                    setWinner(null);
                  }}
                  title="Loại quán này khỏi vòng quay để quay tiếp"
                >
                  <Ban size={13} /> Loại & Quay lại
                </button>
              </div>
            </div>
          )}

          {excludedIds.length > 0 && (
            <button
              type="button"
              className="lg-pill"
              style={{ minHeight: 28, fontSize: 11, alignSelf: 'center' }}
              onClick={() => setExcludedIds([])}
            >
              <RotateCcw size={12} /> Khôi phục {excludedIds.length} quán vừa loại
            </button>
          )}
        </div>
      )}
    </div>
  );
};
