import React, { memo, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export function formatGridItTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface MultiplayerTimerProps {
  mode: 'multiplayer';
  durationSeconds: number;
  startedAtMs: number;
  endsAtMs: number;
  serverOffsetMs: number;
  status: 'shaking' | 'active' | 'finished';
  onExpire?: () => void;
}

interface SoloTimerProps {
  mode: 'solo';
  durationSeconds: number;
  secondsLeft: number;
}

export type GridItTimerDisplayProps = MultiplayerTimerProps | SoloTimerProps;

export const GridItTimerDisplay: React.FC<GridItTimerDisplayProps> = memo((props) => {
  const computeMpSeconds = () => {
    if (props.mode !== 'multiplayer') return props.secondsLeft;
    if (props.durationSeconds <= 0) return 0;
    const now = Date.now() + props.serverOffsetMs;
    if (props.status !== 'finished' && now < props.startedAtMs) {
      return props.durationSeconds;
    }
    return Math.max(0, Math.ceil((props.endsAtMs - now) / 1000));
  };

  const [mpSeconds, setMpSeconds] = useState<number>(computeMpSeconds);

  useEffect(() => {
    if (props.mode !== 'multiplayer') return;
    setMpSeconds(computeMpSeconds());
    if (props.status === 'finished' || props.durationSeconds <= 0) return;
    const interval = window.setInterval(() => {
      const next = computeMpSeconds();
      setMpSeconds((prev) => (prev !== next ? next : prev));
      if (next <= 0 && props.onExpire) {
        props.onExpire();
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [
    props.mode,
    props.durationSeconds,
    props.mode === 'multiplayer' ? props.startedAtMs : 0,
    props.mode === 'multiplayer' ? props.endsAtMs : 0,
    props.mode === 'multiplayer' ? props.serverOffsetMs : 0,
    props.mode === 'multiplayer' ? props.status : 'active',
  ]);

  const seconds = props.mode === 'solo' ? props.secondsLeft : mpSeconds;
  const isUntimed = props.durationSeconds <= 0;
  const isShaking =
    props.mode === 'multiplayer' &&
    props.status !== 'finished' &&
    Date.now() + props.serverOffsetMs < props.startedAtMs;
  const isLow = !isUntimed && !isShaking && seconds <= 15;

  return (
    <div className={`ens-gridit-hud-timer ${isLow ? 'is-low' : ''}`}>
      <Clock size={14} />
      <span>{isUntimed ? '∞' : formatGridItTime(seconds)}</span>
    </div>
  );
});

GridItTimerDisplay.displayName = 'GridItTimerDisplay';
