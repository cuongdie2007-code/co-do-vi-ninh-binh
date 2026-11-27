import React, { useRef, useState } from 'react';
import {
  Banknote,
  ChevronRight,
  MapPin,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { Restaurant, UserProfile } from '../../types/restaurant';

interface AppleSwitchProps {
  checked: boolean;
  label: string;
  onToggle: () => void;
}

export const AppleSwitch: React.FC<AppleSwitchProps> = ({ checked, label, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={`apple-switch ${checked ? 'on' : ''}`}
    onClick={onToggle}
  >
    <span className="apple-switch-knob" />
  </button>
);

interface SettingsHubRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  valueText?: string;
  onClick: () => void;
}

export const SettingsHubRow: React.FC<SettingsHubRowProps> = ({
  icon,
  title,
  subtitle,
  valueText,
  onClick,
}) => (
  <button type="button" className="apple-setting-row" onClick={onClick}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
      <span className="apple-row-icon">{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{title}</div>
        {subtitle && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-secondary)',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {valueText && (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
          {valueText}
        </span>
      )}
      <ChevronRight size={16} color="var(--text-muted)" />
    </div>
  </button>
);

interface SwipeToDeleteRowProps {
  restaurant: Restaurant;
  onEdit: (r: Restaurant) => void;
  onDelete: (id: string) => void;
}

/** iOS-style horizontal swipe-to-delete row with fallback tap-to-edit & trash button. */
export const SwipeToDeleteRow: React.FC<SwipeToDeleteRowProps> = ({
  restaurant: r,
  onEdit,
  onDelete,
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const swipeRef = useRef<{
    startX: number;
    startY: number;
    baseOffset: number;
    locked: 'none' | 'horiz' | 'vert';
    moved: boolean;
  }>({ startX: 0, startY: 0, baseOffset: 0, locked: 'none', moved: false });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swipeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseOffset: offsetX,
      locked: 'none',
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = swipeRef.current;
    if (!st.startX) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (st.locked === 'none') {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        st.locked = 'vert';
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        st.locked = 'horiz';
        st.moved = true;
      }
    }
    if (st.locked === 'horiz') {
      const clamped = Math.max(-84, Math.min(0, st.baseOffset + dx));
      setOffsetX(clamped);
    }
  };

  const handlePointerEnd = () => {
    const st = swipeRef.current;
    if (st.locked === 'horiz') {
      setOffsetX((cur) => (cur < -38 ? -78 : 0));
    }
    swipeRef.current.startX = 0;
  };

  return (
    <div className="ios-swipe-row">
      <button
        type="button"
        className="ios-swipe-delete-btn"
        onClick={() => onDelete(r.id)}
        aria-label={`Xoá ${r.title}`}
      >
        <Trash2 size={14} /> Xoá
      </button>

      <div
        className="ios-swipe-content apple-setting-row"
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          background: 'var(--glass-surface)',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={() => {
          if (swipeRef.current.moved) {
            swipeRef.current.moved = false;
            return;
          }
          if (offsetX < -10) {
            setOffsetX(0);
            return;
          }
          onEdit(r);
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {r.title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 1,
            }}
          >
            {r.categoryName || 'Quán tự thêm'} · {r.address || 'Ninh Bình'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sửa</span>
          <button
            type="button"
            aria-label={`Mở nút xoá ${r.title}`}
            onClick={(e) => {
              e.stopPropagation();
              setOffsetX((cur) => (cur < -30 ? 0 : -78));
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: '1px solid var(--glass-hairline)',
              background: 'var(--glass-pill-bg)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Vuốt sang trái hoặc chạm để xoá"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

interface CompactLivePreviewProps {
  profile: UserProfile;
  resolvedMode: 'dark' | 'light' | 'jade';
}

export const CompactLivePreview: React.FC<CompactLivePreviewProps> = ({
  profile,
  resolvedMode,
}) => {
  const { glass, customTheme } = profile;
  const showDistance = glass.showDistance;
  const showRating = glass.showRating ?? true;
  const showPrice = glass.showPrice ?? true;
  const showOpen = glass.showOpenStatus ?? true;
  const showBars = glass.showRatingBars;
  const isCompact = glass.cardDensity === 'compact' || glass.cardDensity === 'dense';

  const stageBg = glass.customBgUrl
    ? undefined
    : resolvedMode === 'light'
    ? 'linear-gradient(135deg, #f2f2f7 0%, #e5e5ea 100%)'
    : resolvedMode === 'jade'
    ? 'linear-gradient(135deg, #000000 0%, #09090b 100%)'
    : 'linear-gradient(135deg, #101014 0%, #1c1c22 100%)';

  return (
    <div
      style={{
        position: 'relative',
        flexShrink: 0,
        borderRadius: 20,
        overflow: 'hidden',
        padding: 10,
        border: '1px solid var(--glass-border)',
        background: stageBg,
      }}
    >
      {glass.customBgUrl && (
        <>
          <img
            src={glass.customBgUrl}
            alt="Xem trước ảnh nền"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                resolvedMode === 'light'
                  ? `rgba(255,255,255,${Math.min(0.75, (customTheme?.scrimStrength ?? 0.45) + 0.15)})`
                  : `rgba(8,8,12,${customTheme?.scrimStrength ?? 0.48})`,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      <div
        className={`lg-surface ${glass.dynamicSheen ? 'lg-sheen' : ''}`}
        style={{
          position: 'relative',
          zIndex: 2,
          borderRadius: 16,
          padding: isCompact ? '9px 11px' : '11px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: isCompact ? 4 : 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Sparkles size={10} color="var(--accent)" /> Xem trước trực tiếp
          </span>
          {showOpen && (
            <span className="status-badge open" style={{ fontSize: 10, padding: '2px 7px' }}>
              <span
                style={{ width: 5, height: 5, borderRadius: 99, background: '#34d399' }}
              />
              Đang mở
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div
            style={{
              fontSize: glass.fontScale === 'large' ? 15.5 : 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Cơm Cháy & Dê Núi Cố Đô
          </div>
          {showPrice && (
            <span className="price-pill-highlight" style={{ fontSize: 10.5, padding: '2px 7px', flexShrink: 0 }}>
              <Banknote size={10} /> 80k–160k
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11.5,
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}
        >
          {showRating && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: 'var(--text-primary)' }}>
              <Star size={11} fill="#fbbf24" color="#fbbf24" /> 4.8
            </span>
          )}
          {showRating && showDistance && <span>·</span>}
          {showDistance && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <MapPin size={10} /> 1.2 km · 4p
            </span>
          )}
          {!isCompact && (
            <>
              {(showRating || showDistance) && <span>·</span>}
              <span>Đặc sản Ninh Bình</span>
            </>
          )}
        </div>

        {showBars && !isCompact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <div
              style={{
                flex: 1,
                height: 3,
                borderRadius: 99,
                background: 'var(--glass-hairline)',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div style={{ width: '78%', background: 'var(--accent)' }} />
              <div style={{ width: '16%', background: '#fbbf24' }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>78% 5★</span>
          </div>
        )}
      </div>
    </div>
  );
};
