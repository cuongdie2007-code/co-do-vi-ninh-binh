import React from 'react';
import { CustomThemeConfig, GlassConfig } from '../types/restaurant';
import { hexToRgba } from '../utils/restaurantUtils';

interface LiquidBackdropProps {
  glass: GlassConfig;
  resolvedMode?: 'dark' | 'light' | 'jade';
  customTheme?: CustomThemeConfig;
  insidePhone?: boolean;
}

export const LiquidBackdrop: React.FC<LiquidBackdropProps> = ({
  glass,
  resolvedMode,
  customTheme,
  insidePhone,
}) => {
  const customPhoto = glass.customBgUrl;
  const effectiveMode = resolvedMode || (glass.mode === 'light' ? 'light' : 'dark');
  const strength = customTheme?.enabled ? customTheme.scrimStrength : 0.48;

  const customScrim =
    effectiveMode === 'light'
      ? `linear-gradient(180deg, rgba(255,255,255,${Math.max(0.24, strength * 0.88).toFixed(2)}) 0%, rgba(248,250,252,${Math.max(0.18, strength * 0.62).toFixed(2)}) 44%, rgba(242,242,247,${Math.min(0.88, strength + 0.24).toFixed(2)}) 100%)`
      : `linear-gradient(180deg, rgba(9,9,11,${Math.max(0.28, strength * 0.92).toFixed(2)}) 0%, rgba(9,9,11,${Math.max(0.18, strength * 0.65).toFixed(2)}) 42%, rgba(6,6,8,${Math.min(0.92, strength + 0.34).toFixed(2)}) 100%)`;

  const appleSystemBg =
    effectiveMode === 'light'
      ? 'radial-gradient(ellipse 115% 44% at 50% -10%, rgba(255,255,255,0.92) 0%, transparent 72%), linear-gradient(180deg, #f5f5f7 0%, #f2f2f7 56%, #eaeaef 100%)'
      : effectiveMode === 'jade'
      ? 'linear-gradient(180deg, #000000 0%, #050507 100%)'
      : 'radial-gradient(ellipse 100% 38% at 50% -12%, rgba(255,255,255,0.055) 0%, transparent 70%), linear-gradient(180deg, #0b0b0e 0%, #111115 58%, #070709 100%)';

  const customColorCanvasBg = customTheme?.enabled
    ? `radial-gradient(circle at 18% 12%, ${hexToRgba(
        customTheme.accent,
        effectiveMode === 'light' ? 0.16 : 0.22
      )} 0%, transparent 56%), radial-gradient(circle at 86% 80%, ${hexToRgba(
        customTheme.accentSecondary,
        effectiveMode === 'light' ? 0.13 : 0.18
      )} 0%, transparent 58%), ${appleSystemBg}`
    : appleSystemBg;

  if (insidePhone) {
    return (
      <div className="phone-bg-clip" aria-hidden="true">
        {customPhoto ? (
          <>
            <img
              src={customPhoto}
              alt="Ảnh nền tuỳ chỉnh"
              className={`phone-bg-photo ${!glass.reduceMotion ? 'ambient-animate' : ''}`}
            />
            <div className="phone-bg-scrim" style={{ background: customScrim }} />
          </>
        ) : (
          <div className="phone-bg-scrim" style={{ background: customColorCanvasBg }} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="backdrop-layer" aria-hidden="true">
        {customPhoto ? (
          <>
            <img
              src={customPhoto}
              alt=""
              className={`backdrop-photo ${!glass.reduceMotion ? 'ambient-animate' : ''}`}
            />
            <div className="backdrop-scrim" style={{ background: customScrim }} />
          </>
        ) : (
          <div className="backdrop-scrim" style={{ background: customColorCanvasBg }} />
        )}
      </div>
      <div className="desktop-outer-blur" aria-hidden="true" />
    </>
  );
};
