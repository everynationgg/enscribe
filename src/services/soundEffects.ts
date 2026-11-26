/**
 * Lightweight shared Enscribe sound-effects manager using Web Audio API.
 * Respects Enscribe's global Sound Effects mute preference across TopBar and games.
 */

const SFX_MUTE_KEY = 'enscribe_sfx_muted_v1';

let audioCtx: AudioContext | null = null;
const listeners = new Set<(muted: boolean) => void>();

export function isSfxMuted(): boolean {
  try {
    return localStorage.getItem(SFX_MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  try {
    localStorage.setItem(SFX_MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
  for (const fn of listeners) fn(muted);
}

export function subscribeSfxMute(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (isSfxMuted()) return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

function playTone(
  freq: number,
  durationSec: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.08,
  delaySec = 0,
  endFreq?: number
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
  }
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export const crushItSfx = {
  tileSelect(stepIndex: number): void {
    const baseFreq = 360 + Math.min(stepIndex, 10) * 48;
    playTone(baseFreq, 0.075, 'triangle', 0.065, 0, baseFreq * 1.08);
  },
  tileUndo(): void {
    playTone(300, 0.06, 'sine', 0.045, 0, 220);
  },
  wordValid(length: number): void {
    const notes = length >= 6 ? [523.25, 659.25, 783.99, 1046.5] : [440, 554.37, 659.25];
    notes.forEach((n, idx) => {
      playTone(n, 0.14, 'triangle', 0.075, idx * 0.05);
    });
  },
  wordInvalid(): void {
    playTone(210, 0.12, 'sawtooth', 0.04, 0, 150);
  },
  powerUpEarned(): void {
    [587.33, 880, 1174.66].forEach((n, idx) => {
      playTone(n, 0.16, 'sine', 0.08, idx * 0.065);
    });
  },
  powerUpBlast(isMega = false): void {
    playTone(isMega ? 180 : 240, isMega ? 0.34 : 0.22, 'sawtooth', 0.09, 0, 55);
    playTone(isMega ? 680 : 520, 0.2, 'triangle', 0.07, 0.04, 180);
  },
  reshuffle(): void {
    [330, 440, 392, 523.25].forEach((n, idx) => {
      playTone(n, 0.09, 'sine', 0.05, idx * 0.045);
    });
  },
  objectiveComplete(): void {
    [659.25, 987.77].forEach((n, idx) => {
      playTone(n, 0.16, 'triangle', 0.075, idx * 0.07);
    });
  },
  stageWin(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, idx) => {
      playTone(n, 0.24, 'triangle', 0.085, idx * 0.08);
    });
  },
  stageLose(): void {
    [392, 349.23, 311.13, 261.63].forEach((n, idx) => {
      playTone(n, 0.22, 'sine', 0.065, idx * 0.11);
    });
  },
};
