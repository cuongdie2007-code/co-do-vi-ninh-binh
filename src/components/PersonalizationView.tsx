import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Cloud,
  Dices,
  FileUp,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import {
  CustomThemeConfig,
  Restaurant,
  TasteKey,
  UserProfile,
} from '../types/restaurant';
import {
  DEFAULT_CUSTOM_THEME,
  FUN_FOOD_NICKNAMES,
} from '../data/themes';
import {
  compressImageFileToDataUrl,
  extractThemeFromImage,
} from '../utils/restaurantUtils';
import { lazy as reactLazy, Suspense as ReactSuspense } from 'react';
import { deleteAccountAndCloudData } from '../firebase/cloudSync';
const SettingsModal = reactLazy(() => import('./settings/SettingsModal').then(m => ({ default: m.SettingsModal })));

interface PersonalizationViewProps {
  profile: UserProfile;
  userRestaurants: Restaurant[];
  allRestaurants?: Restaurant[];
  allRestaurantsCount: number;
  isSettingsOpen: boolean;
  authUser?: {
    uid: string;
    email: string | null;
    isAnonymous: boolean;
    displayName: string | null;
  } | null;
  cloudSyncState?: 'idle' | 'syncing' | 'synced' | 'offline';
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onChangeProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onImportBackup: (data: { profile?: UserProfile; userRestaurants?: Restaurant[] }) => void;
  onResetProfile: () => void;
  onOpenAddModal: () => void;
  onEditUserRestaurant?: (r: Restaurant) => void;
  onDeleteUserRestaurant?: (id: string) => void;
  onUnblacklistRestaurant?: (id: string) => void;
  onSignOut?: () => Promise<void>;
  onUpgradeGuestEmail?: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<string | null>;
  onUpgradeGuestGoogle?: () => Promise<string | null>;
}

const AVATAR_CHOICES = ['🪷', '⛰️', '🍜', '🐐', '🏮', '🛶', '🍱', '👑'];

export const PersonalizationView: React.FC<PersonalizationViewProps> = ({
  profile,
  userRestaurants,
  allRestaurants = [],
  allRestaurantsCount,
  isSettingsOpen,
  authUser,
  cloudSyncState = 'idle',
  onOpenSettings,
  onCloseSettings,
  onChangeProfile,
  onImportBackup,
  onResetProfile,
  onOpenAddModal,
  onEditUserRestaurant,
  onDeleteUserRestaurant,
  onUnblacklistRestaurant,
  onSignOut,
  onUpgradeGuestEmail,
  onUpgradeGuestGoogle,
}) => {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(profile.displayName);
  const [badgeDraft, setBadgeDraft] = useState(profile.badgeTitle);
  const [diceSpin, setDiceSpin] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [upEmail, setUpEmail] = useState('');
  const [upPass, setUpPass] = useState('');
  const [upError, setUpError] = useState<string | null>(null);
  const [authActionBusy, setAuthActionBusy] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [confirmDeleteAcc, setConfirmDeleteAcc] = useState(false);
  const [deleteAccError, setDeleteAccError] = useState<string | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const msgTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setNameDraft(profile.displayName);
  }, [profile.displayName]);

  useEffect(() => {
    setBadgeDraft(profile.badgeTitle);
  }, [profile.badgeTitle]);

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
      if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current);
    };
  }, []);

  const flashMsg = (msg: string) => {
    setStatusMsg(msg);
    if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current);
    msgTimerRef.current = window.setTimeout(() => setStatusMsg(null), 2600);
  };

  const syncProfileText = (nextName: string, nextBadge: string) => {
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => {
      onChangeProfile((p) => ({
        ...p,
        displayName: nextName,
        badgeTitle: nextBadge,
      }));
    }, 280);
  };

  const handleRollNickname = () => {
    setDiceSpin(true);
    window.setTimeout(() => setDiceSpin(false), 380);
    const pool = FUN_FOOD_NICKNAMES.filter((n) => n !== badgeDraft);
    const pick = pool[Math.floor(Math.random() * pool.length)] || FUN_FOOD_NICKNAMES[0];
    setBadgeDraft(pick);
    onChangeProfile((p) => ({ ...p, badgeTitle: pick }));
  };

  const handleUploadAvatarPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await compressImageFileToDataUrl(file, 480);
      onChangeProfile((p) => ({ ...p, avatarPhotoUrl: url }));
      flashMsg('Đã cập nhật ảnh đại diện cá nhân!');
    } catch {
      flashMsg('Không đọc được ảnh đại diện này.');
    }
  };

  const updateGlass = (patch: Partial<UserProfile['glass']>) => {
    onChangeProfile((p) => ({ ...p, glass: { ...p.glass, ...patch } }));
  };

  const updateDietary = (patch: Partial<UserProfile['dietary']>) => {
    onChangeProfile((p) => ({ ...p, dietary: { ...p.dietary, ...patch } }));
  };

  const toggleTaste = (key: TasteKey) => {
    onChangeProfile((p) => ({
      ...p,
      favoriteTastes: p.favoriteTastes.includes(key)
        ? p.favoriteTastes.filter((k) => k !== key)
        : [...p.favoriteTastes, key],
    }));
  };

  const updateCustomTheme = (patch: Partial<CustomThemeConfig>) => {
    onChangeProfile((p) => ({
      ...p,
      customTheme: {
        ...(p.customTheme || DEFAULT_CUSTOM_THEME),
        ...patch,
      },
    }));
  };

  const handleUploadCustomWallpaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await compressImageFileToDataUrl(file, 1280);
      const extracted = await extractThemeFromImage(url);
      onChangeProfile((p) => ({
        ...p,
        glass: { ...p.glass, customBgUrl: url },
        customTheme: {
          ...(p.customTheme || DEFAULT_CUSTOM_THEME),
          ...extracted,
          enabled: true,
        },
      }));
      flashMsg('Đã tải ảnh & tự thiết kế màu chủ đề theo ảnh của bạn!');
    } catch {
      flashMsg('Không đọc được ảnh nền này.');
    }
  };

  const handleReExtractFromCurrentBg = async () => {
    const targetSrc = profile.glass.customBgUrl;
    if (!targetSrc) return;
    try {
      const extracted = await extractThemeFromImage(targetSrc);
      updateCustomTheme({ ...extracted, enabled: true });
      flashMsg('Đã tự trích xuất lại bảng màu hài hoà theo ảnh!');
    } catch {
      flashMsg('Không thể trích xuất màu từ ảnh.');
    }
  };

  const handleLocateGps = () => {
    if (!navigator.geolocation) {
      flashMsg('Trình duyệt không hỗ trợ GPS.');
      return;
    }
    flashMsg('Đang xác định vị trí của bạn tại Ninh Bình...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChangeProfile((p) => ({
          ...p,
          anchorId: 'gps-thuc-te',
          customCoords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }));
        flashMsg('Đã cập nhật khoảng cách theo GPS hiện tại!');
      },
      () => flashMsg('Không thể truy cập GPS — hãy chọn điểm mốc Ninh Bình bên dưới.'),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleExportAll = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Cố Đô Vị — Ninh Bình Liquid Glass',
      profile,
      userRestaurants,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codovi-ninhbinh-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flashMsg('Đã xuất file sao lưu JSON!');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed)) {
          onImportBackup({ userRestaurants: parsed });
          flashMsg(`Đã nhập ${parsed.length} quán từ file JSON!`);
        } else {
          onImportBackup({
            profile: parsed.profile,
            userRestaurants: parsed.userRestaurants,
          });
          flashMsg('Đã khôi phục toàn bộ cấu hình cá nhân & quán ăn!');
        }
      } catch {
        flashMsg('File sao lưu không hợp lệ.');
      }
    };
    reader.readAsText(file);
  };

  const favCount = useMemo(
    () => Object.values(profile.metaById).filter((m) => m.favorite).length,
    [profile.metaById]
  );
  const visitedCount = useMemo(
    () => Object.values(profile.metaById).filter((m) => m.visited).length,
    [profile.metaById]
  );
  const wishlistCount = useMemo(
    () => Object.values(profile.metaById).filter((m) => m.wishlist).length,
    [profile.metaById]
  );

  const sampleNicknames = useMemo(() => FUN_FOOD_NICKNAMES.slice(0, 12), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {statusMsg && !isSettingsOpen && (
        <div
          className="lg-surface-strong"
          style={{
            padding: '10px 14px',
            borderRadius: 16,
            borderColor: 'var(--accent)',
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--accent)',
          }}
        >
          ✓ {statusMsg}
        </div>
      )}

      {/* Clean Apple Account Header + Settings Button Top-Right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '2px 2px 0',
        }}
      >
        <h1 className="apple-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={20} color="var(--text-primary)" />
          Hồ sơ
        </h1>

        <button
          type="button"
          className="lg-pill"
          style={{ minHeight: 36, padding: '6px 13px', gap: 6, background: 'var(--glass-surface)' }}
          onClick={onOpenSettings}
          aria-label="Cài đặt"
          title="Mở Cài đặt chủ đề, hiệu ứng & khẩu vị"
        >
          <Settings size={15} color="var(--text-secondary)" />
          <span style={{ fontSize: 12.5 }}>Cài đặt</span>
        </button>
      </div>

      {/* Centered Apple Portrait + Subtle Upload Triggers */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          paddingTop: 4,
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 999,
              background: 'var(--accent-soft)',
              border: '2px solid rgba(255,255,255,0.28)',
              boxShadow: '0 10px 26px rgba(0,0,0,0.32)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 42,
              overflow: 'hidden',
            }}
          >
            {profile.avatarPhotoUrl ? (
              <img
                src={profile.avatarPhotoUrl}
                alt={profile.displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              profile.avatarEmoji
            )}
          </div>

          <label
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 32,
              height: 32,
              borderRadius: 99,
              background: 'var(--accent)',
              color: 'var(--accent-fg, #09090b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
              cursor: 'pointer',
            }}
            title="Tải ảnh đại diện của bạn"
            aria-label="Đổi ảnh đại diện"
          >
            <Camera size={14} />
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadAvatarPhoto}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
          <label className="lg-pill" style={{ minHeight: 30, padding: '3px 11px', fontSize: 12, cursor: 'pointer' }}>
            <FileUp size={12} /> Chọn ảnh của bạn
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadAvatarPhoto}
              style={{ display: 'none' }}
            />
          </label>
          <button
            type="button"
            className={`lg-pill ${showEmojiPicker ? 'active' : ''}`}
            style={{ minHeight: 30, padding: '3px 11px', fontSize: 12 }}
            onClick={() => setShowEmojiPicker((v) => !v)}
          >
            {profile.avatarEmoji} Biểu tượng {showEmojiPicker ? '▴' : '▾'}
          </button>
          {profile.avatarPhotoUrl && (
            <button
              type="button"
              className="lg-pill"
              style={{ minHeight: 30, padding: '3px 10px', fontSize: 12, color: '#ef4444' }}
              onClick={() => onChangeProfile((p) => ({ ...p, avatarPhotoUrl: null }))}
            >
              <Trash2 size={12} /> Gỡ ảnh
            </button>
          )}
        </div>

        {showEmojiPicker && (
          <div className="h-scroll-row" style={{ maxWidth: '100%' }}>
            {AVATAR_CHOICES.map((em) => (
              <button
                key={em}
                type="button"
                className={`lg-pill ${!profile.avatarPhotoUrl && profile.avatarEmoji === em ? 'active' : ''}`}
                style={{ minHeight: 32, padding: '3px 10px', fontSize: 16 }}
                onClick={() =>
                  onChangeProfile((p) => ({ ...p, avatarEmoji: em, avatarPhotoUrl: null }))
                }
              >
                {em}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Unified Apple Inset Form Card: Name + Foodie Nickname + Dice */}
      <div className="apple-inset-group">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
          }}
        >
          <label
            style={{
              width: 72,
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            Tên
          </label>
          <input
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 700,
            }}
            placeholder="Nhập tên của bạn..."
            value={nameDraft}
            onChange={(e) => {
              const v = e.target.value;
              setNameDraft(v);
              syncProfileText(v, badgeDraft);
            }}
            onBlur={() =>
              onChangeProfile((p) => ({ ...p, displayName: nameDraft, badgeTitle: badgeDraft }))
            }
          />
        </div>

        <div className="apple-inset-divider" />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 10px 9px 14px',
          }}
        >
          <label
            style={{
              width: 72,
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            Biệt danh
          </label>
          <input
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
            }}
            placeholder="VD: Chiến Thần Cơm Cháy..."
            value={badgeDraft}
            onChange={(e) => {
              const v = e.target.value;
              setBadgeDraft(v);
              syncProfileText(nameDraft, v);
            }}
            onBlur={() =>
              onChangeProfile((p) => ({ ...p, displayName: nameDraft, badgeTitle: badgeDraft }))
            }
          />
          <button
            type="button"
            onClick={handleRollNickname}
            aria-label="Xúc xắc biệt danh"
            title="Tung xúc xắc đổi biệt danh đồ ăn hài hước"
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              border: 'none',
              background: 'var(--glass-pill-bg)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Dices
              size={19}
              style={{
                transform: diceSpin ? 'rotate(240deg) scale(1.15)' : 'rotate(0deg)',
                transition: 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </button>
        </div>

        <div className="apple-inset-divider" />

        <div style={{ padding: '8px 12px 10px' }}>
          <div className="h-scroll-row">
            {sampleNicknames.map((nick) => (
              <button
                key={nick}
                type="button"
                className={`lg-pill ${badgeDraft === nick ? 'active' : ''}`}
                style={{ minHeight: 27, padding: '2px 10px', fontSize: 11 }}
                onClick={() => {
                  setBadgeDraft(nick);
                  onChangeProfile((p) => ({ ...p, badgeTitle: nick }));
                }}
              >
                {nick}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Unified Apple Inset 4-Stat Summary Bar */}
      <div className="apple-inset-group">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            padding: '12px 6px',
          }}
        >
          {[
            { label: 'Yêu thích', value: favCount },
            { label: 'Muốn thử', value: wishlistCount },
            { label: 'Đã ăn', value: visitedCount },
            { label: 'Quán thêm', value: userRestaurants.length },
          ].map((stat, idx) => (
            <div
              key={stat.label}
              style={{
                textAlign: 'center',
                borderLeft: idx > 0 ? '1px solid var(--glass-hairline)' : 'none',
                padding: '2px 4px',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: idx === 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Account Sync & Sign-In Card */}
      {authUser && (
        <div className="apple-inset-group" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span className="apple-row-icon">
                {authUser.isAnonymous ? <ShieldCheck size={15} /> : <Cloud size={15} />}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {authUser.isAnonymous
                    ? 'Đang dùng Tài khoản khách'
                    : authUser.email || authUser.displayName || 'Tài khoản Firebase'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                  {authUser.isAnonymous
                    ? 'Nâng cấp tài khoản để giữ dữ liệu khi đổi máy'
                    : cloudSyncState === 'syncing'
                    ? 'Đang đồng bộ lên đám mây...'
                    : cloudSyncState === 'offline'
                    ? 'Tạm lưu trên máy · Tự đồng bộ khi có mạng'
                    : 'Đã đồng bộ dữ liệu lên Firebase Cloud'}
                </div>
              </div>
            </div>

            {onSignOut && (
              <button
                type="button"
                className="lg-pill"
                disabled={authActionBusy}
                style={{ minHeight: 30, padding: '3px 10px', fontSize: 11.5, flexShrink: 0 }}
                onClick={async () => {
                  setAuthActionBusy(true);
                  try {
                    await onSignOut();
                  } finally {
                    setAuthActionBusy(false);
                  }
                }}
              >
                <LogOut size={12} /> Đăng xuất
              </button>
            )}
          </div>

          {authUser.isAnonymous && (
            <>
              <div className="apple-inset-divider" style={{ margin: '0 -14px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
                {onUpgradeGuestGoogle && (
                  <button
                    type="button"
                    className="lg-pill"
                    disabled={authActionBusy}
                    style={{ minHeight: 34, fontSize: 11.5, width: '100%' }}
                    onClick={async () => {
                      setUpError(null);
                      setAuthActionBusy(true);
                      const err = await onUpgradeGuestGoogle();
                      setAuthActionBusy(false);
                      if (err) setUpError(err);
                      else flashMsg('Đã nâng cấp bằng Google & giữ toàn bộ dữ liệu!');
                    }}
                  >
                    Liên kết Google
                  </button>
                )}
                {onUpgradeGuestEmail && (
                  <button
                    type="button"
                    className={`lg-pill ${showUpgradeForm ? 'active' : ''}`}
                    disabled={authActionBusy}
                    style={{ minHeight: 34, fontSize: 11.5, width: '100%' }}
                    onClick={() => {
                      setUpError(null);
                      setShowUpgradeForm((v) => !v);
                    }}
                  >
                    Tạo TK Email
                  </button>
                )}
              </div>

              {upError && (
                <div style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 600 }}>
                  {upError}
                </div>
              )}

              {showUpgradeForm && onUpgradeGuestEmail && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!upEmail.trim() || upPass.length < 6) {
                      setUpError('Nhập email hợp lệ và mật khẩu tối thiểu 6 ký tự.');
                      return;
                    }
                    setUpError(null);
                    setAuthActionBusy(true);
                    const err = await onUpgradeGuestEmail(upEmail.trim(), upPass, nameDraft);
                    setAuthActionBusy(false);
                    if (err) {
                      setUpError(err);
                    } else {
                      setShowUpgradeForm(false);
                      setUpEmail('');
                      setUpPass('');
                      flashMsg('Đã tạo tài khoản Email & chuyển toàn bộ dữ liệu khách!');
                    }
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}
                >
                  <input
                    type="email"
                    required
                    className="lg-input"
                    placeholder="Email mới của bạn..."
                    value={upEmail}
                    onChange={(e) => setUpEmail(e.target.value)}
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="lg-input"
                    placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                    value={upPass}
                    onChange={(e) => setUpPass(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="lg-btn-accent"
                    disabled={authActionBusy}
                    style={{ minHeight: 38, fontSize: 12.5 }}
                  >
                    {authActionBusy ? 'Đang liên kết...' : 'Lưu tài khoản vĩnh viễn'}
                  </button>
                </form>
              )}
            </>
          )}

          <div className="apple-inset-divider" style={{ margin: '0 -14px' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="lg-pill"
              style={{ minHeight: 30, padding: '3px 10px', fontSize: 11.5 }}
              onClick={() => setShowPrivacyPolicy((v) => !v)}
            >
              <ShieldCheck size={12} /> {showPrivacyPolicy ? 'Ẩn chính sách bảo mật' : 'Chính sách bảo mật & GPS'}
            </button>

            {!confirmDeleteAcc ? (
              <button
                type="button"
                className="lg-pill"
                disabled={authActionBusy}
                style={{ minHeight: 30, padding: '3px 10px', fontSize: 11.5, color: '#ef4444' }}
                onClick={() => {
                  setDeleteAccError(null);
                  setConfirmDeleteAcc(true);
                }}
              >
                <Trash2 size={12} /> Xoá dữ liệu & tài khoản
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="lg-pill"
                  disabled={authActionBusy}
                  style={{ minHeight: 30, padding: '3px 10px', fontSize: 11.5, background: 'rgba(239,68,68,0.2)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.5)' }}
                  onClick={async () => {
                    setAuthActionBusy(true);
                    setDeleteAccError(null);
                    const err = await deleteAccountAndCloudData();
                    setAuthActionBusy(false);
                    if (err) {
                      setDeleteAccError(err);
                    } else {
                      setConfirmDeleteAcc(false);
                      flashMsg('Đã xoá sạch tài khoản và dữ liệu của bạn khỏi hệ thống.');
                    }
                  }}
                >
                  {authActionBusy ? 'Đang xoá...' : 'Xác nhận xoá vĩnh viễn'}
                </button>
                <button
                  type="button"
                  className="lg-pill"
                  disabled={authActionBusy}
                  style={{ minHeight: 30, padding: '3px 9px', fontSize: 11.5 }}
                  onClick={() => setConfirmDeleteAcc(false)}
                >
                  Huỷ
                </button>
              </div>
            )}
          </div>

          {deleteAccError && (
            <div style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 600 }}>
              {deleteAccError}
            </div>
          )}

          {showPrivacyPolicy && (
            <div
              className="inline-expand-panel"
              style={{
                padding: '10px 12px',
                borderRadius: 14,
                background: 'var(--glass-surface-quiet)',
                border: '1px solid var(--glass-hairline)',
                fontSize: 11.5,
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              <strong style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                Quyền riêng tư & Dữ liệu cá nhân (Cố Đô Vị)
              </strong>
              <span>• <strong>Tài khoản & Hồ sơ</strong>: Chỉ lưu email/tên hiển thị, danh sách yêu thích, ghi chú và quán bạn tự thêm trên Firebase Firestore để đồng bộ giữa các máy.</span>
              <span>• <strong>Vị trí GPS</strong>: Chỉ dùng trực tiếp trên trình duyệt để đo khoảng cách tới quán ăn quanh bạn và hiển thị chấm xanh trên bản đồ — không theo dõi nền hay bán dữ liệu vị trí.</span>
              <span>• <strong>Quyền xoá dữ liệu</strong>: Bạn có thể bấm <em>Xoá dữ liệu & tài khoản</em> bất cứ lúc nào để xoá toàn bộ dữ liệu trên Firestore và tài khoản xác thực ngay lập tức.</span>
            </div>
          )}
        </div>
      )}

      <button type="button" className="lg-btn-accent" style={{ minHeight: 46 }} onClick={onOpenAddModal}>
        <Plus size={16} /> Thêm quán ăn mới ({allRestaurantsCount} quán sẵn sàng)
      </button>

      {/* Modular Apple iOS NavigationStack Settings Sheet */}
      {isSettingsOpen && (
        <ReactSuspense
          fallback={
            <div className="sheet-backdrop" style={{ zIndex: 9990, background: 'rgba(0,0,0,0.28)' }}>
              <div className="lg-surface" style={{ padding: '14px 18px', borderRadius: 16, fontSize: 13.5, fontWeight: 700 }}>
                Đang mở Cài đặt...
              </div>
            </div>
          }
        >
          <SettingsModal
            isOpen={isSettingsOpen}
            profile={profile}
            userRestaurants={userRestaurants}
            allRestaurants={allRestaurants}
            statusMsg={statusMsg}
            onClose={onCloseSettings}
            onChangeProfile={onChangeProfile}
            onUpdateGlass={updateGlass}
            onUpdateDietary={updateDietary}
            onToggleTaste={toggleTaste}
            onUpdateCustomTheme={updateCustomTheme}
            onUploadWallpaper={handleUploadCustomWallpaper}
            onReExtractBg={handleReExtractFromCurrentBg}
            onLocateGps={handleLocateGps}
            onExportBackup={handleExportAll}
            onImportBackup={handleImportBackup}
            onResetProfile={onResetProfile}
            onFlashMsg={flashMsg}
            onOpenAddModal={onOpenAddModal}
            onEditUserRestaurant={onEditUserRestaurant}
            onDeleteUserRestaurant={onDeleteUserRestaurant}
            onUnblacklistRestaurant={onUnblacklistRestaurant}
          />
        </ReactSuspense>
      )}
    </div>
  );
};
