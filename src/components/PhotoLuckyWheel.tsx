import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Dices, Shuffle, Sparkles, Star, Utensils } from 'lucide-react';
import { PersonalRestaurantMeta, Restaurant } from '../types/restaurant';
import { playTapTick } from '../utils/feedbackUtils';
import { getCrispPhotoUrl, getEffectivePrice } from '../utils/restaurantUtils';

interface PhotoLuckyWheelProps {
  items: Restaurant[];
  metaById: Record<string, PersonalRestaurantMeta>;
  soundEnabled?: boolean;
  onWinner: (winner: Restaurant) => void;
  onSpinStart?: () => void;
  onPreviewRestaurant?: (r: Restaurant) => void;
  onShufflePool?: () => void;
}

const CARD_W = 204;
const CARD_GAP = 12;
const STEP_W = CARD_W + CARD_GAP; // 216px per photo card slot
const LOOP_PAD = 8;

function getInitialViewportWidth(): number {
  if (typeof window === 'undefined') return 338;
  return Math.max(260, Math.min(406, window.innerWidth) - 52);
}

function getLiveTranslateX(el: HTMLDivElement | null, fallback: number): number {
  if (!el) return fallback;
  const t = window.getComputedStyle(el).transform;
  if (!t || t === 'none') return fallback;
  const m2d = t.match(/matrix\(([^)]+)\)/);
  if (m2d) {
    const parts = m2d[1].split(',');
    const tx = parseFloat(parts[4]);
    return Number.isFinite(tx) ? tx : fallback;
  }
  const m3d = t.match(/matrix3d\(([^)]+)\)/);
  if (m3d) {
    const parts = m3d[1].split(',');
    const tx = parseFloat(parts[12]);
    return Number.isFinite(tx) ? tx : fallback;
  }
  return fallback;
}

export const PhotoLuckyWheel: React.FC<PhotoLuckyWheelProps> = ({
  items,
  metaById,
  soundEnabled = true,
  onWinner,
  onSpinStart,
  onPreviewRestaurant,
  onShufflePool,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const spinTimerRef = useRef<number | null>(null);

  const pool = items;

  const buildRestingStrip = useCallback((source: Restaurant[]) => {
    if (source.length === 0) return { list: [] as Restaurant[], baseStart: 0 };
    if (source.length === 1) return { list: [source[0]], baseStart: 0 };
    if (source.length < 15) {
      const repeated = [...source, ...source, ...source, ...source, ...source];
      return { list: repeated, baseStart: source.length * 2 };
    }
    const headPad = source.slice(-LOOP_PAD);
    const tailPad = source.slice(0, LOOP_PAD);
    return {
      list: [...headPad, ...source, ...tailPad],
      baseStart: LOOP_PAD,
    };
  }, []);

  const restingData = useMemo(() => buildRestingStrip(pool), [pool, buildRestingStrip]);

  const [viewportWidth, setViewportWidth] = useState<number>(getInitialViewportWidth);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinStrip, setSpinStrip] = useState<Restaurant[] | null>(null);
  const [manualOffset, setManualOffset] = useState<number | null>(null);
  const [transitionCss, setTransitionCss] = useState<string>('none');
  const [focusedRestId, setFocusedRestId] = useState<string | null>(() => {
    const initialIdx =
      restingData.baseStart + (pool.length < 15 ? Math.floor(pool.length / 2) : 0);
    return restingData.list[initialIdx]?.id || null;
  });
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [windowRange, setWindowRange] = useState<[number, number]>(() => {
    const initialIdx =
      restingData.baseStart + (pool.length < 15 ? Math.floor(pool.length / 2) : 0);
    return [Math.max(0, initialIdx - 6), Math.min(Math.max(0, restingData.list.length - 1), initialIdx + 6)];
  });

  // Stagger offscreen thumbnail strip mount so tab enter animation stays 60fps
  const [thumbLimit, setThumbLimit] = useState<number>(() => Math.min(pool.length, 16));

  useEffect(() => {
    if (pool.length <= 16) {
      setThumbLimit(pool.length);
      return;
    }
    setThumbLimit(16);
    const t = window.setTimeout(() => setThumbLimit(pool.length), 260);
    return () => window.clearTimeout(t);
  }, [pool.length]);

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startOffset: number;
    curOffset: number;
    lockedHoriz: boolean;
    samples: Array<{ x: number; t: number }>;
    raf: number | null;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffset: 0,
    curOffset: 0,
    lockedHoriz: false,
    samples: [],
    raf: null,
  });

  const suppressTapRef = useRef(false);

  // Measure actual container width passively via ResizeObserver without forcing synchronous mount layout
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect?.width || 0);
      if (w > 120 && Math.abs(w - viewportWidth) > 2) {
        setViewportWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewportWidth]);

  // Reset resting track synchronously when pool changes cleanly (without touching DOM until needed)
  const prevPoolRef = useRef(pool);
  useEffect(() => {
    if (prevPoolRef.current === pool) return;
    prevPoolRef.current = pool;
    if (isSpinning) return;
    const initialIdx =
      restingData.baseStart + (pool.length < 15 ? Math.floor(pool.length / 2) : 0);
    setSpinStrip(null);
    setTransitionCss('none');
    setManualOffset(null);
    setFocusedRestId(restingData.list[initialIdx]?.id || null);
    setHighlightedId(null);
    setWindowRange([
      Math.max(0, initialIdx - 8),
      Math.min(Math.max(0, restingData.list.length - 1), initialIdx + 8),
    ]);
  }, [pool, restingData, isSpinning]);

  useEffect(() => {
    const d = dragStateRef.current;
    return () => {
      if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current);
      if (d.raf) cancelAnimationFrame(d.raf);
    };
  }, []);

  const stripItems = spinStrip || restingData.list;
  const defaultCenterIdx =
    restingData.baseStart + (pool.length < 15 ? Math.floor(pool.length / 2) : 0);
  const defaultRestingOffset = viewportWidth / 2 - (defaultCenterIdx * STEP_W + CARD_W / 2);
  const translateX = manualOffset ?? defaultRestingOffset;

  const getIndexForOffset = useCallback((offset: number, vw: number, maxLen: number) => {
    const raw = (vw / 2 - offset - CARD_W / 2) / STEP_W;
    return Math.min(Math.max(0, maxLen - 1), Math.max(0, Math.round(raw)));
  }, []);

  const updateRenderWindow = useCallback(
    (idxA: number, idxB: number, total: number, margin = 10) => {
      if (total <= 44) {
        setWindowRange([0, Math.max(0, total - 1)]);
        return;
      }
      const lo = Math.max(0, Math.min(idxA, idxB) - margin);
      const hi = Math.min(total - 1, Math.max(idxA, idxB) + margin);
      setWindowRange([lo, hi]);
    },
    []
  );

  const getMinMaxOffset = (count: number, vw: number) => {
    const maxOffset = vw / 2 - CARD_W / 2;
    const minOffset = vw / 2 - ((Math.max(1, count) - 1) * STEP_W + CARD_W / 2);
    return { minOffset, maxOffset };
  };

  const glideToStripIndex = (
    targetIdx: number,
    durationSec = 0.65,
    list = stripItems,
    fromIdx?: number
  ) => {
    if (list.length === 0) return;
    const clampedIdx = Math.min(list.length - 1, Math.max(0, targetIdx));
    const vw = viewportRef.current?.clientWidth || viewportWidth;
    const curCenter =
      fromIdx ??
      getIndexForOffset(getLiveTranslateX(trackRef.current, translateX), vw, list.length);

    updateRenderWindow(curCenter, clampedIdx, list.length, 10);

    const snapped = vw / 2 - (clampedIdx * STEP_W + CARD_W / 2);
    setTransitionCss(`transform ${durationSec.toFixed(2)}s cubic-bezier(0.16, 1, 0.3, 1)`);
    setManualOffset(snapped);
    setFocusedRestId(list[clampedIdx]?.id || null);
  };

  const handleThumbTap = (r: Restaurant, poolIdx: number) => {
    if (isSpinning || pool.length === 0) return;
    const workingList = restingData.list;
    const targetIdx = restingData.baseStart + poolIdx;

    if (spinStrip) {
      setSpinStrip(null);
    }

    const vw = viewportRef.current?.clientWidth || viewportWidth;
    const liveX = getLiveTranslateX(trackRef.current, translateX);
    const curIdx = getIndexForOffset(liveX, vw, workingList.length);

    if (Math.abs(targetIdx - curIdx) > 16) {
      const preIdx =
        targetIdx > curIdx
          ? Math.max(0, targetIdx - 4)
          : Math.min(workingList.length - 1, targetIdx + 4);
      const preOffset = vw / 2 - (preIdx * STEP_W + CARD_W / 2);
      setTransitionCss('none');
      setManualOffset(preOffset);
      updateRenderWindow(preIdx, targetIdx, workingList.length, 8);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          glideToStripIndex(targetIdx, 0.5, workingList, preIdx);
        });
      });
      return;
    }

    if (targetIdx >= 0 && targetIdx < workingList.length) {
      glideToStripIndex(targetIdx, 0.55, workingList, curIdx);
    } else {
      onPreviewRestaurant?.(r);
    }
  };

  const onViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSpinning || stripItems.length <= 1) return;
    const liveOffset = getLiveTranslateX(trackRef.current, translateX);
    const vw = viewportRef.current?.clientWidth || viewportWidth;
    const liveIdx = getIndexForOffset(liveOffset, vw, stripItems.length);

    setTransitionCss('none');
    setManualOffset(liveOffset);
    updateRenderWindow(liveIdx, liveIdx, stripItems.length, 16);

    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: liveOffset,
      curOffset: liveOffset,
      lockedHoriz: false,
      samples: [{ x: e.clientX, t: Date.now() }],
      raf: null,
    };
  };

  const onViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId || isSpinning) return;

    const now = Date.now();
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    if (!st.lockedHoriz) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        st.active = false;
        return;
      }
      if (Math.abs(dx) > 6 && Math.abs(dx) >= Math.abs(dy)) {
        st.lockedHoriz = true;
        suppressTapRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    }

    st.samples.push({ x: e.clientX, t: now });
    if (st.samples.length > 8) st.samples.shift();

    if (st.lockedHoriz) {
      const vw = viewportRef.current?.clientWidth || viewportWidth;
      const { minOffset, maxOffset } = getMinMaxOffset(stripItems.length, vw);
      let nextOffset = st.startOffset + dx;
      if (nextOffset > maxOffset) {
        nextOffset = maxOffset + (nextOffset - maxOffset) * 0.22;
      } else if (nextOffset < minOffset) {
        nextOffset = minOffset + (nextOffset - minOffset) * 0.22;
      }
      st.curOffset = nextOffset;

      if (st.raf) return;
      st.raf = requestAnimationFrame(() => {
        st.raf = null;
        if (trackRef.current) {
          trackRef.current.style.transition = 'none';
          trackRef.current.style.transform = `translate3d(${st.curOffset}px, 0, 0)`;
        }
      });
    }
  };

  const onViewportPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || (st.pointerId !== null && st.pointerId !== e.pointerId)) return;
    st.active = false;
    if (st.raf) {
      cancelAnimationFrame(st.raf);
      st.raf = null;
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (st.lockedHoriz) {
      const now = Date.now();
      const recent = st.samples.filter((s) => now - s.t <= 110);
      let vx = 0;
      if (recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        const dt = Math.max(12, last.t - first.t);
        vx = (last.x - first.x) / dt;
      }

      const vw = viewportRef.current?.clientWidth || viewportWidth;
      const { minOffset, maxOffset } = getMinMaxOffset(stripItems.length, vw);
      const coastPx = Math.abs(vx) > 0.14 ? Math.max(-2400, Math.min(2400, vx * 440)) : 0;
      const projectedOffset = Math.min(maxOffset, Math.max(minOffset, st.curOffset + coastPx));

      const curIdx = getIndexForOffset(st.curOffset, vw, stripItems.length);
      const centerFloat = (vw / 2 - projectedOffset - CARD_W / 2) / STEP_W;
      let snapIdx = Math.min(stripItems.length - 1, Math.max(0, Math.round(centerFloat)));

      if (!spinStrip && pool.length >= 15 && stripItems.length === pool.length + LOOP_PAD * 2) {
        if (snapIdx < LOOP_PAD) snapIdx += pool.length;
        else if (snapIdx >= LOOP_PAD + pool.length) snapIdx -= pool.length;
      }

      const durationSec = Math.min(1.05, Math.max(0.45, Math.abs(vx) * 0.58 + 0.35));
      glideToStripIndex(snapIdx, durationSec, stripItems, curIdx);

      window.setTimeout(() => {
        suppressTapRef.current = false;
      }, 80);
    }
  };

  const handleSpin = () => {
    if (pool.length === 0 || isSpinning) return;
    playTapTick(soundEnabled);
    if (pool.length === 1) {
      setHighlightedId(pool[0].id);
      setFocusedRestId(pool[0].id);
      onWinner(pool[0]);
      return;
    }
    if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current);

    setIsSpinning(true);
    setHighlightedId(null);
    onSpinStart?.();

    const chosenIdx = Math.floor(Math.random() * pool.length);
    const chosen = pool[chosenIdx];

    const leadCount = 30;
    const sequence: Restaurant[] = [];
    for (let i = 0; i < leadCount; i++) {
      if (pool.length <= 10) {
        sequence.push(pool[(chosenIdx + i * 3 + 1) % pool.length]);
      } else {
        const randIdx = Math.floor(Math.random() * pool.length);
        sequence.push(pool[randIdx === chosenIdx ? (randIdx + 1) % pool.length : randIdx]);
      }
    }
    const targetPos = sequence.length;
    sequence.push(chosen);
    for (let j = 1; j <= 4; j++) {
      sequence.push(pool[(chosenIdx + j) % pool.length]);
    }

    const vw = viewportRef.current?.clientWidth || viewportWidth;
    const startIdx = 1;
    const startOffset = vw / 2 - (startIdx * STEP_W + CARD_W / 2);
    const jitterPx = (Math.random() - 0.5) * 24;
    const targetOffset = vw / 2 - (targetPos * STEP_W + CARD_W / 2) + jitterPx;

    setTransitionCss('none');
    setSpinStrip(sequence);
    setWindowRange([0, sequence.length - 1]);
    setManualOffset(startOffset);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionCss('transform 4.45s cubic-bezier(0.10, 0.88, 0.16, 1)');
        setManualOffset(targetOffset);
      });
    });

    spinTimerRef.current = window.setTimeout(() => {
      setIsSpinning(false);
      setHighlightedId(chosen.id);
      setFocusedRestId(chosen.id);
      onWinner(chosen);
    }, 4550);
  };

  if (pool.length === 0) return null;

  const [winStart, winEnd] =
    stripItems.length <= 44
      ? [0, Math.max(0, stripItems.length - 1)]
      : [Math.max(0, windowRange[0]), Math.min(stripItems.length - 1, windowRange[1])];

  const visibleThumbs = pool.slice(0, thumbLimit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Quiet Status Row + Optional Subtle Shuffle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11.5,
          color: 'var(--text-secondary)',
          padding: '0 2px',
        }}
      >
        <span>
          Ảnh tất cả <strong style={{ color: 'var(--text-primary)' }}>{pool.length}</strong> quán · Vuốt ngang để lướt
        </span>
        {onShufflePool && (
          <button
            type="button"
            className="lg-pill"
            style={{ minHeight: 26, padding: '2px 9px', fontSize: 11 }}
            onClick={onShufflePool}
            disabled={isSpinning}
          >
            <Shuffle size={11} /> Xáo trộn
          </button>
        )}
      </div>

      {/* Progressive Filmstrip */}
      <div className="h-scroll-row" style={{ gap: 5, paddingBottom: 0 }}>
        {visibleThumbs.map((r, pIdx) => {
          const thumb = getCrispPhotoUrl(r.imageUrl, 160);
          const isWin = highlightedId === r.id;
          const isFocus = focusedRestId === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => handleThumbTap(r, pIdx)}
              title={r.title}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                padding: 0,
                overflow: 'hidden',
                flexShrink: 0,
                cursor: 'pointer',
                opacity: isWin || isFocus ? 1 : 0.68,
                border: isWin || isFocus ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.16)',
                background: 'rgba(0,0,0,0.3)',
                transform: isWin || isFocus ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.2s ease, opacity 0.2s ease, border-color 0.2s ease',
              }}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt={r.title}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Utensils size={12} color="var(--accent)" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Large Apple CoverFlow Spotlight Carousel */}
      <div
        ref={viewportRef}
        className="photo-roulette-viewport"
        data-swipe-lock="true"
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerEnd}
        onPointerCancel={onViewportPointerEnd}
      >
        <div className="photo-roulette-needle-top" aria-hidden="true" />
        <div className="photo-roulette-lens" aria-hidden="true" />
        <div className="photo-roulette-needle-bottom" aria-hidden="true" />

        <div
          ref={trackRef}
          style={{
            position: 'absolute',
            top: 14,
            bottom: 14,
            left: 0,
            width: stripItems.length * STEP_W,
            transform: `translate3d(${translateX}px, 0, 0)`,
            transition: transitionCss,
            willChange: 'transform',
          }}
        >
          {stripItems.map((r, idx) => {
            if (idx < winStart || idx > winEnd) return null;
            const crisp = getCrispPhotoUrl(r.imageUrl, 640);
            const effPrice = getEffectivePrice(r, metaById[r.id]?.customPrice);
            const isWin = highlightedId === r.id;
            return (
              <div
                key={`${r.id}-${idx}`}
                onClick={() => {
                  if (suppressTapRef.current || isSpinning) return;
                  if (focusedRestId === r.id) {
                    onPreviewRestaurant?.(r);
                  } else {
                    glideToStripIndex(idx, 0.55);
                  }
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: idx * STEP_W,
                  width: CARD_W,
                  borderRadius: 18,
                  overflow: 'hidden',
                  background: '#0f1c18',
                  border: isWin ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.2)',
                  cursor: isSpinning ? 'wait' : 'pointer',
                }}
              >
                {crisp ? (
                  <img
                    src={crisp}
                    alt={r.title}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    draggable={false}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (r.imageUrl && img.src !== r.imageUrl) img.src = r.imageUrl;
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: 'radial-gradient(circle, var(--accent-soft), rgba(15,23,42,0.85))',
                    }}
                  >
                    <Utensils size={34} color="var(--accent)" />
                    <span style={{ fontSize: 11, padding: '0 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {r.categoryName}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.84) 100%)',
                    pointerEvents: 'none',
                  }}
                />

                {r.totalScore !== null && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      padding: '2.5px 7px',
                      borderRadius: 99,
                      background: 'rgba(0,0,0,0.62)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <Star size={10} fill="#fbbf24" color="#fbbf24" />
                    {r.totalScore.toFixed(1)}
                  </span>
                )}

                <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, color: '#fff' }}>
                  {effPrice && (
                    <span
                      className="price-pill-highlight"
                      style={{ fontSize: 10, padding: '1.5px 7px', marginBottom: 4 }}
                    >
                      <Banknote size={10} /> {effPrice}
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 800,
                      lineHeight: 1.24,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {r.title}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clean Apple Primary Action Button */}
      <button
        type="button"
        className="lg-btn-accent"
        onClick={handleSpin}
        disabled={isSpinning}
        style={{ width: '100%', minHeight: 46 }}
      >
        {isSpinning ? (
          <>
            <Dices size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
            Đang lướt ảnh {pool.length} quán...
          </>
        ) : highlightedId ? (
          <>
            <Sparkles size={17} /> Quay lại trong {pool.length} quán
          </>
        ) : (
          <>
            <Dices size={18} /> Quay may mắn ({pool.length} ảnh)
          </>
        )}
      </button>
    </div>
  );
};
