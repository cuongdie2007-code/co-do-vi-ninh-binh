import React, { useEffect, useRef, useState } from 'react';
import {
  Banknote,
  Bookmark,
  Heart,
  MapPin,
  RotateCcw,
  Star,
  Utensils,
  X,
} from 'lucide-react';
import { GeoLocation, PersonalRestaurantMeta, Restaurant } from '../types/restaurant';
import {
  calcDistanceKm,
  estimateMinutes,
  formatDistance,
  getCrispPhotoUrl,
  getEffectivePrice,
  getRestaurantOpenStatus,
  normalizeShortNeighborhood,
} from '../utils/restaurantUtils';

interface TinderSwipeDeckProps {
  candidates: Restaurant[];
  anchor: GeoLocation;
  metaById: Record<string, PersonalRestaurantMeta>;
  fullHeight?: boolean;
  onSelectRestaurant: (r: Restaurant) => void;
  onLike: (r: Restaurant) => void;
  onSaveWishlist: (r: Restaurant) => void;
}

export const TinderSwipeDeck: React.FC<TinderSwipeDeckProps> = ({
  candidates,
  anchor,
  metaById,
  fullHeight = false,
  onSelectRestaurant,
  onLike,
  onSaveWishlist,
}) => {
  const [deckIndex, setDeckIndex] = useState(0);
  const [historyStack, setHistoryStack] = useState<number[]>([]);
  const [flyOut, setFlyOut] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingUI, setIsDraggingUI] = useState(false);

  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const dragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const secondCardRef = useRef<HTMLDivElement | null>(null);
  const likeStampRef = useRef<HTMLDivElement | null>(null);
  const skipStampRef = useRef<HTMLDivElement | null>(null);
  const saveStampRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (candidates.length === 0) return null;

  const safeIndex = deckIndex % candidates.length;
  const topCard = candidates[safeIndex];
  const secondCard = candidates.length > 1 ? candidates[(safeIndex + 1) % candidates.length] : null;
  const thirdCard = candidates.length > 2 ? candidates[(safeIndex + 2) % candidates.length] : null;

  const applyDragFrame = (x: number, y: number) => {
    const rot = x * 0.055;
    if (activeCardRef.current) {
      activeCardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
    }
    if (secondCardRef.current) {
      const s = 0.95 + Math.min(0.05, Math.abs(x) / 2600);
      const ty2 = Math.max(0, 8 - Math.abs(x) / 25);
      secondCardRef.current.style.transform = `scale(${s}) translateY(${ty2}px)`;
    }
    const likeOpacity = Math.min(1, Math.max(0, (x - 24) / 80));
    const skipOpacity = Math.min(1, Math.max(0, (-x - 24) / 80));
    const saveOpacity =
      Math.min(1, Math.max(0, (-y - 30) / 80)) * (Math.abs(x) < 75 ? 1 : 0);

    if (likeStampRef.current) likeStampRef.current.style.opacity = String(likeOpacity);
    if (skipStampRef.current) skipStampRef.current.style.opacity = String(skipOpacity);
    if (saveStampRef.current) saveStampRef.current.style.opacity = String(saveOpacity);
  };

  const resetCardStyles = () => {
    dragPosRef.current = { x: 0, y: 0 };
    if (activeCardRef.current) {
      activeCardRef.current.style.transform = 'translate3d(0px, 0px, 0) rotate(0deg)';
    }
    if (secondCardRef.current) {
      secondCardRef.current.style.transform = 'scale(0.95) translateY(8px)';
    }
    if (likeStampRef.current) likeStampRef.current.style.opacity = '0';
    if (skipStampRef.current) skipStampRef.current.style.opacity = '0';
    if (saveStampRef.current) saveStampRef.current.style.opacity = '0';
  };

  const commitSwipe = (action: 'like' | 'skip' | 'save') => {
    if (flyOut) return;
    setIsDraggingUI(false);
    if (action === 'like') {
      if (likeStampRef.current) likeStampRef.current.style.opacity = '1';
      setFlyOut({ x: 460, y: 24 });
      onLike(topCard);
    } else if (action === 'skip') {
      if (skipStampRef.current) skipStampRef.current.style.opacity = '1';
      setFlyOut({ x: -460, y: 24 });
    } else {
      if (saveStampRef.current) saveStampRef.current.style.opacity = '1';
      setFlyOut({ x: 0, y: -480 });
      onSaveWishlist(topCard);
    }

    window.setTimeout(() => {
      setHistoryStack((h) => [...h.slice(-19), safeIndex]);
      setDeckIndex((i) => i + 1);
      setFlyOut(null);
      resetCardStyles();
    }, 240);
  };

  const handleUndo = () => {
    if (historyStack.length === 0 || flyOut) return;
    const prevIdx = historyStack[historyStack.length - 1];
    setHistoryStack((h) => h.slice(0, -1));
    setDeckIndex(prevIdx);
    resetCardStyles();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (flyOut) return;
    startRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    dragPosRef.current = { x: 0, y: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingUI(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || flyOut) return;
    dragPosRef.current = {
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
    };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyDragFrame(dragPosRef.current.x, dragPosRef.current.y);
    });
  };

  const onPointerUp = () => {
    if (!startRef.current || flyOut) return;
    const { x, y } = dragPosRef.current;
    startRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (Math.abs(x) < 9 && Math.abs(y) < 9) {
      setIsDraggingUI(false);
      resetCardStyles();
      onSelectRestaurant(topCard);
      return;
    }

    if (x > 88) {
      commitSwipe('like');
    } else if (x < -88) {
      commitSwipe('skip');
    } else if (y < -88 && Math.abs(x) < 75) {
      commitSwipe('save');
    } else {
      setIsDraggingUI(false);
      resetCardStyles();
    }
  };

  const tx = flyOut ? flyOut.x : 0;
  const ty = flyOut ? flyOut.y : 0;
  const rot = tx * 0.055;

  const open = getRestaurantOpenStatus(topCard);
  const distKm = calcDistanceKm(anchor, topCard.location);
  const effectivePrice = getEffectivePrice(topCard, metaById[topCard.id]?.customPrice);

  return (
    <div
      className={fullHeight ? 'tinder-deck-interactive' : 'lg-surface-strong lg-sheen tinder-deck-interactive'}
      data-swipe-lock="true"
      style={
        fullHeight
          ? {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '4px 0 6px',
            }
          : { borderRadius: 28, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text-secondary)', flexShrink: 0, padding: fullHeight ? '0 4px' : 0 }}>
        <span style={{ fontWeight: 700 }}>
          LƯỚT TINDER · THẺ {safeIndex + 1}/{candidates.length}
        </span>
        <span>Kéo phải ❤️ · Trái ✖️ · Lên 📌</span>
      </div>

      {/* 3-card stacked area */}
      <div
        style={
          fullHeight
            ? { position: 'relative', flex: 1, minHeight: 280, width: '100%' }
            : { position: 'relative', height: 325, width: '100%' }
        }
      >
        {thirdCard && (
          <div
            className="lg-surface"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 24,
              transform: 'scale(0.9) translateY(16px)',
              opacity: 0.45,
              pointerEvents: 'none',
            }}
          />
        )}

        {secondCard && (
          <div
            ref={secondCardRef}
            className="lg-surface"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 24,
              overflow: 'hidden',
              transform: 'scale(0.95) translateY(8px)',
              opacity: 0.78,
              pointerEvents: 'none',
              transition: isDraggingUI ? 'none' : 'transform 0.25s ease',
            }}
          >
            {secondCard.imageUrl && (
              <img
                src={getCrispPhotoUrl(secondCard.imageUrl, 1080) || secondCard.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (secondCard.imageUrl && img.src !== secondCard.imageUrl) {
                    img.src = secondCard.imageUrl;
                  }
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
        )}

        {/* Active Draggable Card */}
        <div
          ref={activeCardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            startRef.current = null;
            setIsDraggingUI(false);
            resetCardStyles();
          }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 24,
            overflow: 'hidden',
            background: '#0b1915',
            border: '1px solid rgba(255, 255, 255, 0.42)',
            cursor: isDraggingUI ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
            willChange: isDraggingUI || flyOut ? 'transform' : 'auto',
            transform: `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg)`,
            opacity: flyOut ? 0 : 1,
            transition: isDraggingUI
              ? 'none'
              : 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease',
            boxShadow: '0 20px 44px rgba(0,0,0,0.45)',
          }}
        >
          {topCard.imageUrl ? (
            <img
              key={topCard.id}
              src={getCrispPhotoUrl(topCard.imageUrl, 1080) || topCard.imageUrl}
              alt={topCard.title}
              referrerPolicy="no-referrer"
              draggable={false}
              onError={(e) => {
                const img = e.currentTarget;
                if (topCard.imageUrl && img.src !== topCard.imageUrl) {
                  img.src = topCard.imageUrl;
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                gap: 8,
                background: 'radial-gradient(circle at 30% 20%, var(--accent-soft), rgba(15,23,42,0.85))',
              }}
            >
              <Utensils size={42} color="var(--accent)" />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{topCard.categoryName}</span>
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.86) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Tinder Drag Stamps (DOM-driven for 60fps zero-rerender drag) */}
          <div
            ref={likeStampRef}
            className="tinder-stamp like"
            style={{ opacity: 0, transform: 'rotate(-14deg)', transition: isDraggingUI ? 'none' : 'opacity 0.15s ease' }}
          >
            CHỐT ĂN ❤️
          </div>
          <div
            ref={skipStampRef}
            className="tinder-stamp skip"
            style={{ opacity: 0, transform: 'rotate(14deg)', transition: isDraggingUI ? 'none' : 'opacity 0.15s ease' }}
          >
            BỎ QUA ✖️
          </div>
          <div
            ref={saveStampRef}
            className="tinder-stamp save"
            style={{ opacity: 0, transition: isDraggingUI ? 'none' : 'opacity 0.15s ease' }}
          >
            MUỐN THỬ 📌
          </div>

          {/* Top Bar on Card */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span className={`status-badge ${open.state}`}>{open.label}</span>
            {topCard.totalScore !== null && (
              <span
                className="status-badge"
                style={{ background: 'rgba(15,23,42,0.68)', color: '#fff', fontSize: 12 }}
              >
                <Star size={12} fill="#fbbf24" color="#fbbf24" />
                {topCard.totalScore.toFixed(1)} ({topCard.reviewsCount ?? 0})
              </span>
            )}
          </div>

          {/* Bottom Content on Card */}
          <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, color: '#fff' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 99,
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: 'rgba(15,23,42,0.62)',
                  border: '1px solid rgba(255,255,255,0.28)',
                }}
              >
                {topCard.categoryName}
              </span>
              {effectivePrice && (
                <span className="price-pill-highlight">
                  <Banknote size={13} /> {effectivePrice}
                </span>
              )}
            </div>

            <h3 style={{ margin: '0 0 4px', fontSize: 19.5, fontWeight: 800, lineHeight: 1.24 }}>
              {topCard.title}
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.88)' }}>
              <MapPin size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {topCard.street ? `${topCard.street}, ` : ''}
                {normalizeShortNeighborhood(topCard)}
              </span>
              <span style={{ fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>
                {formatDistance(distKm)} · {estimateMinutes(distKm)}p
              </span>
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.68)', marginTop: 4 }}>
              Chạm nhẹ thẻ để xem chi tiết thực đơn, giờ mở & đánh giá
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 2 }}>
        <button
          type="button"
          className="lg-pill"
          style={{ width: 44, height: 44, borderRadius: 99, padding: 0, opacity: historyStack.length ? 1 : 0.4 }}
          onClick={handleUndo}
          disabled={!historyStack.length}
          title="Quay lại thẻ trước"
          aria-label="Hoàn tác"
        >
          <RotateCcw size={17} />
        </button>

        <button
          type="button"
          className="lg-pill"
          style={{ width: 56, height: 56, borderRadius: 99, padding: 0, borderColor: 'rgba(248,113,113,0.55)' }}
          onClick={() => commitSwipe('skip')}
          aria-label="Bỏ qua"
        >
          <X size={23} color="#fca5a5" />
        </button>

        <button
          type="button"
          className="lg-pill"
          style={{ width: 52, height: 52, borderRadius: 99, padding: 0, borderColor: 'rgba(250,204,21,0.55)' }}
          onClick={() => commitSwipe('save')}
          aria-label="Muốn thử"
        >
          <Bookmark size={21} color="#facc15" />
        </button>

        <button
          type="button"
          className="lg-btn-accent"
          style={{ width: 64, height: 56, borderRadius: 99, padding: 0 }}
          onClick={() => commitSwipe('like')}
          aria-label="Chốt ăn"
        >
          <Heart size={24} fill="#061812" />
        </button>
      </div>
    </div>
  );
};
