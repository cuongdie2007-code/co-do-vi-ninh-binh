import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Banknote,
  BookOpen,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  Edit3,
  ExternalLink,
  FileUp,
  FolderPlus,
  Globe,
  Heart,
  Image as ImageIcon,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import {
  CustomCollection,
  GeoLocation,
  MapsProvider,
  PersonalRestaurantMeta,
  Restaurant,
} from '../types/restaurant';
import {
  buildMapsDirectionUrl,
  calcDistanceKm,
  classifyRestaurantTastes,
  classifyVenueByPrice,
  compressImageFileToDataUrl,
  estimateMinutes,
  formatDistance,
  getAccessibilityLabels,
  getCrispPhotoUrl,
  getEffectiveMenuData,
  getEffectivePrice,
  getRestaurantOpenStatus,
  MAPS_MENU_CONSOLE_SNIPPET,
  normalizeShortNeighborhood,
  parseGoogleMapsMenuInput,
} from '../utils/restaurantUtils';
import { useSheetDragDismiss } from '../hooks/useSheetDragDismiss';
import { TASTE_OPTIONS } from '../data/themes';
import { ExternalLookupPills } from './ExternalLookupPills';
import { LightboxState, PhotoLightboxModal } from './PhotoLightboxModal';

interface RestaurantDetailSheetProps {
  restaurant: Restaurant;
  anchor: GeoLocation;
  meta: PersonalRestaurantMeta;
  collections: CustomCollection[];
  mapsApp?: MapsProvider;
  onClose: () => void;
  onUpdateMeta: (id: string, patch: Partial<PersonalRestaurantMeta>) => void;
  onToggleCollection: (collectionId: string, restaurantId: string) => void;
  onChooseToday: (r: Restaurant) => void;
  onEdit?: (r: Restaurant) => void;
  onDelete?: (id: string) => void;
  onCloneAndEdit?: (r: Restaurant) => void;
}

const JS_DAY_TO_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

export const RestaurantDetailSheet: React.FC<RestaurantDetailSheetProps> = ({
  restaurant: r,
  anchor,
  meta,
  collections,
  mapsApp = 'google',
  onClose,
  onUpdateMeta,
  onToggleCollection,
  onChooseToday,
  onEdit,
  onDelete,
  onCloneAndEdit,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxState, setLightboxState] = useState<LightboxState | null>(null);

  const [heroDragX, setHeroDragX] = useState(0);
  const [heroSliding, setHeroSliding] = useState(false);
  const heroTrackRef = useRef<HTMLDivElement | null>(null);
  const heroSnapTimerRef = useRef<number | null>(null);
  const heroGestureRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startTime: number;
    dx: number;
    axis: 'none' | 'x' | 'y';
    moved: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    dx: 0,
    axis: 'none',
    moved: false,
  });

  const [showMenuAddBox, setShowMenuAddBox] = useState(false);
  const [menuTab, setMenuTab] = useState<'overview' | number>('overview');
  const [menuPasteDraft, setMenuPasteDraft] = useState('');
  const [menuSnippetCopied, setMenuSnippetCopied] = useState(false);
  const [menuUrlDraft, setMenuUrlDraft] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | '5star' | 'photos' | 'price'>('all');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [priceDraft, setPriceDraft] = useState(meta.customPrice || r.price || '');
  const [noteDraft, setNoteDraft] = useState(meta.note || '');
  const swipeBackRef = useRef<{ x: number; y: number } | null>(null);
  const noteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPriceDraft(meta.customPrice || r.price || '');
  }, [r.id, meta.customPrice, r.price]);

  useEffect(() => {
    setNoteDraft(meta.note || '');
    setImgFailed(false);
    setActivePhotoIdx(0);
    setHeroDragX(0);
    setHeroSliding(false);
    setLightboxState(null);
    setShowMenuAddBox(false);
    setMenuTab('overview');
    setMenuPasteDraft('');
    setMenuSnippetCopied(false);
    setMenuUrlDraft('');
    setReviewFilter('all');
    setShowAllReviews(false);
  }, [r.id]);

  useEffect(() => {
    return () => {
      if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
      if (heroSnapTimerRef.current) window.clearTimeout(heroSnapTimerRef.current);
    };
  }, []);

  const flushNoteNow = (val: string) => {
    if (noteTimerRef.current) {
      window.clearTimeout(noteTimerRef.current);
      noteTimerRef.current = null;
    }
    if (val !== (meta.note || '')) {
      onUpdateMeta(r.id, { note: val });
    }
  };

  const handleCloseSheet = () => {
    flushNoteNow(noteDraft);
    onClose();
  };

  const {
    overlayRef,
    panelRef,
    handleRef,
    scrollBodyRef,
    dismissAnimated,
    handleGrabProps,
    bodyPullProps,
  } = useSheetDragDismiss({ onDismiss: handleCloseSheet });

  const effectivePrice = getEffectivePrice(r, meta.customPrice);
  const venueTier = classifyVenueByPrice(r, meta.customPrice);
  const effectiveMenu = getEffectiveMenuData(r, meta);
  const effectiveMenuImages = effectiveMenu.menuImages;
  const menuParsePreview = useMemo(() => parseGoogleMapsMenuInput(menuPasteDraft), [menuPasteDraft]);
  const hasAnyMenuData =
    effectiveMenuImages.length > 0 ||
    effectiveMenu.menuHighlights.length > 0 ||
    effectiveMenu.menuSections.length > 0;
  const hasCustomMenu = Boolean(
    meta.customMenuImages?.length ||
      meta.customMenuHighlights?.length ||
      meta.customMenuSections?.length
  );

  const handleUploadCustomMenu = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    try {
      const encoded: string[] = [];
      for (const file of files) {
        const dataUrl = await compressImageFileToDataUrl(file, 960);
        encoded.push(dataUrl);
      }
      const nextCustom = [...(meta.customMenuImages || []), ...encoded].slice(0, 6);
      onUpdateMeta(r.id, { customMenuImages: nextCustom });
      setShowMenuAddBox(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches?.[0];
    if (t) swipeBackRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swipeBackRef.current) return;
    const t = e.changedTouches?.[0];
    if (t) {
      const dx = t.clientX - swipeBackRef.current.x;
      const dy = t.clientY - swipeBackRef.current.y;
      if (swipeBackRef.current.x >= 24 && swipeBackRef.current.x < 110 && dx > 80 && Math.abs(dy) < 60) {
        dismissAnimated();
      }
    }
    swipeBackRef.current = null;
  };

  const open = getRestaurantOpenStatus(r);
  const distKm = calcDistanceKm(anchor, r.location);
  const tastes = classifyRestaurantTastes(r)
    .map((k) => TASTE_OPTIONS.find((t) => t.key === k))
    .filter(Boolean);
  const accessLabels = getAccessibilityLabels(r);
  const todayVi = JS_DAY_TO_VI[new Date().getDay()];

  const photos = [
    ...(r.imageUrl ? [r.imageUrl] : []),
    ...(r.galleryUrls || []).filter((u) => u && u !== r.imageUrl),
  ];
  const currentPhoto = photos[activePhotoIdx] || null;

  const dist = r.reviewsDistribution || {
    fiveStar: 0,
    fourStar: 0,
    threeStar: 0,
    twoStar: 0,
    oneStar: 0,
  };
  const totalStars =
    dist.fiveStar + dist.fourStar + dist.threeStar + dist.twoStar + dist.oneStar;

  const copyAddress = () => {
    navigator.clipboard?.writeText(r.address || r.title);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1800);
  };

  return (
    <div ref={overlayRef} className="sheet-overlay" onClick={dismissAnimated}>
      <div
        ref={panelRef}
        className="sheet-panel lg-surface-strong"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sheet-grab-zone" {...handleGrabProps}>
          <div ref={handleRef} className="sheet-handle" />

          {/* Header close bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 16px 10px',
              borderBottom: '1px solid var(--glass-hairline)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={`status-badge ${open.state}`}>{open.label}</span>
              {r.isUserAdded && (
                <span
                  className="status-badge"
                  style={{ background: 'var(--accent)', color: 'var(--accent-fg, #09090b)' }}
                >
                  <Sparkles size={10} /> Quán bạn thêm
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {r.isUserAdded && onEdit ? (
                <button
                  type="button"
                  className="lg-pill"
                  style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                  onClick={() => onEdit(r)}
                >
                  <Edit3 size={13} /> Sửa
                </button>
              ) : (
                onCloneAndEdit && (
                  <button
                    type="button"
                    className="lg-pill"
                    style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                    onClick={() => onCloneAndEdit(r)}
                    title="Tạo bản tuỳ chỉnh từ quán này"
                  >
                    <Edit3 size={13} /> Tuỳ chỉnh
                  </button>
                )
              )}
              <button
                type="button"
                onClick={dismissAnimated}
                aria-label="Đóng"
                className="lg-pill"
                style={{ width: 34, height: 34, minHeight: 34, padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollBodyRef}
          className="sheet-scroll-body"
          data-kb-scroll="true"
          {...bodyPullProps}
          style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Swipeable Hero Photo Carousel */}
          <div
            ref={heroTrackRef}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement)?.closest('button')) return;
              if (heroSnapTimerRef.current) {
                window.clearTimeout(heroSnapTimerRef.current);
                heroSnapTimerRef.current = null;
              }
              heroGestureRef.current = {
                active: true,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                startTime: Date.now(),
                dx: 0,
                axis: 'none',
                moved: false,
              };
            }}
            onPointerMove={(e) => {
              const g = heroGestureRef.current;
              if (!g.active || g.pointerId !== e.pointerId) return;
              const dx = e.clientX - g.startX;
              const dy = e.clientY - g.startY;
              if (g.axis === 'none') {
                if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
                if (Math.abs(dy) >= Math.abs(dx)) {
                  g.axis = 'y';
                  g.active = false;
                  return;
                }
                g.axis = 'x';
                g.moved = true;
                setHeroSliding(false);
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
              }
              if (g.axis === 'x') {
                e.stopPropagation();
                const atStartEdge = activePhotoIdx === 0 && dx > 0;
                const atEndEdge = activePhotoIdx >= photos.length - 1 && dx < 0;
                const resisted = atStartEdge || atEndEdge || photos.length <= 1 ? dx * 0.28 : dx;
                g.dx = resisted;
                setHeroDragX(resisted);
              }
            }}
            onPointerUp={(e) => {
              const g = heroGestureRef.current;
              if (!g.active && g.axis !== 'x') return;
              if (g.pointerId !== e.pointerId) return;
              g.active = false;
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {
                // ignore
              }
              if (g.axis === 'x') {
                e.stopPropagation();
                const w = heroTrackRef.current?.clientWidth || 340;
                const vel = g.dx / Math.max(16, Date.now() - g.startTime);
                let delta = 0;
                if (activePhotoIdx < photos.length - 1 && (g.dx < -38 || vel < -0.35)) {
                  delta = 1;
                } else if (activePhotoIdx > 0 && (g.dx > 38 || vel > 0.35)) {
                  delta = -1;
                }
                setHeroSliding(true);
                if (delta !== 0) {
                  setHeroDragX(-delta * w);
                  const nextIdx = activePhotoIdx + delta;
                  heroSnapTimerRef.current = window.setTimeout(() => {
                    heroSnapTimerRef.current = null;
                    setHeroSliding(false);
                    setHeroDragX(0);
                    setImgFailed(false);
                    setActivePhotoIdx(nextIdx);
                  }, 240);
                } else {
                  setHeroDragX(0);
                  heroSnapTimerRef.current = window.setTimeout(() => {
                    heroSnapTimerRef.current = null;
                    setHeroSliding(false);
                  }, 240);
                }
                window.setTimeout(() => {
                  heroGestureRef.current.moved = false;
                }, 80);
              }
            }}
            onPointerCancel={(e) => {
              const g = heroGestureRef.current;
              if (g.pointerId === e.pointerId) {
                g.active = false;
                setHeroSliding(true);
                setHeroDragX(0);
              }
            }}
            style={{
              position: 'relative',
              width: '100%',
              height: 210,
              borderRadius: 22,
              overflow: 'hidden',
              border: '1px solid var(--glass-border)',
              background: 'rgba(255,255,255,0.06)',
              flexShrink: 0,
              touchAction: 'pan-y',
              userSelect: 'none',
            }}
          >
            {photos.length > 0 && currentPhoto && !imgFailed ? (
              <div
                onClick={() => {
                  if (heroGestureRef.current.moved) return;
                  setLightboxState({ title: r.title, images: photos, idx: activePhotoIdx });
                }}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transform: `translate3d(${heroDragX}px, 0, 0)`,
                  transition: heroSliding ? 'transform 0.24s cubic-bezier(0.18, 0.96, 0.24, 1)' : 'none',
                  cursor: 'zoom-in',
                }}
              >
                {activePhotoIdx > 0 && (
                  <img
                    src={getCrispPhotoUrl(photos[activePhotoIdx - 1], 1080) || photos[activePhotoIdx - 1]}
                    alt={`${r.title} ${activePhotoIdx}`}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
                <img
                  src={getCrispPhotoUrl(currentPhoto, 1080) || currentPhoto}
                  alt={r.title}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.src !== currentPhoto) {
                      img.src = currentPhoto;
                    } else {
                      setImgFailed(true);
                    }
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {activePhotoIdx < photos.length - 1 && (
                  <img
                    src={getCrispPhotoUrl(photos[activePhotoIdx + 1], 1080) || photos[activePhotoIdx + 1]}
                    alt={`${r.title} ${activePhotoIdx + 2}`}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '100%',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
              </div>
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
                  background:
                    'radial-gradient(circle at 30% 20%, var(--accent-soft), rgba(15,23,42,0.5))',
                }}
              >
                <Utensils size={34} color="var(--accent)" />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {r.categoryName}
                </span>
              </div>
            )}

            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.68) 100%)',
                pointerEvents: 'none',
              }}
            />

            {photos.length > 1 && (
              <>
                {activePhotoIdx > 0 && (
                  <button
                    type="button"
                    aria-label="Ảnh trước"
                    onClick={(e) => {
                      e.stopPropagation();
                      const w = heroTrackRef.current?.clientWidth || 340;
                      if (heroSnapTimerRef.current) window.clearTimeout(heroSnapTimerRef.current);
                      setHeroSliding(true);
                      setHeroDragX(w);
                      const nextIdx = activePhotoIdx - 1;
                      heroSnapTimerRef.current = window.setTimeout(() => {
                        setHeroSliding(false);
                        setHeroDragX(0);
                        setImgFailed(false);
                        setActivePhotoIdx(nextIdx);
                      }, 240);
                    }}
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.22)',
                      background: 'rgba(15,23,42,0.52)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                {activePhotoIdx < photos.length - 1 && (
                  <button
                    type="button"
                    aria-label="Ảnh sau"
                    onClick={(e) => {
                      e.stopPropagation();
                      const w = heroTrackRef.current?.clientWidth || 340;
                      if (heroSnapTimerRef.current) window.clearTimeout(heroSnapTimerRef.current);
                      setHeroSliding(true);
                      setHeroDragX(-w);
                      const nextIdx = activePhotoIdx + 1;
                      heroSnapTimerRef.current = window.setTimeout(() => {
                        setHeroSliding(false);
                        setHeroDragX(0);
                        setImgFailed(false);
                        setActivePhotoIdx(nextIdx);
                      }, 240);
                    }}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.22)',
                      background: 'rgba(15,23,42,0.52)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                )}
              </>
            )}

            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: 12,
                right: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 99,
                  background: 'rgba(15,23,42,0.6)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                <ImageIcon size={12} /> {photos.length > 1 ? `${activePhotoIdx + 1}/${photos.length} ảnh` : `${r.imagesCount || 1} ảnh`}
              </span>

              {photos.length > 1 && (() => {
                const maxDots = 7;
                const half = Math.floor(maxDots / 2);
                const start = Math.max(0, Math.min(photos.length - maxDots, activePhotoIdx - half));
                const end = Math.min(photos.length, start + maxDots);
                const slice = Array.from({ length: end - start }, (_, k) => start + k);
                return (
                  <div style={{ display: 'flex', gap: 5, pointerEvents: 'auto' }}>
                    {slice.map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImgFailed(false);
                          setActivePhotoIdx(i);
                        }}
                        style={{
                          width: i === activePhotoIdx ? 18 : 7,
                          height: 7,
                          borderRadius: 99,
                          border: 'none',
                          background: i === activePhotoIdx ? 'var(--accent)' : 'rgba(255,255,255,0.52)',
                          cursor: 'pointer',
                          transition: 'all 0.22s var(--spring)',
                        }}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Title & Categories */}
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.25 }}>
              {r.title}
            </h2>
            {r.subTitle && (
              <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                {r.subTitle}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <span className="lg-pill active" style={{ minHeight: 28, padding: '3px 10px', fontSize: 11.5 }}>
                {r.categoryName}
              </span>
              {(r.categories || [])
                .filter((c) => c !== r.categoryName)
                .map((c) => (
                  <span
                    key={c}
                    className="lg-pill"
                    style={{ minHeight: 28, padding: '3px 10px', fontSize: 11.5 }}
                  >
                    {c}
                  </span>
                ))}
              {effectivePrice && (
                <span className="price-pill-highlight" style={{ padding: '4px 12px', fontSize: 13 }}>
                  <Banknote size={14} /> {effectivePrice}
                </span>
              )}
              {tastes.map((t) =>
                t ? (
                  <span
                    key={t.key}
                    className="lg-pill"
                    style={{ minHeight: 28, padding: '3px 10px', fontSize: 11.5 }}
                  >
                    {t.emoji} {t.label}
                  </span>
                ) : null
              )}
            </div>
          </div>

          {/* Apple Maps Clean Price Reference Section */}
          <div
            className="apple-inset-group"
            style={{
              padding: 13,
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <Banknote size={14} color="var(--accent)" /> MỨC GIÁ & PHÂN LOẠI
              </span>
              <span
                className={effectivePrice ? 'price-pill-highlight' : 'lg-pill'}
                style={{ fontSize: 11.5, minHeight: 24, padding: '2px 9px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {venueTier.emoji} {venueTier.label}
                {effectivePrice ? ` · ${effectivePrice}` : ''}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {venueTier.source === 'price'
                ? 'Phân loại theo mức giá của quán'
                : venueTier.source === 'review'
                ? `Phân loại theo giá khách nhắc trong đánh giá (${venueTier.priceHint})`
                : `${venueTier.priceHint} (chưa có bảng giá — chạm bên dưới để tự gắn nhanh)`}
            </div>

            <div className="h-scroll-row">
              {['30k - 60k', '60k - 150k', '150k - 300k', '300k+'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`lg-pill ${effectivePrice === preset ? 'active' : ''}`}
                  style={{
                    minHeight: 29,
                    padding: '3px 10px',
                    fontSize: 11.5,
                  }}
                  onClick={() => {
                    const nextVal = meta.customPrice === preset ? undefined : preset;
                    setPriceDraft(nextVal || r.price || '');
                    onUpdateMeta(r.id, { customPrice: nextVal });
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                className="lg-input"
                style={{ minHeight: 34, padding: '6px 10px', fontSize: 12.5, flex: '1 1 140px', minWidth: 0 }}
                placeholder="Nhập mức giá khác (VD: 50k/bát, 200k/người)..."
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onUpdateMeta(r.id, { customPrice: priceDraft.trim() || undefined });
                  }
                }}
              />
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="lg-pill active"
                  style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }}
                  onClick={() => onUpdateMeta(r.id, { customPrice: priceDraft.trim() || undefined })}
                >
                  Lưu giá
                </button>
                {meta.customPrice && (
                  <button
                    type="button"
                    className="lg-pill"
                    style={{ minHeight: 34, padding: '0 10px', fontSize: 12 }}
                    onClick={() => {
                      setPriceDraft(r.price || '');
                      onUpdateMeta(r.id, { customPrice: undefined });
                    }}
                  >
                    Xoá
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Google Maps-Style Menu (Tổng quan / Category Tabs / Highlights / Dish Price List) */}
          <div
            className="apple-inset-group"
            style={{
              padding: 13,
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <BookOpen size={14} color="var(--accent)" /> THỰC ĐƠN
                {effectiveMenu.totalDishes > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                    ({effectiveMenu.totalDishes} món)
                  </span>
                )}
              </span>
              <button
                type="button"
                className={`lg-pill ${showMenuAddBox ? 'active' : ''}`}
                style={{ minHeight: 27, padding: '2px 10px', fontSize: 11.5 }}
                onClick={() => setShowMenuAddBox((v) => !v)}
              >
                <Plus size={12} /> {showMenuAddBox ? 'Đóng' : 'Sao chép từ Maps'}
              </button>
            </div>

            {hasAnyMenuData ? (
              <>
                {/* Google Maps Thực đơn Sub-tabs: Tổng quan | Menu ... */}
                {(effectiveMenu.menuSections.length > 0 || effectiveMenu.menuHighlights.length > 0) && (
                  <div className="h-scroll-row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className={`lg-pill ${menuTab === 'overview' ? 'active' : ''}`}
                      style={{ minHeight: 30, padding: '3px 12px', fontSize: 12 }}
                      onClick={() => setMenuTab('overview')}
                    >
                      Tổng quan
                    </button>
                    {effectiveMenu.menuSections.map((sec, sIdx) => (
                      <button
                        key={`${sIdx}-${sec.title}`}
                        type="button"
                        className={`lg-pill ${menuTab === sIdx ? 'active' : ''}`}
                        style={{ minHeight: 30, padding: '3px 12px', fontSize: 12 }}
                        onClick={() => setMenuTab(sIdx)}
                      >
                        {sec.title} ({sec.items.length})
                      </button>
                    ))}
                  </div>
                )}

                {/* Overview Tab: Menu Photos + Điểm nổi bật */}
                {menuTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {effectiveMenuImages.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700 }}>Menu</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {effectiveMenuImages.length} ảnh
                          </span>
                        </div>
                        <div className="h-scroll-row" style={{ gap: 8 }}>
                          {effectiveMenuImages.map((src, idx) => {
                            const isCustom = (meta.customMenuImages || []).includes(src);
                            return (
                              <div
                                key={`${idx}-${src.slice(0, 24)}`}
                                style={{
                                  position: 'relative',
                                  width: 96,
                                  height: 126,
                                  borderRadius: 13,
                                  overflow: 'hidden',
                                  flexShrink: 0,
                                  border: '1px solid var(--glass-border)',
                                  background: 'rgba(15,23,42,0.3)',
                                }}
                              >
                                <img
                                  src={getCrispPhotoUrl(src, 900) || src}
                                  alt={`Thực đơn ${r.title} ${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                  onClick={() =>
                                    setLightboxState({
                                      title: 'Ảnh thực đơn',
                                      images: effectiveMenuImages,
                                      idx,
                                    })
                                  }
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
                                />
                                {isCustom && (
                                  <button
                                    type="button"
                                    aria-label="Xoá ảnh thực đơn tự thêm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = (meta.customMenuImages || []).filter((item) => item !== src);
                                      onUpdateMeta(r.id, { customMenuImages: next.length > 0 ? next : undefined });
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: 4,
                                      right: 4,
                                      width: 22,
                                      height: 22,
                                      borderRadius: 999,
                                      border: 'none',
                                      background: 'rgba(0,0,0,0.72)',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {effectiveMenu.menuHighlights.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700 }}>Điểm nổi bật</span>
                        <div className="h-scroll-row" style={{ gap: 9 }}>
                          {effectiveMenu.menuHighlights.map((hl, idx) => (
                            <button
                              key={`${idx}-${hl.name}`}
                              type="button"
                              onClick={() =>
                                setLightboxState({
                                  title: 'Điểm nổi bật',
                                  images: effectiveMenu.menuHighlights.map((h) => h.imageUrl),
                                  idx,
                                })
                              }
                              style={{
                                width: 132,
                                flexShrink: 0,
                                borderRadius: 14,
                                overflow: 'hidden',
                                border: '1px solid var(--glass-border)',
                                background: 'var(--glass-surface-quiet)',
                                padding: 0,
                                textAlign: 'left',
                                cursor: 'zoom-in',
                                color: 'var(--text-primary)',
                                fontFamily: 'inherit',
                              }}
                            >
                              <img
                                src={getCrispPhotoUrl(hl.imageUrl, 600) || hl.imageUrl}
                                alt={hl.name}
                                referrerPolicy="no-referrer"
                                style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                              />
                              <div style={{ padding: '7px 8px' }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    lineHeight: 1.3,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {hl.name}
                                </div>
                                {hl.price && (
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                                    {hl.price}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Structured Dish Price List (shown for selected Menu tab, or all sections under Tổng quan) */}
                {effectiveMenu.menuSections.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(menuTab === 'overview'
                      ? effectiveMenu.menuSections
                      : effectiveMenu.menuSections.slice(menuTab, menuTab + 1)
                    ).map((sec, sIdx) => (
                      <div key={`${sIdx}-${sec.title}`} style={{ display: 'flex', flexDirection: 'column' }}>
                        {menuTab === 'overview' && (
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 800,
                              color: 'var(--accent)',
                              paddingBottom: 4,
                              borderBottom: '1px solid var(--glass-hairline)',
                            }}
                          >
                            {sec.title}
                          </div>
                        )}
                        {sec.items.map((item, dIdx) => (
                          <div
                            key={`${dIdx}-${item.name}`}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 12,
                              padding: '9px 0',
                              borderBottom:
                                dIdx < sec.items.length - 1 ? '1px solid var(--glass-hairline)' : 'none',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, color: 'var(--text-primary)' }}>
                                {item.name}
                              </div>
                              {item.description && (
                                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              {item.price && (
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.price}
                                </span>
                              )}
                              {item.imageUrl && (
                                <img
                                  src={getCrispPhotoUrl(item.imageUrl, 300) || item.imageUrl}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  onClick={() =>
                                    setLightboxState({
                                      title: item.name,
                                      images: [item.imageUrl!],
                                      idx: 0,
                                    })
                                  }
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 9,
                                    objectFit: 'cover',
                                    cursor: 'zoom-in',
                                    border: '1px solid var(--glass-hairline)',
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Chưa có thực đơn chi tiết trên dữ liệu công khai. Bạn có thể bấm <strong style={{ color: 'var(--text-primary)' }}>+ Sao chép từ Maps</strong> để dán nhanh danh sách món & giá hoặc ảnh thực đơn từ Google Maps!
                </div>
                {r.reviewsTags && r.reviewsTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {r.reviewsTags.slice(0, 6).map((tag) => (
                      <span
                        key={tag.title}
                        className="lg-pill"
                        style={{ minHeight: 24, padding: '2px 8px', fontSize: 11, color: 'var(--text-secondary)' }}
                      >
                        {tag.title} ({tag.count})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showMenuAddBox && (
              <div
                className="inline-expand-panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                  paddingTop: 8,
                  borderTop: '1px solid var(--glass-hairline)',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>
                  📋 Dán Thực đơn trực tiếp từ Google Maps
                </div>
                <textarea
                  className="lg-input"
                  rows={4}
                  placeholder={
                    'Mở quán trên Google Maps -> tab Thực đơn -> bôi đen & copy chữ dán vào đây:\nMenu Cơm Sốt Nhật\nCơm Gà Sốt Trứng\n55.000 đ\n\nHoặc dán JSON lấy từ nút Lệnh Chrome bên dưới...'
                  }
                  value={menuPasteDraft}
                  onChange={(e) => setMenuPasteDraft(e.target.value)}
                  style={{ fontSize: 12, lineHeight: 1.4 }}
                />

                {menuPasteDraft.trim() && (
                  <div style={{ fontSize: 11.5, color: menuParsePreview.dishCount > 0 || menuParsePreview.menuImages.length > 0 ? '#4ade80' : '#fca5a5' }}>
                    {menuParsePreview.dishCount > 0 || menuParsePreview.menuImages.length > 0 || menuParsePreview.menuHighlights.length > 0
                      ? `✓ Nhận diện: ${menuParsePreview.menuSections.length} nhóm · ${menuParsePreview.dishCount} món` +
                        (menuParsePreview.menuHighlights.length > 0 ? ` · ${menuParsePreview.menuHighlights.length} điểm nổi bật` : '') +
                        (menuParsePreview.menuImages.length > 0 ? ` · ${menuParsePreview.menuImages.length} ảnh menu` : '') +
                        (menuParsePreview.inferredPriceRange ? ` · Giá ~ ${menuParsePreview.inferredPriceRange}` : '')
                      : 'Chưa nhận diện được món/giá — hãy kiểm tra lại định dạng (mỗi món + dòng giá như 55.000 đ).'}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="lg-pill active"
                    style={{ flex: 1, minHeight: 34, fontSize: 12 }}
                    disabled={!menuPasteDraft.trim() || (menuParsePreview.dishCount === 0 && menuParsePreview.menuImages.length === 0 && menuParsePreview.menuHighlights.length === 0)}
                    onClick={() => {
                      const patch: Partial<PersonalRestaurantMeta> = {};
                      if (menuParsePreview.menuSections.length > 0) {
                        patch.customMenuSections = menuParsePreview.menuSections;
                      }
                      if (menuParsePreview.menuHighlights.length > 0) {
                        patch.customMenuHighlights = menuParsePreview.menuHighlights;
                      }
                      if (menuParsePreview.menuImages.length > 0) {
                        patch.customMenuImages = Array.from(
                          new Set([...(meta.customMenuImages || []), ...menuParsePreview.menuImages])
                        ).slice(0, 12);
                      }
                      if (!meta.customPrice && !r.price && menuParsePreview.inferredPriceRange) {
                        patch.customPrice = menuParsePreview.inferredPriceRange;
                        setPriceDraft(menuParsePreview.inferredPriceRange);
                      }
                      onUpdateMeta(r.id, patch);
                      setMenuPasteDraft('');
                      setMenuTab('overview');
                      setShowMenuAddBox(false);
                    }}
                  >
                    <Check size={13} /> Lưu thực đơn
                  </button>
                  <button
                    type="button"
                    className="lg-pill"
                    style={{ minHeight: 34, fontSize: 11.5 }}
                    onClick={() => {
                      navigator.clipboard?.writeText(MAPS_MENU_CONSOLE_SNIPPET);
                      setMenuSnippetCopied(true);
                      window.setTimeout(() => setMenuSnippetCopied(false), 3000);
                    }}
                    title="Chép mã chạy 1 lần trong Console (F12) ở tab Google Maps để lấy FULL cả ảnh Menu + Điểm nổi bật + tất cả các tab món"
                  >
                    <Copy size={12} /> {menuSnippetCopied ? '✓ Đã chép (Mở Maps -> F12 -> Console -> Dán)' : 'Lấy Full + Ảnh từ Chrome'}
                  </button>
                </div>

                {hasCustomMenu && (
                  <button
                    type="button"
                    className="lg-pill"
                    style={{ minHeight: 30, fontSize: 11.5, color: '#fca5a5', borderColor: 'rgba(248,113,113,0.35)' }}
                    onClick={() => {
                      onUpdateMeta(r.id, {
                        customMenuSections: undefined,
                        customMenuHighlights: undefined,
                        customMenuImages: undefined,
                      });
                      setMenuTab('overview');
                    }}
                  >
                    <Trash2 size={12} /> Xoá thực đơn tự nhập
                  </button>
                )}

                <div style={{ height: 1, background: 'var(--glass-hairline)', margin: '2px 0' }} />

                <label className="lg-pill" style={{ cursor: 'pointer', minHeight: 34, fontSize: 12, justifyContent: 'center' }}>
                  <FileUp size={13} /> Hoặc chọn / chụp ảnh thực đơn từ máy
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadCustomMenu}
                    style={{ display: 'none' }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="lg-input"
                    style={{ minHeight: 34, padding: '5px 10px', fontSize: 12 }}
                    placeholder="Hoặc dán link URL ảnh thực đơn..."
                    value={menuUrlDraft}
                    onChange={(e) => setMenuUrlDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    className="lg-pill active"
                    style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }}
                    onClick={() => {
                      const val = menuUrlDraft.trim();
                      if (!val) return;
                      const nextCustom = Array.from(new Set([...(meta.customMenuImages || []), val])).slice(0, 6);
                      onUpdateMeta(r.id, { customMenuImages: nextCustom });
                      setMenuUrlDraft('');
                      setShowMenuAddBox(false);
                    }}
                  >
                    Lưu ảnh
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, borderTop: '1px solid var(--glass-hairline)' }}>
              {r.menuUrl && (
                <a
                  href={r.menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lg-pill active"
                  style={{ minHeight: 34, fontSize: 12, textDecoration: 'none', justifyContent: 'center' }}
                >
                  <BookOpen size={13} /> Mở trang Thực đơn của quán <ExternalLink size={12} />
                </a>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                Tìm thêm thực đơn & giá trên Web / Grab / Foody:
              </span>
              <ExternalLookupPills restaurantOrTitle={r} compact />
            </div>
          </div>

          {(r.description || r.ownerDescription) && (
            <div className="lg-surface" style={{ borderRadius: 20, padding: 13 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                GIỚI THIỆU QUÁN
              </div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                {r.description || r.ownerDescription}
              </p>
            </div>
          )}

          {/* Primary Action CTA Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
            <button
              type="button"
              className="lg-btn-accent"
              onClick={() => onChooseToday(r)}
            >
              <Sparkles size={16} /> Chốt ăn quán này!
            </button>
            <button
              type="button"
              className={`lg-pill ${meta.favorite ? 'active' : ''}`}
              style={{ minHeight: 44, padding: '0 14px' }}
              onClick={() => onUpdateMeta(r.id, { favorite: !meta.favorite })}
              aria-label="Yêu thích"
            >
              <Heart
                size={18}
                color={meta.favorite ? '#fb7185' : 'var(--text-primary)'}
                fill={meta.favorite ? '#fb7185' : 'none'}
              />
            </button>
            <button
              type="button"
              className={`lg-pill ${meta.wishlist ? 'active' : ''}`}
              style={{ minHeight: 44, padding: '0 14px' }}
              onClick={() => onUpdateMeta(r.id, { wishlist: !meta.wishlist })}
              aria-label="Muốn thử"
            >
              <Bookmark
                size={18}
                color={meta.wishlist ? '#facc15' : 'var(--text-primary)'}
                fill={meta.wishlist ? '#facc15' : 'none'}
              />
            </button>
          </div>

          {/* Quick Connect Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <a
              href={buildMapsDirectionUrl(r, mapsApp)}
              target="_blank"
              rel="noreferrer"
              className="lg-pill"
              style={{ textDecoration: 'none', flex: '1 1 auto' }}
            >
              <Compass size={15} color="var(--accent)" />{' '}
              {mapsApp === 'apple' ? 'Chỉ đường Apple Maps' : 'Chỉ đường Google Maps'}
            </a>
            {r.phone && (
              <a
                href={`tel:${r.phoneUnformatted || r.phone.replace(/\s+/g, '')}`}
                className="lg-pill"
                style={{ textDecoration: 'none', flex: '1 1 auto' }}
              >
                <Phone size={15} color="var(--accent)" /> {r.phone}
              </a>
            )}
            {r.website && (
              <a
                href={r.website}
                target="_blank"
                rel="noreferrer"
                className="lg-pill"
                style={{ textDecoration: 'none' }}
              >
                <Globe size={15} /> Trang web <ExternalLink size={12} />
              </a>
            )}
            {r.reserveTableUrl && (
              <a
                href={r.reserveTableUrl}
                target="_blank"
                rel="noreferrer"
                className="lg-pill"
                style={{ textDecoration: 'none' }}
              >
                <Calendar size={15} /> Đặt bàn
              </a>
            )}
          </div>

          {/* Rating & Reviews Distribution */}
          <div className="lg-surface" style={{ borderRadius: 22, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 800 }}>
                  {r.totalScore !== null ? r.totalScore.toFixed(1) : '—'}
                </span>
                <div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        color="#fbbf24"
                        fill={r.totalScore && s <= Math.round(r.totalScore) ? '#fbbf24' : 'none'}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {r.reviewsCount ?? 0} lượt đánh giá trên Google
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                Hạng #{r.rank || '—'}
              </span>
            </div>

            {totalStars > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { label: '5★', val: dist.fiveStar },
                  { label: '4★', val: dist.fourStar },
                  { label: '3★', val: dist.threeStar },
                  { label: '2★', val: dist.twoStar },
                  { label: '1★', val: dist.oneStar },
                ].map((row) => {
                  const pct = Math.round((row.val / totalStars) * 100);
                  return (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                      <span style={{ width: 24, fontWeight: 600, color: 'var(--text-secondary)' }}>{row.label}</span>
                      <div
                        style={{
                          flex: 1,
                          height: 7,
                          borderRadius: 99,
                          background: 'rgba(255,255,255,0.12)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 99,
                            background: 'linear-gradient(90deg, var(--accent), var(--accent-secondary))',
                          }}
                        />
                      </div>
                      <span style={{ width: 38, textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                        {row.val}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {r.reviews && r.reviews.length > 0 && (() => {
              const filteredReviews = r.reviews.filter((rv) => {
                if (reviewFilter === '5star') return rv.stars >= 5;
                if (reviewFilter === 'photos') return Boolean(rv.reviewImageUrls && rv.reviewImageUrls.length > 0);
                if (reviewFilter === 'price') {
                  return /\d+\s?(k|nghìn|ngàn|tr|đ|d)|giá|thực đơn|menu|đắt|rẻ|hợp lý|bát|suất|người/i.test(
                    rv.text || ''
                  );
                }
                return true;
              });
              const displayedReviews = showAllReviews ? filteredReviews : filteredReviews.slice(0, 4);
              return (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--glass-hairline)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      BÀI ĐÁNH GIÁ THỰC TẾ ({r.reviews.length})
                    </span>
                  </div>

                  {r.reviewsTags && r.reviewsTags.length > 0 && (
                    <div className="h-scroll-row" style={{ gap: 5 }}>
                      {r.reviewsTags.slice(0, 8).map((tag) => (
                        <span
                          key={tag.title}
                          style={{
                            fontSize: 10.5,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--glass-hairline)',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          #{tag.title} ({tag.count})
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="h-scroll-row" style={{ gap: 6 }}>
                    {(
                      [
                        ['all', 'Tất cả'],
                        ['price', 'Nhắc giá & món'],
                        ['photos', 'Có ảnh'],
                        ['5star', '5★'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`lg-pill ${reviewFilter === key ? 'active' : ''}`}
                        style={{ minHeight: 26, padding: '2px 10px', fontSize: 11 }}
                        onClick={() => setReviewFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {displayedReviews.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>
                      Không có bài đánh giá khớp bộ lọc này.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {displayedReviews.map((rv, rIdx) => (
                        <div
                          key={rv.id || `${rv.name}-${rIdx}`}
                          style={{
                            borderRadius: 14,
                            padding: '10px 11px',
                            background: 'var(--glass-pill-bg)',
                            border: '1px solid var(--glass-hairline)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                              {rv.reviewerPhotoUrl ? (
                                <img
                                  src={rv.reviewerPhotoUrl}
                                  alt={rv.name}
                                  referrerPolicy="no-referrer"
                                  style={{ width: 24, height: 24, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}
                                />
                              ) : (
                                <span
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 999,
                                    background: 'var(--accent-soft)',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {rv.name.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {rv.name}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', flexShrink: 0 }}>
                              {'★'.repeat(Math.max(1, Math.min(5, Math.round(rv.stars))))}
                            </span>
                          </div>

                          {rv.text && (
                            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.48, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
                              {rv.text}
                            </p>
                          )}

                          {rv.reviewImageUrls && rv.reviewImageUrls.length > 0 && (
                            <div className="h-scroll-row" style={{ gap: 6 }}>
                              {rv.reviewImageUrls.map((imgUrl, iIdx) => (
                                <img
                                  key={`${iIdx}-${imgUrl.slice(0, 20)}`}
                                  src={getCrispPhotoUrl(imgUrl, 400) || imgUrl}
                                  alt={`Ảnh đánh giá ${iIdx + 1}`}
                                  referrerPolicy="no-referrer"
                                  onClick={() =>
                                    setLightboxState({
                                      title: `Ảnh từ đánh giá của ${rv.name}`,
                                      images: rv.reviewImageUrls!,
                                      idx: iIdx,
                                    })
                                  }
                                  style={{
                                    width: 68,
                                    height: 68,
                                    borderRadius: 10,
                                    objectFit: 'cover',
                                    cursor: 'zoom-in',
                                    flexShrink: 0,
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          {rv.responseFromOwnerText && (
                            <div
                              style={{
                                marginTop: 2,
                                paddingLeft: 8,
                                borderLeft: '2px solid var(--glass-border)',
                                fontSize: 11.5,
                                color: 'var(--text-secondary)',
                                lineHeight: 1.4,
                              }}
                            >
                              <strong>Chủ quán phản hồi:</strong> {rv.responseFromOwnerText}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredReviews.length > 4 && (
                    <button
                      type="button"
                      className="lg-pill"
                      style={{ minHeight: 32, fontSize: 12, justifyContent: 'center' }}
                      onClick={() => setShowAllReviews((v) => !v)}
                    >
                      {showAllReviews
                        ? 'Thu gọn đánh giá'
                        : `Xem thêm ${filteredReviews.length - 4} đánh giá nữa`}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Location & Distance */}
          <div className="lg-surface" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                ĐỊA CHỈ TẠI NINH BÌNH
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                Cách {formatDistance(distKm)} (~{estimateMinutes(distKm)} phút đi xe)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <MapPin size={16} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.45 }}>
                {r.address || `${r.street || ''}, ${normalizeShortNeighborhood(r)}, Ninh Bình`}
              </div>
              <button
                type="button"
                className="lg-pill"
                style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                onClick={copyAddress}
              >
                {copiedAddr ? <Check size={12} color="var(--accent)" /> : <Copy size={12} />}
                {copiedAddr ? 'Đã chép' : 'Chép'}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Khu vực: {normalizeShortNeighborhood(r)} · Tọa độ: {r.location.lat.toFixed(5)}, {r.location.lng.toFixed(5)}
            </div>
          </div>

          {/* 7-day Opening Hours */}
          <div className="lg-surface" style={{ borderRadius: 22, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Clock size={15} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                GIỜ MỞ CỬA TRONG TUẦN
              </span>
            </div>
            {r.openingHours && r.openingHours.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.openingHours.map((oh) => {
                  const isToday = oh.day.toLowerCase() === todayVi.toLowerCase();
                  return (
                    <div
                      key={oh.day}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        padding: '5px 8px',
                        borderRadius: 10,
                        background: isToday ? 'var(--accent-soft)' : 'transparent',
                        fontWeight: isToday ? 700 : 500,
                      }}
                    >
                      <span>{oh.day}{isToday ? ' (Hôm nay)' : ''}</span>
                      <span style={{ color: isToday ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {oh.hours}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Chưa có lịch giờ mở cửa chi tiết.
              </div>
            )}

            {r.additionalOpeningHours && Object.keys(r.additionalOpeningHours).length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                  KHUNG GIỜ PHỤC VỤ RIÊNG
                </div>
                {Object.entries(r.additionalOpeningHours).map(([kind, list]) => (
                  <div key={kind} style={{ fontSize: 12.5, marginBottom: 4 }}>
                    <strong>{kind}:</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {list[0]?.hours || 'Theo ngày'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Amenities & Additional Info */}
          {accessLabels.some((item) => item.available) && (
            <div className="lg-surface" style={{ borderRadius: 22, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                TIỆN ÍCH & DỊCH VỤ QUÁN
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Array.from(
                  new Map(
                    accessLabels
                      .filter((item) => item.available)
                      .map((item) => [item.label, item])
                  ).values()
                )
                  .slice(0, 18)
                  .map((item) => (
                    <span
                      key={item.label}
                      className="lg-pill"
                      style={{
                        minHeight: 28,
                        fontSize: 11.5,
                        borderColor: 'var(--accent-border, var(--glass-border))',
                      }}
                    >
                      ✓ {item.label}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Personal Journal / Customization for this restaurant */}
          <div className="lg-surface" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
              NHẬT KÝ & TUỲ CHỈNH CÁ NHÂN CỦA BẠN
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className={`lg-pill ${meta.visited ? 'active' : ''}`}
                onClick={() =>
                  onUpdateMeta(r.id, {
                    visited: !meta.visited,
                    lastVisitedAt: !meta.visited ? new Date().toISOString() : meta.lastVisitedAt,
                  })
                }
              >
                <CheckCircle2 size={14} /> {meta.visited ? 'Đã từng ăn ✓' : 'Đánh dấu đã ăn'}
              </button>

              <button
                type="button"
                className={`lg-pill ${meta.blacklisted ? 'active' : ''}`}
                style={meta.blacklisted ? { borderColor: '#f87171', background: 'rgba(239,68,68,0.25)' } : {}}
                onClick={() => onUpdateMeta(r.id, { blacklisted: !meta.blacklisted })}
              >
                <Ban size={14} /> {meta.blacklisted ? 'Đang ẩn khỏi gợi ý' : 'Ẩn khỏi vòng quay'}
              </button>
            </div>

            {/* Personal star rating */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Bạn tự chấm quán này:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() =>
                      onUpdateMeta(r.id, {
                        personalRating: meta.personalRating === star ? undefined : star,
                      })
                    }
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 3,
                      cursor: 'pointer',
                    }}
                  >
                    <Star
                      size={20}
                      color="#fbbf24"
                      fill={(meta.personalRating || 0) >= star ? '#fbbf24' : 'none'}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Add to custom collections */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <FolderPlus size={13} /> Lưu vào bộ sưu tập cá nhân:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {collections.map((c) => {
                  const inCol = c.restaurantIds.includes(r.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`lg-pill ${inCol ? 'active' : ''}`}
                      style={{ minHeight: 32, fontSize: 12 }}
                      onClick={() => onToggleCollection(c.id, r.id)}
                    >
                      {c.emoji} {c.name} {inCol ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Private Note */}
            <div>
              <textarea
                className="lg-input"
                rows={2}
                placeholder="Ghi chú riêng (VD: Nước dùng đậm vị, nên đi sớm trước 19h, nhớ gọi thêm dê tái chanh...)"
                value={noteDraft}
                onChange={(e) => {
                  const val = e.target.value;
                  setNoteDraft(val);
                  if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
                  noteTimerRef.current = window.setTimeout(() => {
                    onUpdateMeta(r.id, { note: val });
                  }, 320);
                }}
                onBlur={() => flushNoteNow(noteDraft)}
                style={{ resize: 'vertical', minHeight: 68 }}
              />
            </div>
          </div>

          {/* Delete user-added restaurant */}
          {r.isUserAdded && onDelete && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {!confirmDelete ? (
                <button
                  type="button"
                  className="lg-pill"
                  style={{ color: '#fca5a5', borderColor: 'rgba(248,113,113,0.4)' }}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} /> Xoá quán đã thêm
                </button>
              ) : (
                <>
                  <button type="button" className="lg-pill" onClick={() => setConfirmDelete(false)}>
                    Huỷ
                  </button>
                  <button
                    type="button"
                    className="lg-pill"
                    style={{ background: 'rgba(239,68,68,0.45)', borderColor: '#f87171', color: '#fff' }}
                    onClick={() => onDelete(r.id)}
                  >
                    Xác nhận xoá vĩnh viễn
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <PhotoLightboxModal lightboxState={lightboxState} onChangeState={setLightboxState} />
    </div>
  );
};
