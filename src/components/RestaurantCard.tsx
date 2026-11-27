import React, { useState } from 'react';
import {
  Ban,
  Banknote,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Heart,
  MapPin,
  Sparkles,
  Star,
  Utensils,
} from 'lucide-react';
import {
  CardDensity,
  GeoLocation,
  PersonalRestaurantMeta,
  Restaurant,
} from '../types/restaurant';
import {
  calcDistanceKm,
  classifyVenueByPrice,
  estimateMinutes,
  formatDistance,
  getCrispPhotoUrl,
  getEffectiveMenuImages,
  getEffectivePrice,
  getRestaurantOpenStatus,
  normalizeShortNeighborhood,
  OpenStatusResult,
} from '../utils/restaurantUtils';

function getOpenDotColor(open: OpenStatusResult): string {
  if (open.state === 'open') return '#34d399';
  if (open.state === 'closing-soon') return '#fbbf24';
  if (open.state === 'closed' || open.state === 'temp-closed' || open.state === 'perm-closed') {
    return '#f87171';
  }
  return '#cbd5e1';
}

function getShortOpenLabel(open: OpenStatusResult): string {
  if (open.state === 'open') return open.label === 'Mở cả ngày' ? 'Mở 24h' : 'Mở cửa';
  if (open.state === 'closing-soon') return 'Sắp đóng';
  if (open.state === 'closed') return 'Đóng cửa';
  if (open.state === 'temp-closed') return 'Tạm nghỉ';
  if (open.state === 'perm-closed') return 'Ngừng bán';
  return 'Chưa rõ';
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  anchor: GeoLocation;
  meta?: PersonalRestaurantMeta;
  density: CardDensity;
  showDistance: boolean;
  showRatingBars?: boolean;
  showRating?: boolean;
  showPrice?: boolean;
  showOpenStatus?: boolean;
  dynamicSheen?: boolean;
  onSelect: (r: Restaurant) => void;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
  onToggleWishlist?: (id: string, e: React.MouseEvent) => void;
  badgeText?: string;
}

const RestaurantCardBase: React.FC<RestaurantCardProps> = ({
  restaurant: r,
  anchor,
  meta,
  density,
  showDistance,
  showRatingBars = false,
  showRating = true,
  showPrice = true,
  showOpenStatus = true,
  dynamicSheen = true,
  onSelect,
  onToggleFavorite,
  onToggleWishlist,
  badgeText,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const open = getRestaurantOpenStatus(r);
  const openDotColor = getOpenDotColor(open);
  const shortOpenLabel = getShortOpenLabel(open);
  const distKm = calcDistanceKm(anchor, r.location);
  const effectivePrice = showPrice ? getEffectivePrice(r, meta?.customPrice) : null;
  const venueTier = classifyVenueByPrice(r, meta?.customPrice);
  const hasMenuPhotos = getEffectiveMenuImages(r, meta?.customMenuImages).length > 0;

  const totalDist =
    (r.reviewsDistribution?.fiveStar || 0) +
    (r.reviewsDistribution?.fourStar || 0) +
    (r.reviewsDistribution?.threeStar || 0) +
    (r.reviewsDistribution?.twoStar || 0) +
    (r.reviewsDistribution?.oneStar || 0);

  const hasValidImage = Boolean(r.imageUrl) && !imgFailed;

  if (density === 'dense') {
    return (
      <article
        onClick={() => onSelect(r)}
        className={`lg-surface lg-card-perf ${dynamicSheen ? 'lg-sheen' : ''}`}
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: 88, background: 'rgba(255,255,255,0.05)' }}>
          {hasValidImage ? (
            <img
              src={getCrispPhotoUrl(r.imageUrl!, 420) || r.imageUrl!}
              alt={r.title}
              referrerPolicy="no-referrer"
              loading="lazy"
              draggable={false}
              onError={(e) => {
                const img = e.currentTarget;
                if (r.imageUrl && img.src !== r.imageUrl) img.src = r.imageUrl;
                else setImgFailed(true);
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-soft)' }}>
              <Utensils size={18} color="var(--accent)" />
            </div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 48%, rgba(0,0,0,0.68) 100%)', pointerEvents: 'none' }} />
          {showRating && r.totalScore !== null && (
            <span
              className="card-photo-chip"
              style={{
                position: 'absolute',
                top: 5,
                right: 5,
                padding: '1.5px 5px',
                borderRadius: 99,
                background: 'rgba(0,0,0,0.62)',
                color: '#fff',
                fontSize: 9.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Star size={8} fill="#fbbf24" color="#fbbf24" />
              {r.totalScore.toFixed(1)}
            </span>
          )}
          {showOpenStatus && (
            <span
              className={`status-badge ${open.state} card-photo-chip`}
              style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '1.5px 5px',
                fontSize: 8.5,
                gap: 3,
                maxWidth: 'calc(100% - 46px)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={open.label}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 99,
                  flexShrink: 0,
                  background: openDotColor,
                }}
              />
              {shortOpenLabel}
            </span>
          )}
        </div>
        <div style={{ padding: '7px 7px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {r.title}
          </div>
          {showDistance && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 9.5,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              <MapPin size={9} style={{ flexShrink: 0, color: 'var(--accent)' }} />
              {formatDistance(distKm)}
            </div>
          )}
          {effectivePrice ? (
            <span className="price-pill-highlight" style={{ fontSize: 9, padding: '1px 5px', alignSelf: 'flex-start' }}>
              {effectivePrice}
            </span>
          ) : (
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {venueTier.label}
            </div>
          )}
        </div>
      </article>
    );
  }

  if (density === 'grid') {
    return (
      <article
        onClick={() => onSelect(r)}
        className={`lg-surface lg-card-perf ${dynamicSheen ? 'lg-sheen' : ''}`}
        style={{
          borderRadius: 18,
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: 124, background: 'rgba(255,255,255,0.05)' }}>
          {hasValidImage ? (
            <img
              src={getCrispPhotoUrl(r.imageUrl!, 560) || r.imageUrl!}
              alt={r.title}
              referrerPolicy="no-referrer"
              loading="lazy"
              draggable={false}
              onError={(e) => {
                const img = e.currentTarget;
                if (r.imageUrl && img.src !== r.imageUrl) img.src = r.imageUrl;
                else setImgFailed(true);
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-soft)' }}>
              <Utensils size={24} color="var(--accent)" />
            </div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.58) 100%)', pointerEvents: 'none' }} />
          {showOpenStatus && (
            <span
              className={`status-badge ${open.state} card-photo-chip`}
              style={{
                position: 'absolute',
                top: 7,
                left: 7,
                maxWidth: 'calc(100% - 46px)',
                padding: '2px 7px',
                fontSize: 9.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span
                style={{
                  width: 5.5,
                  height: 5.5,
                  borderRadius: 99,
                  flexShrink: 0,
                  background: openDotColor,
                }}
              />
              {open.label}
            </span>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              aria-label="Yêu thích"
              onClick={(e) => onToggleFavorite(r.id, e)}
              style={{
                position: 'absolute',
                top: 7,
                right: 7,
                width: 28,
                height: 28,
                borderRadius: 99,
                border: 'none',
                background: 'rgba(0,0,0,0.48)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Heart size={13} color={meta?.favorite ? '#fb7185' : '#fff'} fill={meta?.favorite ? '#fb7185' : 'none'} />
            </button>
          )}
          {showRating && r.totalScore !== null && (
            <span
              className="card-photo-chip"
              style={{
                position: 'absolute',
                bottom: 7,
                left: 7,
                padding: '2px 7px',
                borderRadius: 99,
                background: 'rgba(0,0,0,0.62)',
                color: '#fff',
                fontSize: 10.5,
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
        </div>
        <div style={{ padding: '9px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 13.5,
              fontWeight: 700,
              lineHeight: 1.26,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {r.title}
          </h3>
          {effectivePrice && (
            <span className="price-pill-highlight" style={{ fontSize: 10, padding: '1.5px 7px', alignSelf: 'flex-start' }}>
              <Banknote size={10} /> {effectivePrice}
            </span>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: 'var(--text-secondary)',
              minWidth: 0,
            }}
          >
            {showDistance && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                <MapPin size={10} color="var(--accent)" />
                {formatDistance(distKm)} ·
              </span>
            )}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.categoryName}
            </span>
          </div>
        </div>
      </article>
    );
  }

  if (density === 'compact') {
    return (
      <article
        onClick={() => onSelect(r)}
        className={`lg-surface lg-card-perf ${dynamicSheen ? 'lg-sheen' : ''}`}
        style={{
          borderRadius: 18,
          padding: 9,
          display: 'flex',
          gap: 11,
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 14,
            overflow: 'hidden',
            flexShrink: 0,
            position: 'relative',
            background: 'rgba(255,255,255,0.06)',
          }}
        >
          {hasValidImage ? (
            <img
              src={getCrispPhotoUrl(r.imageUrl!, 320) || r.imageUrl!}
              alt={r.title}
              referrerPolicy="no-referrer"
              loading="lazy"
              draggable={false}
              onError={() => setImgFailed(true)}
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
              }}
            >
              <Utensils size={20} color="var(--accent)" />
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 14.5,
                fontWeight: 700,
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {r.title}
            </h3>
            {effectivePrice && (
              <span className="price-pill-highlight" style={{ padding: '1.5px 7px', fontSize: 10.5, flexShrink: 0 }}>
                {effectivePrice}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {showRating && r.totalScore !== null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                <Star size={11} fill="#fbbf24" color="#fbbf24" />
                {r.totalScore.toFixed(1)}
              </span>
            )}
            {showRating && r.totalScore !== null && <span>·</span>}
            {showDistance && (
              <>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                  <MapPin size={10} color="var(--accent)" />
                  {formatDistance(distKm)}
                </span>
                <span>·</span>
              </>
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.categoryName}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
              {showOpenStatus && (
                <span
                  className={`status-badge ${open.state}`}
                  style={{
                    padding: '1.5px 7px',
                    fontSize: 10,
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: 5.5,
                      height: 5.5,
                      borderRadius: 99,
                      background: openDotColor,
                    }}
                  />
                  {open.label}
                </span>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {normalizeShortNeighborhood(r)}
              </span>
            </div>
            {onToggleFavorite && (
              <button
                type="button"
                aria-label="Yêu thích"
                onClick={(e) => onToggleFavorite(r.id, e)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexShrink: 0,
                }}
              >
                <Heart
                  size={15}
                  color={meta?.favorite ? '#fb7185' : 'var(--text-muted)'}
                  fill={meta?.favorite ? '#fb7185' : 'none'}
                />
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  // APPLE MAPS PLACE CARD (Default Rich Layout — Uncluttered Photo + 3 Clean Metadata Lines)
  return (
    <article
      onClick={() => onSelect(r)}
      className={`lg-surface lg-card-perf ${dynamicSheen ? 'lg-sheen' : ''}`}
      style={{
        borderRadius: 22,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Clean Food Photography */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 176,
          background: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}
      >
        {hasValidImage ? (
          <img
            src={getCrispPhotoUrl(r.imageUrl!, 720) || r.imageUrl!}
            alt={r.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            draggable={false}
            onError={(e) => {
              const img = e.currentTarget;
              if (r.imageUrl && img.src !== r.imageUrl) {
                img.src = r.imageUrl;
              } else {
                setImgFailed(true);
              }
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
              background: 'radial-gradient(circle at 30% 20%, var(--accent-soft), rgba(15,23,42,0.45))',
            }}
          >
            <Utensils size={28} color="var(--accent)" />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {r.categoryName || 'Ẩm thực Ninh Bình'}
            </span>
          </div>
        )}

        {/* Subtle Top Edge Scrim Only for Quick Icons */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 38%)',
            pointerEvents: 'none',
          }}
        />

        {/* Minimal Top Row: Open Indicator Left, Heart/Bookmark Right */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            right: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {showOpenStatus && (
              <span className={`status-badge ${open.state}`}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: openDotColor,
                  }}
                />
                {open.label}
              </span>
            )}
            {r.isUserAdded && (
              <span
                className="status-badge"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg, #09090b)' }}
              >
                <Sparkles size={10} /> Mới thêm
              </span>
            )}
            {hasMenuPhotos && (
              <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.72)' }}>
                <BookOpen size={10} /> Menu
              </span>
            )}
            {badgeText && (
              <span className="status-badge" style={{ background: 'rgba(0,0,0,0.55)' }}>
                {badgeText}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {onToggleWishlist && (
              <button
                type="button"
                aria-label="Muốn thử"
                onClick={(e) => onToggleWishlist(r.id, e)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 99,
                  border: 'none',
                  background: 'rgba(0,0,0,0.46)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Bookmark
                  size={14}
                  color={meta?.wishlist ? '#facc15' : '#ffffff'}
                  fill={meta?.wishlist ? '#facc15' : 'none'}
                />
              </button>
            )}
            {onToggleFavorite && (
              <button
                type="button"
                aria-label="Yêu thích"
                onClick={(e) => onToggleFavorite(r.id, e)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 99,
                  border: 'none',
                  background: 'rgba(0,0,0,0.46)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Heart
                  size={14}
                  color={meta?.favorite ? '#fb7185' : '#ffffff'}
                  fill={meta?.favorite ? '#fb7185' : 'none'}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Crisp 3-Line Apple Maps Place Body */}
      <div style={{ padding: '11px 14px 13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Line 1: Title + Prominent Price */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15.5,
              fontWeight: 700,
              lineHeight: 1.28,
              letterSpacing: '-0.01em',
              flex: 1,
              minWidth: 0,
            }}
          >
            {r.title}
          </h3>
          {effectivePrice ? (
            <span className="price-pill-highlight" style={{ flexShrink: 0, fontSize: 11.5, padding: '3px 9px' }}>
              <Banknote size={12} /> {effectivePrice}
            </span>
          ) : (
            <span
              className="lg-pill"
              style={{ flexShrink: 0, minHeight: 24, padding: '2px 8px', fontSize: 10.5 }}
            >
              {venueTier.emoji} {venueTier.label}
            </span>
          )}
        </div>

        {/* Line 2: Rating · Distance · Category (Apple Maps single dot-separated row) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12.5,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {showRating && r.totalScore !== null && (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: 'var(--text-primary)' }}>
                <Star size={12} fill="#fbbf24" color="#fbbf24" />
                {r.totalScore.toFixed(1)}
                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                  ({r.reviewsCount ?? 0})
                </span>
              </span>
              <span>·</span>
            </>
          )}
          {showDistance && (
            <>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatDistance(distKm)} · {estimateMinutes(distKm)}p
              </span>
              <span>·</span>
            </>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {venueTier.label} · {r.categoryName}
          </span>
        </div>

        {/* Line 3: Quiet Short Location */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11.5,
            color: 'var(--text-muted)',
          }}
        >
          <MapPin size={11} style={{ flexShrink: 0, opacity: 0.78 }} />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {r.street ? `${r.street}, ${normalizeShortNeighborhood(r)}` : normalizeShortNeighborhood(r)}
          </span>
          {meta?.visited && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
              <CheckCircle2 size={11} /> Đã ăn
            </span>
          )}
          {meta?.blacklisted && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#fca5a5', flexShrink: 0 }}>
              <Ban size={11} /> Đã ẩn
            </span>
          )}
        </div>

        {showRatingBars && totalDist > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <div
              style={{
                flex: 1,
                height: 3,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.12)',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div style={{ width: `${(r.reviewsDistribution.fiveStar / totalDist) * 100}%`, background: 'var(--accent)' }} />
              <div style={{ width: `${(r.reviewsDistribution.fourStar / totalDist) * 100}%`, background: '#fbbf24' }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
              {Math.round((r.reviewsDistribution.fiveStar / totalDist) * 100)}% 5★
            </span>
          </div>
        )}
      </div>
    </article>
  );
};

export const RestaurantCard = React.memo(RestaurantCardBase);
