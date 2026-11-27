let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioCtor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Plays a subtle iOS-like tactile click using Web Audio API without external audio files. */
export function playTapTick(enabled = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.028);
    gain.gain.setValueAtTime(0.038, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  } catch {
    // ignore audio restrictions
  }
}

/** Plays a soft two-note crystalline chime when a restaurant choice is locked in. */
export function playChimeSuccess(enabled = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const notes = [587.33, 880]; // D5 -> A5
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch {
    // ignore audio restrictions
  }
}

/** Renders a lightweight DOM confetti burst inside the target shell and cleans it up cleanly. */
export function spawnCelebrationConfetti(container: HTMLElement | null): void {
  if (!container || typeof document === 'undefined') return;
  const layer = document.createElement('div');
  layer.className = 'codovi-confetti-layer';
  layer.setAttribute('aria-hidden', 'true');

  const colors = ['#f59e0b', '#38bdf8', '#fb7185', '#34d399', '#a78bfa', '#f4f4f5'];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'codovi-confetti-piece';
    const angle = ((i / count) * 360 + (Math.random() * 18 - 9)) * (Math.PI / 180);
    const dist = 65 + Math.random() * 115;
    const tx = Math.round(Math.cos(angle) * dist);
    const ty = Math.round(Math.sin(angle) * dist - 35);
    const rot = Math.round(Math.random() * 520 - 260);
    const delay = Math.round(Math.random() * 90);
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty('--tx', `${tx}px`);
    piece.style.setProperty('--ty', `${ty}px`);
    piece.style.setProperty('--rot', `${rot}deg`);
    piece.style.animationDelay = `${delay}ms`;
    layer.appendChild(piece);
  }

  container.appendChild(layer);
  window.setTimeout(() => {
    layer.remove();
  }, 1350);
}
