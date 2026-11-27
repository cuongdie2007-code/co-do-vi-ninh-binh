import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Ban,
  Bell,
  Check,
  ChevronLeft,
  Compass,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileUp,
  Info,
  Layers,
  LocateFixed,
  Mail,
  MapPin,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sliders,
  Sparkles,
  Store,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  BudgetLevel,
  CardDensity,
  CompanionType,
  CustomThemeConfig,
  GlassMode,
  MapsProvider,
  Restaurant,
  TasteKey,
  UserProfile,
} from '../../types/restaurant';
import {
  APP_AUTHOR,
  DEFAULT_CUSTOM_THEME,
  NINH_BINH_ANCHORS,
  TASTE_OPTIONS,
} from '../../data/themes';
import { useSheetDragDismiss } from '../../hooks/useSheetDragDismiss';
import { useAnimatedMount } from '../../hooks/useAnimatedMount';
import { playChimeSuccess, spawnCelebrationConfetti } from '../../utils/feedbackUtils';
import {
  AppleSwitch,
  CompactLivePreview,
  SettingsHubRow,
  SwipeToDeleteRow,
} from './SettingsHelpers';

export type SettingsSubPage =
  | 'root'
  | 'appearance'
  | 'cards'
  | 'discovery'
  | 'location'
  | 'feedback'
  | 'data'
  | 'about';

interface SearchIndexItem {
  key: string;
  page: Exclude<SettingsSubPage, 'root'>;
  title: string;
  group: string;
  keywords: string;
}

const SEARCH_ITEMS: SearchIndexItem[] = [
  { key: 'mode', page: 'appearance', title: 'Chế độ Hệ thống · Sáng / Tối', group: 'Hệ thống & Chủ đề', keywords: 'hệ thống sáng tối dark light system oled đen' },
  { key: 'custom-photo', page: 'appearance', title: 'Tải ảnh nền của bạn & Tự phối màu', group: 'Hệ thống & Chủ đề', keywords: 'tải ảnh nền wallpaper trích xuất màu' },
  { key: 'custom-color', page: 'appearance', title: 'Tự chỉnh màu chủ đề', group: 'Hệ thống & Chủ đề', keywords: 'tự chỉnh màu sắc accent chủ đề' },
  { key: 'blur', page: 'cards', title: 'Độ mờ kính (Blur) & Độ đặc nền', group: 'Kính mờ & Thẻ quán', keywords: 'kính mờ liquid glass blur opacity viền rim' },
  { key: 'density', page: 'cards', title: 'Thông tin thẻ quán (Tối giản / Chi tiết)', group: 'Kính mờ & Thẻ quán', keywords: 'thẻ quán tối giản chi tiết bố cục lưới khoảng cách giá sao giờ mở cửa' },
  { key: 'tastes', page: 'discovery', title: 'Khẩu vị & Món tủ yêu thích', group: 'Khẩu vị & Bộ lọc', keywords: 'khẩu vị món tủ dê cơm cháy phở bún ăn đêm chay' },
  { key: 'minRating', page: 'discovery', title: 'Ngưỡng đánh giá tối thiểu & Ngân sách', group: 'Khẩu vị & Bộ lọc', keywords: 'đánh giá sao tối thiểu ngân sách bạn đồng hành loại trừ' },
  { key: 'mapsApp', page: 'location', title: 'Ứng dụng chỉ đường (Google / Apple Maps)', group: 'Vị trí & Chỉ đường', keywords: 'google maps apple maps chỉ đường bản đồ' },
  { key: 'anchor', page: 'location', title: 'Vị trí xuất phát tại Ninh Bình & GPS', group: 'Vị trí & Chỉ đường', keywords: 'vị trí gps điểm mốc phố cổ tràng an' },
  { key: 'sound', page: 'feedback', title: 'Âm thanh, Pháo giấy & Giảm chuyển động', group: 'Cảm giác & Âm thanh', keywords: 'âm thanh pháo giấy giảm chuyển động pin rung' },
  { key: 'userPlaces', page: 'data', title: 'Quán tôi tự thêm (Vuốt để xoá)', group: 'Dữ liệu & Quán của tôi', keywords: 'quán tự thêm sửa xoá danh sách' },
  { key: 'blacklisted', page: 'data', title: 'Quán đã ẩn & Khôi phục', group: 'Dữ liệu & Quán của tôi', keywords: 'quán đã ẩn khôi phục loại trừ' },
  { key: 'backup', page: 'data', title: 'Sao lưu JSON & Đặt lại mặc định', group: 'Dữ liệu & Quán của tôi', keywords: 'sao lưu backup xuất nhập json đặt lại mặc định' },
  { key: 'author', page: 'about', title: 'Về ứng dụng & Tác giả (Bùi Ngọc Cường)', group: 'Giới thiệu', keywords: 'tác giả admin developer bùi ngọc cường cuongxgi facebook email liên hệ giới thiệu phiên bản' },
];

const PAGE_TITLES: Record<SettingsSubPage, string> = {
  root: 'Cài đặt',
  appearance: 'Hệ thống & Chủ đề',
  cards: 'Kính mờ & Thẻ quán',
  discovery: 'Khẩu vị & Bộ lọc',
  location: 'Vị trí & Chỉ đường',
  feedback: 'Cảm giác & Âm thanh',
  data: 'Quán của tôi & Dữ liệu',
  about: 'Về ứng dụng & Tác giả',
};

interface SettingsModalProps {
  isOpen: boolean;
  profile: UserProfile;
  userRestaurants: Restaurant[];
  allRestaurants: Restaurant[];
  statusMsg: string | null;
  onClose: () => void;
  onChangeProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onUpdateGlass: (patch: Partial<UserProfile['glass']>) => void;
  onUpdateDietary: (patch: Partial<UserProfile['dietary']>) => void;
  onToggleTaste: (key: TasteKey) => void;
  onUpdateCustomTheme: (patch: Partial<CustomThemeConfig>) => void;
  onUploadWallpaper: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReExtractBg: () => void;
  onLocateGps: () => void;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetProfile: () => void;
  onFlashMsg: (msg: string) => void;
  onOpenAddModal: () => void;
  onEditUserRestaurant?: (r: Restaurant) => void;
  onDeleteUserRestaurant?: (id: string) => void;
  onUnblacklistRestaurant?: (id: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  profile,
  userRestaurants,
  allRestaurants,
  statusMsg,
  onClose,
  onChangeProfile,
  onUpdateGlass,
  onUpdateDietary,
  onToggleTaste,
  onUpdateCustomTheme,
  onUploadWallpaper,
  onReExtractBg,
  onLocateGps,
  onExportBackup,
  onImportBackup,
  onResetProfile,
  onFlashMsg,
  onOpenAddModal,
  onEditUserRestaurant,
  onDeleteUserRestaurant,
  onUnblacklistRestaurant,
}) => {
  const [subPage, setSubPage] = useState<SettingsSubPage>('root');
  const [navDir, setNavDir] = useState<'none' | 'push' | 'pop'>('none');
  const [settingsSearch, setSettingsSearch] = useState('');
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const [showResetSheet, setShowResetSheet] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const focusTimerRef = useRef<number | null>(null);

  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSubPage('root');
      setNavDir('none');
      setSettingsSearch('');
      setActiveControl(null);
      setShowResetSheet(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    };
  }, []);

  const {
    overlayRef,
    panelRef,
    handleRef,
    scrollBodyRef,
    dismissAnimated,
    handleGrabProps,
    bodyPullProps,
  } = useSheetDragDismiss({ onDismiss: onClose, isOpen });

  const resetSheetMount = useAnimatedMount(showResetSheet, 230);

  const touchControl = (key: string, durationMs = 1500) => {
    setActiveControl(key);
    if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => setActiveControl(null), durationMs);
  };

  const navigateSub = (next: SettingsSubPage, highlightKey?: string) => {
    setNavDir(next === 'root' ? 'pop' : 'push');
    setSubPage(next);
    if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
    if (highlightKey) touchControl(highlightKey, 1800);
  };

  const resolvedMode: 'dark' | 'light' | 'jade' =
    profile.glass.mode === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : profile.glass.mode;

  const blacklistedList = useMemo(
    () => allRestaurants.filter((r) => profile.metaById[r.id]?.blacklisted),
    [allRestaurants, profile.metaById]
  );

  const searchMatches = useMemo(() => {
    const q = settingsSearch.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [settingsSearch]);

  if (!isOpen || typeof document === 'undefined') return null;

  const customCfg = profile.customTheme || DEFAULT_CUSTOM_THEME;
  const hasPhoto = Boolean(profile.glass.customBgUrl);
  const isCustomActive = Boolean(hasPhoto || customCfg.enabled);

  const appearanceSummary = hasPhoto
    ? 'Ảnh riêng'
    : customCfg.enabled
    ? 'Màu cá nhân'
    : profile.glass.mode === 'system'
    ? `Hệ thống (${systemDark ? 'Tối' : 'Sáng'})`
    : profile.glass.mode === 'light'
    ? 'Sáng'
    : profile.glass.mode === 'jade'
    ? 'Đen OLED'
    : 'Tối';

  const cardModeLabel =
    profile.glass.cardDensity === 'rich'
      ? 'Chi tiết'
      : profile.glass.cardDensity === 'compact'
      ? 'Tối giản'
      : profile.glass.cardDensity === 'grid'
      ? 'Lưới 2 cột'
      : 'Lưới 3 cột';

  const anchorObj = NINH_BINH_ANCHORS.find((a) => a.id === profile.anchorId);
  const stageClass =
    navDir === 'push' ? 'settings-stage-push' : navDir === 'pop' ? 'settings-stage-pop' : '';

  return createPortal(
    <div ref={overlayRef} className="sheet-overlay" onClick={dismissAnimated}>
      <div
        ref={panelRef}
        className="sheet-panel lg-surface-strong"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '94%', position: 'relative' }}
      >
        {/* Top Grab Handle & Dynamic iOS Navigation Header */}
        <div className="sheet-grab-zone" {...handleGrabProps}>
          <div ref={handleRef} className="sheet-handle" />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '4px 14px 10px',
              borderBottom: '1px solid var(--glass-hairline)',
            }}
          >
            {subPage === 'root' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={17} color="var(--text-secondary)" />
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {PAGE_TITLES.root}
                </h2>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigateSub('root')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  padding: '4px 6px 4px 0',
                  cursor: 'pointer',
                  minWidth: 74,
                }}
              >
                <ChevronLeft size={18} /> Cài đặt
              </button>
            )}

            {subPage !== 'root' && (
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  textAlign: 'center',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {PAGE_TITLES[subPage]}
              </h2>
            )}

            <button
              type="button"
              onClick={dismissAnimated}
              className="lg-pill"
              style={{ width: 34, height: 34, minHeight: 34, padding: 0, flexShrink: 0 }}
              aria-label="Đóng cài đặt"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Root Search Bar */}
        {subPage === 'root' && (
          <div style={{ padding: '10px 16px 4px' }}>
            <div
              className="lg-surface"
              style={{
                borderRadius: 14,
                padding: '3px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: 'none',
              }}
            >
              <Search size={15} color="var(--text-muted)" />
              <input
                type="text"
                data-no-kb-scroll="true"
                className="lg-input"
                style={{
                  minHeight: 34,
                  padding: '4px 2px',
                  background: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                }}
                placeholder="Tìm cài đặt: sáng/tối, mờ kính, Maps, pháo giấy..."
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
              />
              {settingsSearch && (
                <button
                  type="button"
                  className="lg-pill"
                  style={{ minHeight: 24, padding: '1px 8px', fontSize: 11 }}
                  onClick={() => setSettingsSearch('')}
                >
                  Xoá
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pinned Non-Squishing Live Preview for Appearance & Cards Sub-Pages */}
        {(subPage === 'appearance' || subPage === 'cards') && (
          <div className="sheet-grab-zone" {...handleGrabProps} style={{ padding: '10px 16px 4px', flexShrink: 0 }}>
            <CompactLivePreview profile={profile} resolvedMode={resolvedMode} />
          </div>
        )}

        {/* Scrollable Content Stage */}
        <div
          key={subPage}
          ref={scrollBodyRef}
          data-kb-scroll="true"
          className={`settings-scroll-body ${stageClass}`}
          {...bodyPullProps}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '10px 16px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {statusMsg && (
            <div
              className="lg-surface"
              style={{
                padding: '9px 13px',
                borderRadius: 14,
                borderColor: 'var(--accent-border, var(--accent))',
                background: 'var(--accent-soft)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              ✓ {statusMsg}
            </div>
          )}

          {/* ======================== ROOT SETTINGS HUB ======================== */}
          {subPage === 'root' && settingsSearch.trim() !== '' && (
            <div>
              <div className="apple-group-caption">Kết quả khớp “{settingsSearch.trim()}”</div>
              {searchMatches.length === 0 ? (
                <div className="apple-inset-group" style={{ padding: 18, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                  Không tìm thấy mục cài đặt nào phù hợp.
                </div>
              ) : (
                <div className="apple-inset-group">
                  {searchMatches.map((m, idx) => (
                    <React.Fragment key={m.key}>
                      {idx > 0 && <div className="apple-inset-divider" />}
                      <SettingsHubRow
                        icon={<Search size={14} />}
                        title={m.title}
                        subtitle={m.group}
                        onClick={() => navigateSub(m.page, m.key)}
                      />
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}

          {subPage === 'root' && settingsSearch.trim() === '' && (
            <>
              <div>
                <div className="apple-group-caption">Giao diện & Hiển thị</div>
                <div className="apple-inset-group">
                  <SettingsHubRow
                    icon={<Palette size={15} />}
                    title="Hệ thống & Chủ đề"
                    subtitle="Sáng / Tối / Theo máy · Ảnh & màu riêng"
                    valueText={appearanceSummary}
                    onClick={() => navigateSub('appearance')}
                  />
                  <div className="apple-inset-divider" />
                  <SettingsHubRow
                    icon={<Sliders size={15} />}
                    title="Kính mờ & Thẻ quán"
                    subtitle="Live Preview · Tối giản / Chi tiết · Blur"
                    valueText={`${profile.glass.blur}px · ${cardModeLabel}`}
                    onClick={() => navigateSub('cards')}
                  />
                </div>
              </div>

              <div>
                <div className="apple-group-caption">Khám phá, Quay món & Bản đồ</div>
                <div className="apple-inset-group">
                  <SettingsHubRow
                    icon={<Sparkles size={15} />}
                    title="Khẩu vị & Bộ lọc ăn uống"
                    subtitle="Món tủ, loại trừ, ngưỡng sao & ngân sách"
                    valueText={
                      profile.dietary.minRating > 0
                        ? `${profile.dietary.minRating}★+`
                        : `${profile.favoriteTastes.length} món`
                    }
                    onClick={() => navigateSub('discovery')}
                  />
                  <div className="apple-inset-divider" />
                  <SettingsHubRow
                    icon={<Compass size={15} />}
                    title="Vị trí & Chỉ đường"
                    subtitle="Điểm mốc Ninh Bình, GPS & Google / Apple Maps"
                    valueText={profile.glass.mapsApp === 'apple' ? 'Apple Maps' : 'Google Maps'}
                    onClick={() => navigateSub('location')}
                  />
                  <div className="apple-inset-divider" />
                  <SettingsHubRow
                    icon={<Bell size={15} />}
                    title="Cảm giác & Âm thanh"
                    subtitle="Âm thanh, pháo giấy chốt món & pin"
                    valueText={
                      profile.glass.reduceMotion
                        ? 'Tiết kiệm pin'
                        : profile.glass.confettiEnabled ?? true
                        ? 'Sống động'
                        : 'Êm dịu'
                    }
                    onClick={() => navigateSub('feedback')}
                  />
                </div>
              </div>

              <div>
                <div className="apple-group-caption">Dữ liệu & Quán của tôi</div>
                <div className="apple-inset-group">
                  <SettingsHubRow
                    icon={<Store size={15} />}
                    title="Quán của tôi & Quán đã ẩn"
                    subtitle="Vuốt để xoá quán tự thêm · Khôi phục quán ẩn"
                    valueText={`${userRestaurants.length} · ${blacklistedList.length} ẩn`}
                    onClick={() => navigateSub('data')}
                  />
                  <div className="apple-inset-divider" />
                  <SettingsHubRow
                    icon={<Database size={15} />}
                    title="Sao lưu JSON & Đặt lại"
                    subtitle="Xuất / Nhập dữ liệu & khôi phục mặc định"
                    onClick={() => navigateSub('data', 'backup')}
                  />
                </div>
              </div>

              <div>
                <div className="apple-group-caption">Giới thiệu</div>
                <div className="apple-inset-group">
                  <SettingsHubRow
                    icon={<Info size={15} />}
                    title="Về ứng dụng & Tác giả"
                    subtitle={`${APP_AUTHOR.fullName} · @${APP_AUTHOR.nickname}`}
                    valueText={`v${APP_AUTHOR.appVersion}`}
                    onClick={() => navigateSub('about')}
                  />
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    marginTop: 12,
                    lineHeight: 1.5,
                  }}
                >
                  Cố Đô Vị v{APP_AUTHOR.appVersion} · Phát triển bởi {APP_AUTHOR.fullName} ({APP_AUTHOR.nickname})
                </div>
              </div>
            </>
          )}

          {/* ======================== SUBPAGE: APPEARANCE ======================== */}
          {subPage === 'appearance' && (
            <>
              <div>
                <div
                  className="apple-group-caption"
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>Hệ thống · Sáng / Tối</span>
                  {profile.glass.mode === 'system' && (
                    <span style={{ textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}>
                      Theo máy: {systemDark ? 'Tối' : 'Sáng'}
                    </span>
                  )}
                </div>
                <div
                  className={`apple-inset-group apple-focus-block ${
                    activeControl === 'mode' ? 'is-active-control' : ''
                  }`}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 8,
                      padding: '12px 12px 10px',
                    }}
                  >
                    {(
                      [
                        { id: 'system', label: 'Theo hệ thống' },
                        { id: 'dark', label: 'Tối' },
                        { id: 'light', label: 'Sáng' },
                      ] as Array<{ id: GlassMode; label: string }>
                    ).map(({ id, label }) => {
                      const active =
                        id === 'dark'
                          ? profile.glass.mode === 'dark' || profile.glass.mode === 'jade'
                          : profile.glass.mode === id;
                      const screenStyle: React.CSSProperties =
                        id === 'light'
                          ? { background: 'linear-gradient(180deg, #ffffff 0%, #f2f2f7 100%)' }
                          : id === 'dark'
                          ? { background: 'linear-gradient(180deg, #1c1c1e 0%, #0b0b0e 100%)' }
                          : { background: 'linear-gradient(135deg, #f5f5f7 50%, #1c1c1e 50%)' };
                      const barColor =
                        id === 'light'
                          ? 'rgba(28,28,30,0.16)'
                          : id === 'dark'
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(128,128,136,0.34)';
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`apple-mode-tile ${active ? 'active' : ''}`}
                          onClick={() => {
                            onUpdateGlass({ mode: id });
                            touchControl('mode');
                          }}
                          aria-label={`Chế độ ${label}`}
                          aria-pressed={active}
                        >
                          <div className="apple-mode-screen" style={screenStyle}>
                            <div
                              style={{ height: 6, width: '62%', borderRadius: 99, background: barColor }}
                            />
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: id === 'light' ? '#1c1c1e' : '#f5f5f7',
                                alignSelf: 'flex-end',
                              }}
                            >
                              Aa
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: active ? 700 : 500,
                              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                            }}
                          >
                            {label}
                          </span>
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 99,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: active ? 'var(--accent)' : 'transparent',
                              border: active ? 'none' : '1.5px solid var(--glass-border)',
                              color: 'var(--accent-fg, #09090b)',
                            }}
                          >
                            {active && <Check size={11} strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {(profile.glass.mode === 'dark' || profile.glass.mode === 'jade') && (
                    <>
                      <div className="apple-inset-divider" />
                      <div
                        className={`apple-setting-row ${
                          activeControl === 'oled' ? 'is-active-control' : ''
                        }`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span className="apple-row-icon">
                            <Moon size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Nền đen thuần OLED</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Tối sâu tuyệt đối khi dùng ban đêm
                            </div>
                          </div>
                        </div>
                        <AppleSwitch
                          checked={profile.glass.mode === 'jade'}
                          label="Nền đen thuần OLED"
                          onToggle={() => {
                            onUpdateGlass({ mode: profile.glass.mode === 'jade' ? 'dark' : 'jade' });
                            touchControl('oled');
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <div
                  className="apple-group-caption"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>Người dùng tuỳ chỉnh</span>
                  {isCustomActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        onChangeProfile((p) => ({
                          ...p,
                          glass: { ...p.glass, customBgUrl: null },
                          customTheme: { ...(p.customTheme || DEFAULT_CUSTOM_THEME), enabled: false },
                        }));
                        onFlashMsg('Đã trở về giao diện đơn sắc mặc định theo Hệ thống.');
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        textTransform: 'none',
                      }}
                    >
                      <RotateCcw size={11} /> Về hệ thống
                    </button>
                  ) : (
                    <span style={{ textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}>
                      Đang theo hệ thống
                    </span>
                  )}
                </div>

                <div className="apple-inset-group">
                  <label
                    className={`apple-setting-row ${
                      activeControl === 'custom-photo' ? 'is-active-control' : ''
                    }`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span className="apple-row-icon">
                        {hasPhoto ? (
                          <img
                            src={profile.glass.customBgUrl!}
                            alt="Ảnh nền riêng"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }}
                          />
                        ) : (
                          <FileUp size={15} />
                        )}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                          {hasPhoto ? 'Đổi ảnh nền của bạn' : 'Tải ảnh của bạn'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {hasPhoto ? 'Tự thiết kế màu theo ảnh' : 'Tự trích bảng màu hài hoà'}
                        </div>
                      </div>
                    </div>
                    <span className="lg-pill" style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}>
                      {hasPhoto ? 'Đổi ảnh' : 'Chọn ảnh'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        onUploadWallpaper(e);
                        touchControl('custom-photo', 2200);
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <div className="apple-inset-divider" />

                  <div
                    className={`apple-setting-row ${
                      activeControl === 'custom-color' ? 'is-active-control' : ''
                    }`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span className="apple-row-icon">
                        <Palette size={15} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Tự chỉnh màu</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {customCfg.enabled ? 'Đang bật màu nhấn riêng' : 'Mặc định giữ nét đơn sắc Apple'}
                        </div>
                      </div>
                    </div>
                    <AppleSwitch
                      checked={customCfg.enabled}
                      label="Tự chỉnh màu"
                      onToggle={() => {
                        onUpdateCustomTheme({ enabled: !customCfg.enabled });
                        touchControl('custom-color');
                      }}
                    />
                  </div>

                  {isCustomActive && (
                    <>
                      <div className="apple-inset-divider" />
                      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {hasPhoto && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <button
                              type="button"
                              className="lg-pill"
                              style={{ minHeight: 27, padding: '2px 10px', fontSize: 11 }}
                              onClick={() => {
                                onReExtractBg();
                                touchControl('palette');
                              }}
                            >
                              <Sparkles size={11} /> Trích xuất lại từ ảnh
                            </button>
                            <button
                              type="button"
                              className="lg-pill"
                              style={{ minHeight: 27, padding: '2px 10px', fontSize: 11, color: '#ef4444' }}
                              onClick={() => {
                                onChangeProfile((p) => ({
                                  ...p,
                                  glass: { ...p.glass, customBgUrl: null },
                                }));
                                onFlashMsg('Đã gỡ ảnh nền riêng.');
                              }}
                            >
                              <Trash2 size={11} /> Gỡ ảnh
                            </button>
                          </div>
                        )}

                        <div
                          className={`apple-focus-block ${
                            activeControl === 'palette' ? 'is-active-control' : ''
                          }`}
                          style={{ padding: 6 }}
                        >
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>
                            {hasPhoto ? 'Bảng màu tự lấy từ ảnh' : 'Chấm tròn màu nhấn gợi ý'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                            {(hasPhoto && customCfg.extractedPalette.length > 0
                              ? customCfg.extractedPalette
                              : DEFAULT_CUSTOM_THEME.extractedPalette
                            ).map((hex) => {
                              const picked = customCfg.accent.toLowerCase() === hex.toLowerCase();
                              return (
                                <button
                                  key={hex}
                                  type="button"
                                  onClick={() => {
                                    onUpdateCustomTheme({ accent: hex, enabled: true });
                                    touchControl('palette');
                                  }}
                                  aria-label={`Chọn màu ${hex}`}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 99,
                                    background: hex,
                                    border: picked ? '2.5px solid #fff' : '1px solid var(--glass-border)',
                                    boxShadow: picked ? `0 0 0 2px ${hex}` : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                  }}
                                >
                                  {picked && <Check size={13} color="#fff" strokeWidth={3} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                          <label className="lg-pill" style={{ justifyContent: 'space-between', padding: '6px 10px', width: '100%', cursor: 'pointer' }}>
                            <span style={{ fontSize: 11.5 }}>Màu nhấn chính</span>
                            <input
                              type="color"
                              value={customCfg.accent}
                              onChange={(e) => onUpdateCustomTheme({ accent: e.target.value, enabled: true })}
                              style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                            />
                          </label>
                          <label className="lg-pill" style={{ justifyContent: 'space-between', padding: '6px 10px', width: '100%', cursor: 'pointer' }}>
                            <span style={{ fontSize: 11.5 }}>Màu nhấn phụ</span>
                            <input
                              type="color"
                              value={customCfg.accentSecondary}
                              onChange={(e) => onUpdateCustomTheme({ accentSecondary: e.target.value, enabled: true })}
                              style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                            />
                          </label>
                        </div>

                        {hasPhoto && (
                          <div
                            className={`apple-focus-block ${
                              activeControl === 'scrim' ? 'is-active-control' : ''
                            }`}
                            style={{ padding: 6 }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <span>Độ phủ dịu ảnh nền</span>
                              <span className="apple-value-badge">
                                {Math.round(customCfg.scrimStrength * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.15}
                              max={0.8}
                              step={0.05}
                              className="lg-slider"
                              value={customCfg.scrimStrength}
                              onPointerDown={() => touchControl('scrim', 2200)}
                              onChange={(e) => {
                                onUpdateCustomTheme({ scrimStrength: Number(e.target.value), enabled: true });
                                touchControl('scrim', 1800);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ======================== SUBPAGE: CARDS & GLASS ======================== */}
          {subPage === 'cards' && (
            <>
              <div>
                <div className="apple-group-caption">Chất liệu kính lỏng (Liquid Glass)</div>
                <div className="apple-inset-group" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    className={`apple-focus-block ${activeControl === 'blur' ? 'is-active-control' : ''}`}
                    style={{ padding: '8px 10px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
                      <span>Độ mờ kính (Glass Blur)</span>
                      <span className="apple-value-badge">{profile.glass.blur}px</span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={36}
                      step={1}
                      className="lg-slider"
                      value={profile.glass.blur}
                      onPointerDown={() => touchControl('blur', 2200)}
                      onChange={(e) => {
                        onUpdateGlass({ blur: Number(e.target.value) });
                        touchControl('blur', 1800);
                      }}
                    />
                  </div>

                  <div
                    className={`apple-focus-block ${activeControl === 'opacity' ? 'is-active-control' : ''}`}
                    style={{ padding: '8px 10px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
                      <span>Độ đặc nền kính (Opacity)</span>
                      <span className="apple-value-badge">{Math.round(profile.glass.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.12}
                      max={0.58}
                      step={0.02}
                      className="lg-slider"
                      value={profile.glass.opacity}
                      onPointerDown={() => touchControl('opacity', 2200)}
                      onChange={(e) => {
                        onUpdateGlass({ opacity: Number(e.target.value) });
                        touchControl('opacity', 1800);
                      }}
                    />
                  </div>

                  <div
                    className={`apple-focus-block ${activeControl === 'rim' ? 'is-active-control' : ''}`}
                    style={{ padding: '8px 10px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
                      <span>Ánh sáng viền khúc xạ (Specular Rim)</span>
                      <span className="apple-value-badge">{Math.round(profile.glass.rimGlow * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.15}
                      max={0.95}
                      step={0.05}
                      className="lg-slider"
                      value={profile.glass.rimGlow}
                      onPointerDown={() => touchControl('rim', 2200)}
                      onChange={(e) => {
                        onUpdateGlass({ rimGlow: Number(e.target.value) });
                        touchControl('rim', 1800);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="apple-group-caption">Thông tin & Kiểu thẻ quán</div>
                <div className="apple-inset-group">
                  <div
                    className={`apple-focus-block ${activeControl === 'density' ? 'is-active-control' : ''}`}
                    style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                        <Layers size={15} color="var(--text-secondary)" /> Phong cách thẻ
                      </span>
                      <span className="apple-value-badge">{cardModeLabel}</span>
                    </div>

                    <div className="apple-segmented" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <button
                        type="button"
                        className={`apple-segment-btn ${
                          profile.glass.cardDensity === 'rich' ? 'active' : ''
                        }`}
                        onClick={() => {
                          onUpdateGlass({ cardDensity: 'rich' });
                          touchControl('density');
                        }}
                      >
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        className={`apple-segment-btn ${
                          profile.glass.cardDensity === 'compact' ? 'active' : ''
                        }`}
                        onClick={() => {
                          onUpdateGlass({ cardDensity: 'compact' });
                          touchControl('density');
                        }}
                      >
                        Tối giản
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                      {(
                        [
                          ['rich', 'Thẻ lớn'],
                          ['compact', 'Gọn'],
                          ['grid', 'Lưới 2'],
                          ['dense', 'Lưới 3'],
                        ] as Array<[CardDensity, string]>
                      ).map(([d, label]) => (
                        <button
                          key={d}
                          type="button"
                          className={`lg-pill ${profile.glass.cardDensity === d ? 'active' : ''}`}
                          style={{ minHeight: 30, fontSize: 11.5, padding: '4px 4px', width: '100%' }}
                          onClick={() => {
                            onUpdateGlass({ cardDensity: d });
                            touchControl('density');
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(
                    [
                      {
                        key: 'showDistance',
                        label: 'Hiện khoảng cách (km)',
                        checked: profile.glass.showDistance,
                        onToggle: () => onUpdateGlass({ showDistance: !profile.glass.showDistance }),
                      },
                      {
                        key: 'showRating',
                        label: 'Hiện điểm đánh giá sao ★',
                        checked: profile.glass.showRating ?? true,
                        onToggle: () => onUpdateGlass({ showRating: !(profile.glass.showRating ?? true) }),
                      },
                      {
                        key: 'showPrice',
                        label: 'Hiện mức giá món ăn',
                        checked: profile.glass.showPrice ?? true,
                        onToggle: () => onUpdateGlass({ showPrice: !(profile.glass.showPrice ?? true) }),
                      },
                      {
                        key: 'showOpenStatus',
                        label: 'Hiện trạng thái giờ mở cửa',
                        checked: profile.glass.showOpenStatus ?? true,
                        onToggle: () =>
                          onUpdateGlass({ showOpenStatus: !(profile.glass.showOpenStatus ?? true) }),
                      },
                      {
                        key: 'showRatingBars',
                        label: 'Thanh tỷ lệ chi tiết 5★',
                        checked: profile.glass.showRatingBars,
                        onToggle: () => onUpdateGlass({ showRatingBars: !profile.glass.showRatingBars }),
                      },
                      {
                        key: 'dynamicSheen',
                        label: 'Ánh kính lướt trên thẻ',
                        checked: profile.glass.dynamicSheen,
                        onToggle: () => onUpdateGlass({ dynamicSheen: !profile.glass.dynamicSheen }),
                      },
                      {
                        key: 'fontScale',
                        label: 'Cỡ chữ lớn dễ đọc',
                        checked: profile.glass.fontScale === 'large',
                        onToggle: () =>
                          onUpdateGlass({
                            fontScale: profile.glass.fontScale === 'large' ? 'normal' : 'large',
                          }),
                      },
                    ] as Array<{ key: string; label: string; checked: boolean; onToggle: () => void }>
                  ).map((item) => (
                    <React.Fragment key={item.key}>
                      <div className="apple-inset-divider" />
                      <div
                        className={`apple-setting-row ${
                          activeControl === item.key ? 'is-active-control' : ''
                        }`}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{item.label}</span>
                        <AppleSwitch
                          checked={item.checked}
                          label={item.label}
                          onToggle={() => {
                            item.onToggle();
                            touchControl(item.key);
                          }}
                        />
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ======================== SUBPAGE: DISCOVERY & TASTE ======================== */}
          {subPage === 'discovery' && (
            <>
              <div>
                <div className="apple-group-caption">Món tủ yêu thích</div>
                <div
                  className={`apple-inset-group apple-focus-block ${
                    activeControl === 'tastes' ? 'is-active-control' : ''
                  }`}
                  style={{ padding: 12 }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
                    {TASTE_OPTIONS.map((t) => {
                      const active = profile.favoriteTastes.includes(t.key);
                      return (
                        <button
                          key={t.key}
                          type="button"
                          className={`lg-pill ${active ? 'active' : ''}`}
                          style={{
                            justifyContent: 'flex-start',
                            padding: '8px 10px',
                            height: 'auto',
                            textAlign: 'left',
                            minWidth: 0,
                            width: '100%',
                          }}
                          onClick={() => {
                            onToggleTaste(t.key);
                            touchControl('tastes');
                          }}
                        >
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{t.emoji}</span>
                          <span style={{ fontSize: 11.5, whiteSpace: 'normal', lineHeight: 1.25 }}>
                            {t.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <div className="apple-group-caption">Quy tắc loại trừ & Ưu tiên</div>
                <div className="apple-inset-group">
                  {[
                    { key: 'avoidTempClosed', label: 'Tránh quán tạm đóng cửa' },
                    { key: 'onlyOpenNow', label: 'Chỉ hiện quán đang mở' },
                    { key: 'vegetarianFocus', label: 'Ưu tiên món Chay' },
                    { key: 'noGoat', label: 'Không ăn thịt dê' },
                    { key: 'noSeafood', label: 'Không ăn hải sản' },
                    { key: 'accessibleOnly', label: 'Có lối đi xe lăn' },
                  ].map((item, idx) => {
                    const k = item.key as keyof UserProfile['dietary'];
                    const val = Boolean(profile.dietary[k]);
                    return (
                      <React.Fragment key={item.key}>
                        {idx > 0 && <div className="apple-inset-divider" />}
                        <div
                          className={`apple-setting-row ${
                            activeControl === item.key ? 'is-active-control' : ''
                          }`}
                        >
                          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{item.label}</span>
                          <AppleSwitch
                            checked={val}
                            label={item.label}
                            onToggle={() => {
                              onUpdateDietary({ [k]: !val });
                              touchControl(item.key);
                            }}
                          />
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="apple-group-caption">Ngưỡng đánh giá & Ngân sách</div>
                <div
                  className={`apple-inset-group apple-focus-block ${
                    activeControl === 'minRating' ? 'is-active-control' : ''
                  }`}
                  style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, marginBottom: 7 }}>
                      <span>Đánh giá tối thiểu</span>
                      <span className="apple-value-badge">
                        {profile.dietary.minRating === 0 ? 'Tất cả' : `${profile.dietary.minRating}★+`}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                      {[0, 3.5, 4.0, 4.5].map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`lg-pill ${profile.dietary.minRating === r ? 'active' : ''}`}
                          style={{ fontSize: 12, padding: '6px 4px', minWidth: 0, width: '100%' }}
                          onClick={() => {
                            onUpdateDietary({ minRating: r });
                            touchControl('minRating');
                          }}
                        >
                          {r === 0 ? 'Tất cả' : `${r}★+`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 7 }}>Ngân sách ưu tiên</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(
                        [
                          ['all', 'Mọi mức giá'],
                          ['binh-dan', 'Bình dân'],
                          ['vua-phai', 'Vừa phải'],
                          ['tiep-khach', 'Tiếp khách'],
                        ] as Array<[BudgetLevel, string]>
                      ).map(([b, lbl]) => (
                        <button
                          key={b}
                          type="button"
                          className={`lg-pill ${profile.budget === b ? 'active' : ''}`}
                          style={{ fontSize: 12 }}
                          onClick={() => {
                            onChangeProfile((p) => ({ ...p, budget: b }));
                            touchControl('minRating');
                          }}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 7 }}>Bạn đồng hành mặc định</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(
                        [
                          ['solo', 'Một mình'],
                          ['couple', 'Cặp đôi'],
                          ['family', 'Gia đình'],
                          ['friends', 'Nhóm bạn'],
                          ['guests', 'Tiếp khách'],
                        ] as Array<[CompanionType, string]>
                      ).map(([c, lbl]) => (
                        <button
                          key={c}
                          type="button"
                          className={`lg-pill ${profile.defaultCompanion === c ? 'active' : ''}`}
                          style={{ fontSize: 12 }}
                          onClick={() => {
                            onChangeProfile((p) => ({ ...p, defaultCompanion: c }));
                            touchControl('minRating');
                          }}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ======================== SUBPAGE: LOCATION & MAPS ======================== */}
          {subPage === 'location' && (
            <>
              <div>
                <div className="apple-group-caption">Ứng dụng chỉ đường mặc định</div>
                <div
                  className={`apple-inset-group apple-focus-block ${
                    activeControl === 'mapsApp' ? 'is-active-control' : ''
                  }`}
                >
                  {(
                    [
                      { id: 'google', name: 'Google Maps', desc: 'Mở chỉ đường & đánh giá trực tiếp' },
                      { id: 'apple', name: 'Apple Maps', desc: 'Tối ưu mượt trên iPhone & iPad' },
                    ] as Array<{ id: MapsProvider; name: string; desc: string }>
                  ).map((item, idx) => {
                    const active = (profile.glass.mapsApp || 'google') === item.id;
                    return (
                      <React.Fragment key={item.id}>
                        {idx > 0 && <div className="apple-inset-divider" />}
                        <button
                          type="button"
                          className="apple-setting-row"
                          onClick={() => {
                            onUpdateGlass({ mapsApp: item.id });
                            touchControl('mapsApp');
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="apple-row-icon">
                              <Compass size={15} />
                            </span>
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: active ? 700 : 600 }}>{item.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.desc}</div>
                            </div>
                          </div>
                          {active && <Check size={16} color="var(--accent)" strokeWidth={2.6} />}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              <div>
                <div
                  className="apple-group-caption"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>Điểm mốc xuất phát ({anchorObj?.shortName || 'Ninh Bình'})</span>
                  <button
                    type="button"
                    onClick={() => {
                      onLocateGps();
                      touchControl('anchor');
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      textTransform: 'none',
                    }}
                  >
                    <LocateFixed size={12} /> Dùng GPS
                  </button>
                </div>

                <div
                  className={`apple-inset-group apple-focus-block ${
                    activeControl === 'anchor' ? 'is-active-control' : ''
                  }`}
                >
                  {NINH_BINH_ANCHORS.map((a, idx) => {
                    const active = profile.anchorId === a.id;
                    return (
                      <React.Fragment key={a.id}>
                        {idx > 0 && <div className="apple-inset-divider" />}
                        <button
                          type="button"
                          className="apple-setting-row"
                          onClick={() => {
                            onChangeProfile((p) => ({ ...p, anchorId: a.id }));
                            touchControl('anchor');
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: active ? 600 : 500 }}>
                            <MapPin size={14} color="var(--text-secondary)" />
                            {a.name}
                          </span>
                          {active && <Check size={16} color="var(--accent)" strokeWidth={2.5} />}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ======================== SUBPAGE: FEEL, SOUND & BATTERY ======================== */}
          {subPage === 'feedback' && (
            <>
              <div>
                <div className="apple-group-caption">Âm thanh & Hiệu ứng chốt món</div>
                <div className="apple-inset-group">
                  <div
                    className={`apple-setting-row ${
                      activeControl === 'sound' ? 'is-active-control' : ''
                    }`}
                  >
                    <div style={{ minWidth: 0, paddingRight: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>Âm thanh hiệu ứng</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Tiếng chạm nhẹ & chuông tinh thể khi chốt quán
                      </div>
                    </div>
                    <AppleSwitch
                      checked={profile.glass.soundEnabled ?? true}
                      label="Âm thanh hiệu ứng"
                      onToggle={() => {
                        const next = !(profile.glass.soundEnabled ?? true);
                        onUpdateGlass({ soundEnabled: next });
                        if (next) playChimeSuccess(true);
                        touchControl('sound');
                      }}
                    />
                  </div>

                  <div className="apple-inset-divider" />

                  <div
                    className={`apple-setting-row ${
                      activeControl === 'confetti' ? 'is-active-control' : ''
                    }`}
                  >
                    <div style={{ minWidth: 0, paddingRight: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>Pháo giấy khi chốt món</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Bung pháo giấy nhẹ khi vòng quay chọn ra quán
                      </div>
                    </div>
                    <AppleSwitch
                      checked={profile.glass.confettiEnabled ?? true}
                      label="Pháo giấy khi chốt món"
                      onToggle={() => {
                        const next = !(profile.glass.confettiEnabled ?? true);
                        onUpdateGlass({ confettiEnabled: next });
                        if (next && !profile.glass.reduceMotion) {
                          spawnCelebrationConfetti(panelRef.current);
                        }
                        touchControl('confetti');
                      }}
                    />
                  </div>

                  <div className="apple-inset-divider" />

                  <div
                    className={`apple-setting-row ${
                      activeControl === 'reduceMotion' ? 'is-active-control' : ''
                    }`}
                  >
                    <div style={{ minWidth: 0, paddingRight: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>Giảm chuyển động</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Tiết kiệm pin & mượt hơn trên thiết bị cũ
                      </div>
                    </div>
                    <AppleSwitch
                      checked={profile.glass.reduceMotion}
                      label="Giảm chuyển động"
                      onToggle={() => {
                        onUpdateGlass({ reduceMotion: !profile.glass.reduceMotion });
                        touchControl('reduceMotion');
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ======================== SUBPAGE: DATA & MY RESTAURANTS ======================== */}
          {subPage === 'data' && (
            <>
              <div>
                <div
                  className="apple-group-caption"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>Quán tôi tự thêm ({userRestaurants.length})</span>
                  <button
                    type="button"
                    onClick={() => onOpenAddModal()}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      textTransform: 'none',
                    }}
                  >
                    <Plus size={12} /> Thêm mới
                  </button>
                </div>

                <div
                  className={`apple-inset-group apple-focus-block ${
                    activeControl === 'userPlaces' ? 'is-active-control' : ''
                  }`}
                >
                  {userRestaurants.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      Bạn chưa tự thêm quán nào. Chạm “Thêm mới” để lưu quán ruột của riêng bạn.
                    </div>
                  ) : (
                    userRestaurants.map((r, idx) => (
                      <React.Fragment key={r.id}>
                        {idx > 0 && <div className="apple-inset-divider" />}
                        <SwipeToDeleteRow
                          restaurant={r}
                          onEdit={(item) => onEditUserRestaurant?.(item)}
                          onDelete={(id) => onDeleteUserRestaurant?.(id)}
                        />
                      </React.Fragment>
                    ))
                  )}
                </div>
                {userRestaurants.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '5px 8px 0' }}>
                    Mẹo: Chạm vào quán để sửa nhanh hoặc vuốt sang trái để xoá kiểu iOS.
                  </div>
                )}
              </div>

              <div>
                <div className="apple-group-caption">Quán đã ẩn ({blacklistedList.length})</div>
                <div
                  className={`apple-inset-group apple-focus-block ${
                    activeControl === 'blacklisted' ? 'is-active-control' : ''
                  }`}
                >
                  {blacklistedList.length === 0 ? (
                    <div style={{ padding: 14, textAlign: 'center', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      Không có quán nào đang bị ẩn khỏi gợi ý.
                    </div>
                  ) : (
                    blacklistedList.map((r, idx) => (
                      <React.Fragment key={r.id}>
                        {idx > 0 && <div className="apple-inset-divider" />}
                        <div className="apple-setting-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                            <Ban size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: 13.5,
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {r.title}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="lg-pill"
                            style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5, flexShrink: 0 }}
                            onClick={() => onUnblacklistRestaurant?.(r.id)}
                          >
                            <RotateCcw size={11} /> Khôi phục
                          </button>
                        </div>
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="apple-group-caption">Sao lưu & Đặt lại mặc định</div>
                <div
                  className={`apple-inset-group apple-focus-block ${
                    activeControl === 'backup' ? 'is-active-control' : ''
                  }`}
                >
                  <button type="button" className="apple-setting-row" onClick={onExportBackup}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="apple-row-icon">
                        <Download size={15} />
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>Xuất file sao lưu JSON</span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tải về</span>
                  </button>

                  <div className="apple-inset-divider" />

                  <label className="apple-setting-row">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="apple-row-icon">
                        <Upload size={15} />
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>Nhập file JSON sao lưu</span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Chọn file</span>
                    <input type="file" accept=".json,application/json" onChange={onImportBackup} style={{ display: 'none' }} />
                  </label>

                  <div className="apple-inset-divider" />

                  <button
                    type="button"
                    className="apple-setting-row"
                    style={{ justifyContent: 'center', color: '#ef4444', fontWeight: 600, fontSize: 13.5 }}
                    onClick={() => setShowResetSheet(true)}
                  >
                    <RotateCcw size={14} /> Đặt lại toàn bộ cấu hình mặc định
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ======================== SUBPAGE: ABOUT / AUTHOR ======================== */}
          {subPage === 'about' && (
            <>
              <div>
                <div className="apple-inset-group" style={{ padding: '18px 16px', textAlign: 'center' }}>
                  <div
                    className="lg-surface-strong"
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 16,
                      margin: '0 auto 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                    }}
                  >
                    🪷
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>
                    Cố Đô Vị — Chọn Món Ninh Bình
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>
                    Khám phá đặc sản, quay vòng chọn món & lưu bộ sưu tập quán ăn tại Ninh Bình trên Cloud.
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: 10,
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'var(--pill-bg)',
                      border: '1px solid var(--glass-hairline)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Phiên bản {APP_AUTHOR.appVersion}
                  </div>
                </div>
              </div>

              <div>
                <div className="apple-group-caption">Tác giả phát triển</div>
                <div className="apple-inset-group">
                  <div className="apple-setting-row" style={{ cursor: 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                      <span
                        className="apple-row-icon"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 11,
                          fontSize: 15,
                          fontWeight: 800,
                        }}
                      >
                        <User size={16} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700 }}>{APP_AUTHOR.fullName}</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '1px 7px',
                              borderRadius: 999,
                              background: 'var(--pill-bg)',
                              border: '1px solid var(--glass-hairline)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            @{APP_AUTHOR.nickname}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Người xây dựng & phát triển ứng dụng Cố Đô Vị
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="apple-group-caption">Liên hệ & Góp ý quán</div>
                <div className="apple-inset-group">
                  <a
                    href={APP_AUTHOR.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apple-setting-row"
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                      <span className="apple-row-icon">
                        <ExternalLink size={15} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Facebook</div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {APP_AUTHOR.facebookLabel}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Mở link</span>
                  </a>

                  <div className="apple-inset-divider" />

                  <div className="apple-setting-row" style={{ gap: 10 }}>
                    <a
                      href={`mailto:${APP_AUTHOR.email}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        minWidth: 0,
                        flex: 1,
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <span className="apple-row-icon">
                        <Mail size={15} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Email</div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {APP_AUTHOR.email}
                        </div>
                      </div>
                    </a>
                    <button
                      type="button"
                      className="lg-pill"
                      style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5, flexShrink: 0 }}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(APP_AUTHOR.email);
                          setCopiedEmail(true);
                          onFlashMsg(`Đã sao chép email ${APP_AUTHOR.email}`);
                          window.setTimeout(() => setCopiedEmail(false), 2000);
                        } catch {
                          onFlashMsg(`Email: ${APP_AUTHOR.email}`);
                        }
                      }}
                    >
                      {copiedEmail ? <Check size={12} /> : <Copy size={12} />}
                      {copiedEmail ? 'Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Authentic iOS Bottom Confirmation Action Sheet */}
        {resetSheetMount.mounted && (
          <div
            className={`ios-action-sheet-overlay ${resetSheetMount.closing ? 'is-closing' : ''}`}
            onClick={() => setShowResetSheet(false)}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ios-action-sheet-card">
                <div style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid var(--glass-hairline)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Đặt lại toàn bộ cài đặt mặc định?</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                    Giao diện, chủ đề màu và bộ lọc sẽ trở về mặc định Apple ban đầu. Quán ăn bạn tự thêm vẫn được giữ nguyên.
                  </div>
                </div>
                <button
                  type="button"
                  className="ios-action-sheet-btn"
                  style={{ color: '#ef4444', fontWeight: 700 }}
                  onClick={() => {
                    onResetProfile();
                    setShowResetSheet(false);
                    onFlashMsg('Đã khôi phục toàn bộ cài đặt về mặc định Apple.');
                  }}
                >
                  Đặt lại ngay
                </button>
              </div>

              <div className="ios-action-sheet-card">
                <button
                  type="button"
                  className="ios-action-sheet-btn"
                  onClick={() => setShowResetSheet(false)}
                >
                  Huỷ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.querySelector('.phone-shell') || document.body
  );
};
