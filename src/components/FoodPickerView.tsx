import React, { useMemo, useRef, useState } from 'react';
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
  getRestaurantOpenStatus,
  getUserAnchorCoords,
  matchesDietaryFilters,
  normalizeShortNeighborhood,
  normalizeVietnameseSearch,
} from '../utils/restaurantUtils';
import { playChimeSuccess, playTapTick, spawnCelebrationConfetti } from '../utils/feedbackUtils';
import { PhotoLuckyWheel } from './PhotoLuckyWheel';

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
  const [handpickTab, setHandpickTab] = useState<'saved' | 'all'>('saved');
  const [handpickSearch, setHandpickSearch] = useState('');
  const [handpickedIds, setHandpickedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);

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

    const source: IndexedRestaurant[] = indexedRestaurants
      ? indexedRestaurants
      : (() => {
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
        })();

    return source
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
  }, [indexedRestaurants, restaurants, excludedIds, profile, filters, q, anchor]);

  const savedHandpickPool = useMemo(() => {
    return restaurants.filter((r) => {
      if (excludedIds.includes(r.id)) return false;
      const meta = profile.metaById[r.id];
      return Boolean(
        meta?.favorite ||
          meta?.wishlist ||
          meta?.visited ||
          savedCollectionIdSet.has(r.id)
      );
    });
  }, [restaurants, excludedIds, profile.metaById, savedCollectionIdSet]);

  const wheelCandidates = useMemo(() => {
    if (handpickedIds.length > 0) {
      const picked = restaurants.filter(
        (r) => handpickedIds.includes(r.id) && !excludedIds.includes(r.id)
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

  const handpickList = useMemo(() => {
    const hq = normalizeVietnameseSearch(handpickSearch);
    const base =
      handpickTab === 'saved'
        ? savedHandpickPool
        : candidates.length > 0
        ? candidates
        : restaurants;
    if (!hq) return handpickTab === 'saved' ? base : base.slice(0, 60);
    return base.filter((r) =>
      normalizeVietnameseSearch(`${r.title} ${r.categoryName} ${r.address}`).includes(hq)
    );
  }, [handpickTab, handpickSearch, savedHandpickPool, candidates, restaurants]);

  const allSavedSelected =
    savedHandpickPool.length > 0 &&
    savedHandpickPool.every((r) => handpickedIds.includes(r.id));

  const toggleSelectAllSaved = () => {
    if (savedHandpickPool.length === 0) return;
    const savedIds = savedHandpickPool.map((r) => r.id);
    if (allSavedSelected) {
      setHandpickedIds((prev) => prev.filter((id) => !savedIds.includes(id)));
    } else {
      setHandpickedIds((prev) => Array.from(new Set([...prev, ...savedIds])));
    }
    setWinner(null);
  };

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
            setShowCustomHandpick(false);
            setSpinStyle('slot');
          }}
        >
          <Dices size={13} /> Quay nhanh
        </button>
        <button
          type="button"
          className={`apple-segment-btn ${showCustomHandpick ? 'active' : ''}`}
          onClick={() => setShowCustomHandpick((v) => !v)}
        >
          <ListChecks size={13} /> Tự chọn ({handpickedIds.length})
        </button>
      </div>

      {/* Custom Handpick Sheet with Dedicated Khu Đã Lưu */}
      {showCustomHandpick && (
        <div
          className="lg-surface inline-expand-panel"
          style={{
            borderRadius: 20,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            maxHeight: 300,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                type="button"
                className={`lg-pill ${handpickTab === 'saved' ? 'active' : ''}`}
                style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}
                onClick={() => setHandpickTab('saved')}
              >
                <Heart size={12} /> Khu Đã Lưu ({savedHandpickPool.length})
              </button>
              <button
                type="button"
                className={`lg-pill ${handpickTab === 'all' ? 'active' : ''}`}
                style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}
                onClick={() => setHandpickTab('all')}
              >
                🍽️ Tất cả quán ({candidates.length || restaurants.length})
              </button>
            </div>

            {handpickTab === 'saved' && savedHandpickPool.length > 0 && (
              <button
                type="button"
                className={`lg-pill ${allSavedSelected ? 'active' : ''}`}
                style={{ minHeight: 28, padding: '2px 9px', fontSize: 11 }}
                onClick={toggleSelectAllSaved}
              >
                {allSavedSelected ? '✓ Đã chọn hết Đã lưu' : 'Chọn tất cả Đã lưu'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
              <input
                className="lg-input"
                style={{ minHeight: 34, padding: '4px 10px 4px 28px', fontSize: 12 }}
                placeholder={
                  handpickTab === 'saved'
                    ? 'Tìm trong quán đã lưu của bạn...'
                    : 'Tìm quán để tick đưa vào vòng quay...'
                }
                value={handpickSearch}
                onChange={(e) => setHandpickSearch(e.target.value)}
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
              onClick={() => setShowCustomHandpick(false)}
            >
              Xong
            </button>
          </div>

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {handpickList.length === 0 ? (
              <div
                style={{
                  padding: '14px 10px',
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                }}
              >
                {handpickTab === 'saved'
                  ? savedHandpickPool.length === 0
                    ? 'Chưa có quán nào trong khu Đã lưu. Hãy thả tim ❤️ quán bạn thích hoặc chuyển sang "Tất cả quán" nhé!'
                    : `Không có quán đã lưu nào khớp "${handpickSearch}".`
                  : 'Không tìm thấy quán khớp từ khoá.'}
              </div>
            ) : (
              handpickList.map((r) => {
                const checked = handpickedIds.includes(r.id);
                const meta = profile.metaById[r.id];
                const inCol = savedCollectionIdSet.has(r.id);
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                      {meta?.favorite && <Heart size={11} color="#fb7185" fill="#fb7185" style={{ flexShrink: 0 }} />}
                      {!meta?.favorite && meta?.wishlist && <Bookmark size={11} color="#38bdf8" style={{ flexShrink: 0 }} />}
                      {!meta?.favorite && !meta?.wishlist && meta?.visited && (
                        <CheckCircle2 size={11} color="#4ade80" style={{ flexShrink: 0 }} />
                      )}
                      {!meta?.favorite && !meta?.wishlist && !meta?.visited && inCol && (
                        <FolderHeart size={11} color="var(--accent)" style={{ flexShrink: 0 }} />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {r.totalScore ? `${r.totalScore.toFixed(1)}★` : ''}
                    </span>
                    {checked && <Check size={14} color="var(--accent)" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

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
