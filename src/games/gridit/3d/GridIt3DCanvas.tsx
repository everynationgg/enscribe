import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Compass,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { GridItBoard } from '../../../../shared/gridit/types';
import { getSocket } from '../../../services/socket';
import { GridIt3DScene } from './GridIt3DScene';
import { HostShakePayload } from './GridIt3DShaker';

export interface GridIt3DCanvasProps {
  board: GridItBoard;
  selectedPath: string[];
  hintTileId?: string | null;
  paused?: boolean;
  isShaking?: boolean;
  isHost?: boolean;
  editorMode?: boolean;
  authoredTileIds?: Set<string>;
  activeTileId?: string | null;
  activeRainbowIds?: Set<string>;
  activeGoldenIds?: Set<string>;
  lightningActive?: boolean;
  readOnly?: boolean;
  matchId?: string;
  onTileTap?: (tileId: string) => void;
  onPathChange: (nextPath: string[]) => void;
  onSubmitPath: (path: string[]) => void;
  onFallbackTo2D?: () => void;
}

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export const GridIt3DCanvas: React.FC<GridIt3DCanvasProps> = memo((props) => {
  const {
    board,
    selectedPath,
    hintTileId,
    paused = false,
    isShaking = false,
    isHost = true,
    editorMode = false,
    activeRainbowIds,
    activeGoldenIds,
    readOnly = false,
    matchId,
    onTileTap,
    onPathChange,
    onSubmitPath,
    onFallbackTo2D,
  } = props;

  const [hasWebGL] = useState(() => checkWebGLSupport());
  const [resetViewTrigger, setResetViewTrigger] = useState(0);
  const [rotateStepTrigger, setRotateStepTrigger] = useState(0);
  const [remoteOrientation, setRemoteOrientation] = useState<HostShakePayload | null>(null);
  const [readySplash, setReadySplash] = useState<'ready' | 'go' | null>(null);

  // If WebGL is not available, immediately notify fallback
  useEffect(() => {
    if (!hasWebGL && onFallbackTo2D) {
      onFallbackTo2D();
    }
  }, [hasWebGL, onFallbackTo2D]);

  // Multiplayer socket orientation sync
  useEffect(() => {
    if (!matchId) return;
    const socket = getSocket();

    const handleHostShake = (payload: any) => {
      if (!isHost && payload) {
        setRemoteOrientation(payload);
      }
    };

    socket.on('gridit:host_shake', handleHostShake);
    return () => {
      socket.off('gridit:host_shake', handleHostShake);
    };
  }, [isHost, matchId]);

  const handleEmitOrientation = useCallback(
    (payload: HostShakePayload) => {
      if (!isHost || !matchId) return;
      const socket = getSocket();
      socket.emit('gridit:host_shake', {
        matchId,
        ...payload,
      });
    },
    [isHost, matchId]
  );

  const handleShakeSettled = useCallback(() => {
    // Ready -> GO transition
    setReadySplash('ready');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(60);
      } catch {
        // Ignored
      }
    }

    setTimeout(() => {
      setReadySplash('go');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([80, 50, 120]);
        } catch {
          // Ignored
        }
      }
      setTimeout(() => {
        setReadySplash(null);
      }, 750);
    }, 600);
  }, []);

  return (
    <div
      className="ens-gridit-board-viewport ens-gridit-3d-viewport"
      role="application"
      aria-label="GridIt interactive 3D letter box"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        dpr={[1, Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)]}
        camera={{ position: [0, 8.5, 6.2], fov: 46 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <React.Suspense fallback={null}>
          <GridIt3DScene
            board={board}
            selectedPath={selectedPath}
            hintTileId={hintTileId}
            paused={paused}
            isShaking={isShaking}
            isHost={isHost}
            resetViewTrigger={resetViewTrigger}
            rotateStepTrigger={rotateStepTrigger}
            readOnly={readOnly}
            editorMode={editorMode}
            activeRainbowIds={activeRainbowIds}
            activeGoldenIds={activeGoldenIds}
            remoteOrientation={remoteOrientation}
            onEmitOrientation={handleEmitOrientation}
            onShakeSettled={handleShakeSettled}
            onTileTap={onTileTap}
            onPathChange={onPathChange}
            onSubmitPath={onSubmitPath}
          />
        </React.Suspense>
      </Canvas>

      {/* Shaking Status Banner */}
      {isShaking && !paused && !readySplash && (
        <div
          className="ens-gridit-shake-banner"
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <Sparkles size={16} color="#fde047" />
          <span>
            {isHost
              ? 'Drag to Shake Box! Settle in 5s...'
              : 'Host is Shaking the 3D Box...'}
          </span>
        </div>
      )}

      {/* Ready / GO Splash Banner Overlay */}
      {readySplash && (
        <div
          className={`ens-gridit-ready-splash ${
            readySplash === 'go' ? 'is-go' : 'is-ready'
          }`}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 25,
            fontSize: readySplash === 'go' ? '3.4rem' : '2.6rem',
            fontWeight: 900,
            letterSpacing: '0.08em',
            color: readySplash === 'go' ? '#4ade80' : '#fde047',
            textShadow:
              readySplash === 'go'
                ? '0 0 24px rgba(74, 222, 128, 0.8), 0 4px 12px rgba(0,0,0,0.7)'
                : '0 0 24px rgba(253, 224, 71, 0.8), 0 4px 12px rgba(0,0,0,0.7)',
            animation: 'ensGridItPop 0.5s ease-out forwards',
          }}
        >
          {readySplash === 'ready' ? 'READY...' : 'GO!'}
        </div>
      )}

      {/* Bottom-Left Controls: Rotate Step & Gesture Hint */}
      <div
        className="ens-gridit-canvas-left-tools"
        onPointerDown={(e) => e.stopPropagation()}
        style={{ zIndex: 12 }}
      >
        <button
          type="button"
          className="ens-gridit-cam-btn"
          onClick={() => setRotateStepTrigger((c) => c + 1)}
          title="Rotate camera 90°"
          aria-label="Rotate camera 90 degrees"
        >
          <RotateCcw size={16} />
        </button>

        <span className="ens-gridit-gesture-hint">
          {readOnly
            ? 'Spectator • Drag to orbit 3D box'
            : isShaking
            ? isHost
              ? 'Swipe to tilt and shake dice'
              : 'Watching host shake 3D box'
            : 'Tap dice to trace • Drag empty space to orbit'}
        </span>
      </div>

      {/* Bottom-Right Controls: Reset Overhead View */}
      <div
        className="ens-gridit-canvas-right-tools"
        onPointerDown={(e) => e.stopPropagation()}
        style={{ zIndex: 12 }}
      >
        <button
          type="button"
          className="ens-gridit-cam-btn"
          onClick={() => setResetViewTrigger((c) => c + 1)}
          title="Reset to default overhead 3D view"
          aria-label="Reset View"
        >
          <Compass size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
});
GridIt3DCanvas.displayName = 'GridIt3DCanvas';
