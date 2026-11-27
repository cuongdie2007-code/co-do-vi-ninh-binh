import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getCrispPhotoUrl } from '../utils/restaurantUtils';
import { useAnimatedMount } from '../hooks/useAnimatedMount';

export interface LightboxState {
  title: string;
  images: string[];
  idx: number;
}

interface PhotoLightboxModalProps {
  lightboxState: LightboxState | null;
  onChangeState: React.Dispatch<React.SetStateAction<LightboxState | null>>;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  lightboxState,
  onChangeState,
}) => {
  const lightboxMount = useAnimatedMount(Boolean(lightboxState), 220);
  const lastLightboxRef = useRef<LightboxState | null>(null);
  if (lightboxState) lastLightboxRef.current = lightboxState;
  const activeLightbox = lightboxState || (lightboxMount.mounted ? lastLightboxRef.current : null);

  const [lbOffset, setLbOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lbAnimating, setLbAnimating] = useState(false);
  const lbContainerRef = useRef<HTMLDivElement | null>(null);
  const lbSnapTimerRef = useRef<number | null>(null);
  const lbGestureRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startTime: number;
    dx: number;
    dy: number;
    axis: 'none' | 'x' | 'y';
    moved: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    dx: 0,
    dy: 0,
    axis: 'none',
    moved: false,
  });

  useEffect(() => {
    const win = window as unknown as { __codoviLightboxDismiss?: (() => boolean) | null };
    if (!lightboxState) {
      if (win.__codoviLightboxDismiss) win.__codoviLightboxDismiss = null;
      return;
    }
    setLbOffset({ x: 0, y: 0 });
    setLbAnimating(false);
    win.__codoviLightboxDismiss = () => {
      onChangeState(null);
      return true;
    };
    return () => {
      win.__codoviLightboxDismiss = null;
    };
  }, [Boolean(lightboxState), onChangeState]);

  useEffect(() => {
    return () => {
      if (lbSnapTimerRef.current) window.clearTimeout(lbSnapTimerRef.current);
      const win = window as unknown as { __codoviLightboxDismiss?: (() => boolean) | null };
      win.__codoviLightboxDismiss = null;
    };
  }, []);

  if (
    !lightboxMount.mounted ||
    !activeLightbox ||
    !activeLightbox.images[activeLightbox.idx] ||
    typeof document === 'undefined'
  ) {
    return null;
  }

  const imgs = activeLightbox.images;
  const len = imgs.length;
  const idx = activeLightbox.idx;
  const prevImg = imgs[(idx - 1 + len) % len];
  const currImg = imgs[idx];
  const nextImg = imgs[(idx + 1) % len];
  const dragScale = lbOffset.y !== 0 ? Math.max(0.84, 1 - Math.abs(lbOffset.y) / 1100) : 1;
  const bgAlpha = lbOffset.y !== 0 ? Math.max(0.32, 0.94 - Math.abs(lbOffset.y) / 420) : 0.94;

  const stepLightbox = (delta: -1 | 1) => {
    if (len <= 1) return;
    const w = lbContainerRef.current?.clientWidth || window.innerWidth || 390;
    if (lbSnapTimerRef.current) window.clearTimeout(lbSnapTimerRef.current);
    setLbAnimating(true);
    setLbOffset({ x: -delta * w, y: 0 });
    lbSnapTimerRef.current = window.setTimeout(() => {
      lbSnapTimerRef.current = null;
      setLbAnimating(false);
      setLbOffset({ x: 0, y: 0 });
      onChangeState((st) =>
        st ? { ...st, idx: (st.idx + delta + st.images.length) % st.images.length } : null
      );
    }, 240);
  };

  return createPortal(
    <div
      ref={lbContainerRef}
      data-codovi-lightbox="true"
      className={`photo-lightbox-overlay ${lightboxMount.closing ? 'is-closing' : ''}`}
      style={{
        background: `rgba(0, 0, 0, ${bgAlpha})`,
        transition: lbAnimating ? 'background 0.24s ease' : 'none',
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        if ((e.target as HTMLElement)?.closest('button')) return;
        if (lbSnapTimerRef.current) {
          window.clearTimeout(lbSnapTimerRef.current);
          lbSnapTimerRef.current = null;
        }
        lbGestureRef.current = {
          active: true,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startTime: Date.now(),
          dx: 0,
          dy: 0,
          axis: 'none',
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        const g = lbGestureRef.current;
        if (!g.active || g.pointerId !== e.pointerId) return;
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        if (g.axis === 'none') {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
          g.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
          g.moved = true;
          setLbAnimating(false);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }
        if (g.axis === 'x') {
          const resistedDx = len <= 1 ? dx * 0.25 : dx;
          g.dx = resistedDx;
          setLbOffset({ x: resistedDx, y: 0 });
        } else if (g.axis === 'y') {
          g.dy = dy;
          setLbOffset({ x: 0, y: dy });
        }
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const g = lbGestureRef.current;
        if (!g.active || g.pointerId !== e.pointerId) return;
        g.active = false;
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // ignore
        }
        const elapsed = Math.max(16, Date.now() - g.startTime);
        if (g.axis === 'x') {
          const velX = g.dx / elapsed;
          if (len > 1 && (g.dx < -42 || velX < -0.35)) {
            stepLightbox(1);
          } else if (len > 1 && (g.dx > 42 || velX > 0.35)) {
            stepLightbox(-1);
          } else {
            setLbAnimating(true);
            setLbOffset({ x: 0, y: 0 });
          }
        } else if (g.axis === 'y') {
          const velY = g.dy / elapsed;
          if (Math.abs(g.dy) > 72 || Math.abs(velY) > 0.5) {
            onChangeState(null);
          } else {
            setLbAnimating(true);
            setLbOffset({ x: 0, y: 0 });
          }
        }
        window.setTimeout(() => {
          lbGestureRef.current.moved = false;
        }, 70);
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        lbGestureRef.current.active = false;
        setLbAnimating(true);
        setLbOffset({ x: 0, y: 0 });
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (lbGestureRef.current.moved) return;
        onChangeState(null);
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 'calc(14px + env(safe-area-inset-top))',
          left: 16,
          right: 16,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          color: '#fff',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {activeLightbox.title} ({idx + 1}/{len})
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChangeState(null);
          }}
          className="lg-pill"
          style={{
            minHeight: 34,
            padding: '0 12px',
            background: 'rgba(255,255,255,0.16)',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <X size={15} /> Đóng
        </button>
      </div>

      <div
        className="photo-lightbox-stage"
        style={{
          width: '100%',
          height: '74vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `translate3d(${lbOffset.x}px, ${lbOffset.y}px, 0) scale(${dragScale})`,
            transition: lbAnimating
              ? 'transform 0.24s cubic-bezier(0.18, 0.96, 0.24, 1)'
              : 'none',
          }}
        >
          {len > 1 && (
            <div
              style={{
                position: 'absolute',
                left: '-100%',
                width: '100%',
                height: '100%',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <img
                src={getCrispPhotoUrl(prevImg, 1600) || prevImg}
                alt={`${activeLightbox.title} trước`}
                referrerPolicy="no-referrer"
                draggable={false}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 14,
                }}
              />
            </div>
          )}

          <div
            style={{
              width: '100%',
              height: '100%',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={getCrispPhotoUrl(currImg, 1600) || currImg}
              alt={activeLightbox.title}
              referrerPolicy="no-referrer"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 14,
                boxShadow: '0 20px 60px rgba(0,0,0,0.65)',
              }}
            />
          </div>

          {len > 1 && (
            <div
              style={{
                position: 'absolute',
                left: '100%',
                width: '100%',
                height: '100%',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <img
                src={getCrispPhotoUrl(nextImg, 1600) || nextImg}
                alt={`${activeLightbox.title} sau`}
                referrerPolicy="no-referrer"
                draggable={false}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 14,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 'calc(18px + env(safe-area-inset-bottom))',
          left: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          zIndex: 5,
        }}
      >
        {len > 1 && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="lg-pill"
              style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
              onClick={(e) => {
                e.stopPropagation();
                stepLightbox(-1);
              }}
            >
              <ChevronLeft size={16} /> Ảnh trước
            </button>
            <button
              type="button"
              className="lg-pill"
              style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
              onClick={(e) => {
                e.stopPropagation();
                stepLightbox(1);
              }}
            >
              Ảnh sau <ChevronRight size={16} />
            </button>
          </div>
        )}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)' }}>
          {len > 1
            ? 'Vuốt ngang đổi ảnh · Vuốt dọc hoặc chạm nền đen để đóng'
            : 'Vuốt dọc hoặc chạm nền đen để đóng'}
        </span>
      </div>
    </div>,
    document.querySelector('.phone-shell') || document.body
  );
};
