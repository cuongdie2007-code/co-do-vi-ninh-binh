import { useEffect, useState } from 'react';

/**
 * Keeps an element mounted during its exit animation so closing overlays,
 * popovers, action sheets, and lightboxes fade/scale out cleanly instead of snapping.
 */
export function useAnimatedMount(isOpen: boolean, exitMs = 240) {
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, mounted, exitMs]);

  return { mounted, closing };
}
