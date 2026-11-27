import React, { useState } from 'react';
import {
  ArrowRight,
  Compass,
  Lock,
  Mail,
  Sparkles,
  User,
  UserCheck,
} from 'lucide-react';
import { LiquidBackdrop } from './LiquidBackdrop';
import { GlassConfig } from '../types/restaurant';
import { APP_AUTHOR, DEFAULT_USER_PROFILE } from '../data/themes';

interface AuthGateScreenProps {
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (email: string, password: string, displayName: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onGuestSignIn: () => Promise<void>;
  busyAction: 'email' | 'google' | 'guest' | null;
  errorMsg: string | null;
  onClearError: () => void;
  resolvedMode: 'dark' | 'light' | 'jade';
}

const DEFAULT_AUTH_GLASS: GlassConfig = {
  ...DEFAULT_USER_PROFILE.glass,
  mode: 'system',
};

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  onEmailSignIn,
  onEmailSignUp,
  onGoogleSignIn,
  onGuestSignIn,
  busyAction,
  errorMsg,
  onClearError,
  resolvedMode,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (authTab === 'login') {
      await onEmailSignIn(email.trim(), password);
    } else {
      await onEmailSignUp(email.trim(), password, displayName.trim());
    }
  };

  const disabled = Boolean(busyAction);

  return (
    <div className="app-outer-stage">
      <LiquidBackdrop glass={DEFAULT_AUTH_GLASS} resolvedMode={resolvedMode} />

      <main className="phone-shell framed">
        <LiquidBackdrop glass={DEFAULT_AUTH_GLASS} resolvedMode={resolvedMode} insidePhone />

        <div
          style={{
            position: 'relative',
            zIndex: 3,
            flex: 1,
            overflowY: 'auto',
            padding: 'calc(16px + env(safe-area-inset-top)) 18px calc(16px + env(safe-area-inset-bottom))',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {/* Editorial Monochrome Brand Header */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div
              className="lg-surface-strong lg-sheen"
              style={{
                width: 56,
                height: 56,
                borderRadius: 17,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
              }}
            >
              🪷
            </div>
            <div>
              <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em' }}>
                Cố Đô Vị
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45, maxWidth: 290 }}>
                Chọn món & lưu quán ruột Ninh Bình, đồng bộ tự động trên mọi thiết bị.
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div
            className="lg-surface-strong lg-sheen"
            style={{
              borderRadius: 26,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 13,
            }}
          >
            {/* Segmented Login / Sign Up Switch */}
            <div className="apple-segmented" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <button
                type="button"
                className={`apple-segment-btn ${authTab === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setAuthTab('login');
                  onClearError();
                }}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={`apple-segment-btn ${authTab === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setAuthTab('register');
                  onClearError();
                }}
              >
                Tạo tài khoản
              </button>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.16)',
                  border: '1px solid rgba(239, 68, 68, 0.38)',
                  color: resolvedMode === 'light' ? '#b91c1c' : '#fecaca',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {authTab === 'register' && (
                <div style={{ position: 'relative' }}>
                  <User
                    size={15}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    className="lg-input"
                    style={{ paddingLeft: 36 }}
                    placeholder="Tên hiển thị của bạn (tuỳ chọn)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={disabled}
                  />
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <Mail
                  size={15}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="lg-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Email của bạn"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) onClearError();
                  }}
                  disabled={disabled}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                  className="lg-input"
                  style={{ paddingLeft: 36 }}
                  placeholder={authTab === 'login' ? 'Mật khẩu' : 'Mật khẩu (tối thiểu 6 ký tự)'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) onClearError();
                  }}
                  disabled={disabled}
                />
              </div>

              <button
                type="submit"
                className="lg-btn-accent"
                disabled={disabled}
                style={{ width: '100%', minHeight: 45, marginTop: 2, opacity: disabled ? 0.72 : 1 }}
              >
                {busyAction === 'email'
                  ? 'Đang xử lý...'
                  : authTab === 'login'
                  ? 'Đăng nhập ngay'
                  : 'Tạo tài khoản & đồng bộ'}
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Clean Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--glass-hairline)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>hoặc</span>
              <div style={{ flex: 1, height: 1, background: 'var(--glass-hairline)' }} />
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              className="lg-pill"
              disabled={disabled}
              onClick={onGoogleSignIn}
              style={{ width: '100%', minHeight: 42, fontSize: 13.5, justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.24 1.25-.96 2.31-2.04 3.02l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.48 0-.72-.06-1.42-.18-2.09H12z"
                />
                <path
                  fill="#4285F4"
                  d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.3-2.56c-.91.61-2.08.98-3.31.98-2.54 0-4.7-1.72-5.47-4.03H3.12v2.64C4.76 19.86 8.12 22 12 22z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.53 13.97A5.95 5.95 0 0 1 6.2 12c0-.68.12-1.35.33-1.97V7.39H3.12A9.97 9.97 0 0 0 2 12c0 1.61.39 3.14 1.12 4.61l3.41-2.64z"
                />
                <path
                  fill="#34A853"
                  d="M12 6c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.95 3.01 14.7 2 12 2 8.12 2 4.76 4.14 3.12 7.39l3.41 2.64C7.3 7.72 9.46 6 12 6z"
                />
              </svg>
              {busyAction === 'google' ? 'Đang kết nối Google...' : 'Tiếp tục với Google'}
            </button>
          </div>

          {/* Guest Account Entry */}
          <button
            type="button"
            className="lg-surface"
            disabled={disabled}
            onClick={onGuestSignIn}
            style={{
              borderRadius: 20,
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              cursor: disabled ? 'wait' : 'pointer',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="apple-row-icon">
                <UserCheck size={16} />
              </span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {busyAction === 'guest' ? 'Đang tạo phiên khách...' : 'Dùng tài khoản khách'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                  Vào app ngay · Có thể nâng cấp thành tài khoản sau
                </div>
              </div>
            </div>
            <Compass size={17} color="var(--text-secondary)" />
          </button>

          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Sparkles size={11} /> Dữ liệu lưu an toàn trên Firebase Cloud của bạn
            </div>
            <div>
              Phát triển bởi{' '}
              <a
                href={APP_AUTHOR.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}
              >
                {APP_AUTHOR.fullName} ({APP_AUTHOR.nickname})
              </a>
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
};
