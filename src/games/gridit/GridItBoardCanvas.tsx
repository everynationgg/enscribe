import React, { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Crown, Hand, Maximize2, Minus, Plus, Sparkles } from 'lucide-react';
import { GridItBoard, GridItShapeId, GridItTileNode } from '../../../shared/gridit/types';

interface GridItBoardCanvasProps {
  board: GridItBoard;
  selectedPath: string[];
  hintTileId?: string | null;
  paused?: boolean;
  isShaking?: boolean;
  editorMode?: boolean;
  authoredTileIds?: Set<string>;
  activeTileId?: string | null;
  activeRainbowIds?: Set<string>;
  activeGoldenIds?: Set<string>;
  lightningActive?: boolean;
  readOnly?: boolean;
  onTileTap?: (tileId: string) => void;
  onPathChange: (nextPath: string[]) => void;
  onSubmitPath: (path: string[]) => void;
}

const AMBIGUOUS_ORIENTATION_LETTERS = new Set(['M', 'W', 'N', 'Z', 'U', 'H', 'I', 'O', 'S', 'X']);

const SHAPE_TRAY_THEMES: Record<GridItShapeId, { top: string; rim: string; glow: string }> = {
  square: { top: '#2b399e', rim: '#a5b4fc', glow: 'rgba(129, 140, 248, 0.42)' },
  rectangle: { top: '#24419f', rim: '#93c5fd', glow: 'rgba(96, 165, 250, 0.42)' },
  triangle: { top: '#1d4f9e', rim: '#7dd3fc', glow: 'rgba(56, 189, 248, 0.44)' },
  heart: { top: '#6d1d6b', rim: '#f9a8d4', glow: 'rgba(244, 114, 182, 0.48)' },
  star: { top: '#573698', rim: '#fde047', glow: 'rgba(250, 204, 21, 0.45)' },
  circle: { top: '#432593', rim: '#d8b4fe', glow: 'rgba(192, 132, 252, 0.45)' },
  hexagon: { top: '#134e7c', rim: '#67e8f9', glow: 'rgba(34, 211, 238, 0.46)' },
};

const PhysicalBoardTraySvg: React.FC<{ board: GridItBoard }> = memo(({ board }) => {
  const uid = useId();
  const b = board.bounds;
  const pad = 16;
  const minX = b.minX - pad;
  const minY = b.minY - pad;
  const width = b.width + pad * 2;
  const height = b.height + pad * 2;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const hw = b.width / 2 + 6;
  const hh = b.height / 2 + 6;
  const theme = SHAPE_TRAY_THEMES[board.shapeId] ?? SHAPE_TRAY_THEMES.square;

  const renderShapeBackplate = () => {
    switch (board.shapeId) {
      case 'heart': {
        const d = `M ${cx} ${b.maxY + 10} C ${cx - hw * 0.96} ${cy + hh * 0.36} ${b.minX - 10} ${cy - hh * 0.14} ${b.minX - 4} ${cy - hh * 0.52} C ${b.minX + hw * 0.04} ${b.minY - 12} ${cx - hw * 0.14} ${b.minY - 8} ${cx} ${b.minY + hh * 0.24} C ${cx + hw * 0.14} ${b.minY - 8} ${b.maxX - hw * 0.04} ${b.minY - 12} ${b.maxX + 4} ${cy - hh * 0.52} C ${b.maxX + 10} ${cy - hh * 0.14} ${cx + hw * 0.96} ${cy + hh * 0.36} ${cx} ${b.maxY + 10} Z`;
        return (
          <>
            <path d={d} transform="translate(0 7)" fill="rgba(12, 16, 62, 0.7)" />
            <path d={d} fill={`url(#${uid}-tray)`} stroke={theme.rim} strokeWidth="4" strokeLinejoin="round" />
          </>
        );
      }
      case 'star': {
        const pts: string[] = [];
        const outerR = Math.max(hw, hh) * 1.12;
        const innerR = outerR * 0.52;
        for (let i = 0; i < 10; i++) {
          const angle = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? outerR : innerR;
          pts.push(`${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`);
        }
        return (
          <>
            <polygon points={pts.join(' ')} transform="translate(0 7)" fill="rgba(12, 16, 62, 0.7)" />
            <polygon
              points={pts.join(' ')}
              fill={`url(#${uid}-tray)`}
              stroke={theme.rim}
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </>
        );
      }
      case 'triangle': {
        const d = `M ${cx} ${b.minY - 12} L ${b.maxX + 12} ${b.maxY + 8} Q ${cx} ${b.maxY + 14} ${b.minX - 12} ${b.maxY + 8} Z`;
        return (
          <>
            <path d={d} transform="translate(0 7)" fill="rgba(12, 16, 62, 0.7)" />
            <path d={d} fill={`url(#${uid}-tray)`} stroke={theme.rim} strokeWidth="4" strokeLinejoin="round" />
          </>
        );
      }
      case 'hexagon': {
        const pts: string[] = [];
        const rx = hw * 1.04;
        const ry = hh * 1.04;
        for (let i = 0; i < 6; i++) {
          const angle = -Math.PI / 2 + (i * Math.PI) / 3;
          pts.push(`${(cx + Math.cos(angle) * rx).toFixed(1)},${(cy + Math.sin(angle) * ry).toFixed(1)}`);
        }
        return (
          <>
            <polygon points={pts.join(' ')} transform="translate(0 7)" fill="rgba(12, 16, 62, 0.7)" />
            <polygon
              points={pts.join(' ')}
              fill={`url(#${uid}-tray)`}
              stroke={theme.rim}
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </>
        );
      }
      case 'circle': {
        const r = Math.max(hw, hh) * 0.98;
        return (
          <>
            <circle cx={cx} cy={cy + 7} r={r} fill="rgba(12, 16, 62, 0.7)" />
            <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-tray)`} stroke={theme.rim} strokeWidth="4" />
          </>
        );
      }
      default:
        return (
          <>
            <rect
              x={b.minX - 6}
              y={b.minY + 1}
              width={b.width + 12}
              height={b.height + 12}
              rx="28"
              fill="rgba(12, 16, 62, 0.7)"
            />
            <rect
              x={b.minX - 6}
              y={b.minY - 6}
              width={b.width + 12}
              height={b.height + 12}
              rx="28"
              fill={`url(#${uid}-tray)`}
              stroke={theme.rim}
              strokeWidth="4"
            />
          </>
        );
    }
  };

  return (
    <svg
      className="ens-gridit-tray-svg"
      style={{ left: minX, top: minY, width, height, filter: `drop-shadow(0 12px 26px ${theme.glow})` }}
      viewBox={`${minX} ${minY} ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-tray`} x1={minX} y1={minY} x2={minX + width} y2={minY + height} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={theme.top} stopOpacity="0.92" />
          <stop offset="100%" stopColor="#131a58" stopOpacity="0.96" />
        </linearGradient>
      </defs>
      {renderShapeBackplate()}
      {/* Recessed physical die tray sockets */}
      {board.tiles.map((t) => {
        const w = board.tileRadius * 2 + 4;
        return (
          <rect
            key={`well-${t.id}`}
            x={t.x - w / 2}
            y={t.y - w / 2}
            width={w}
            height={w}
            rx={14}
            fill="rgba(9, 13, 46, 0.56)"
            stroke="rgba(196, 210, 255, 0.2)"
            strokeWidth="1.2"
          />
        );
      })}
    </svg>
  );
});
PhysicalBoardTraySvg.displayName = 'PhysicalBoardTraySvg';

interface TileItemProps {
  tile: GridItTileNode;
  tileIndex: number;
  radius: number;
  selectedIndex: number;
  isHinted: boolean;
  isPaused: boolean;
  isShaking: boolean;
  isEmptySlot: boolean;
  isAuthored: boolean;
  isActiveEditorTile: boolean;
  isRainbow: boolean;
  isGolden: boolean;
}

const GridItTileNodeView = memo<TileItemProps>(
  ({
    tile,
    tileIndex,
    radius,
    selectedIndex,
    isHinted,
    isPaused,
    isShaking,
    isEmptySlot,
    isAuthored,
    isActiveEditorTile,
    isRainbow,
    isGolden,
  }) => {
    const isSelected = selectedIndex >= 0;
    const size = radius * 2;
    const baseRot = (tile.rotationDeg ?? 0) + (tile.tiltDeg ?? 0);
    const letterUpper = tile.letter.trim().toUpperCase();
    const showOrientBar =
      !isPaused &&
      !isEmptySlot &&
      !isRainbow &&
      AMBIGUOUS_ORIENTATION_LETTERS.has(letterUpper);

    // Deterministic per-die shake trajectory so dice visibly rattle and settle cleanly
    const sDx = (((tileIndex * 37) % 15) - 7) * 1.4;
    const sDy = (((tileIndex * 53) % 15) - 7) * 1.4;
    const sRot = (((tileIndex * 29) % 44) - 22);
    const sDelay = `${(tileIndex % 7) * 28}ms`;

    const tileStyle = {
      width: size,
      height: size,
      left: tile.x - radius,
      top: tile.y - radius,
      fontSize: Math.round(radius * 0.88),
      '--shake-dx': `${sDx}px`,
      '--shake-dy': `${sDy}px`,
      '--shake-rot': `${sRot}deg`,
      animationDelay: isShaking ? sDelay : undefined,
    } as React.CSSProperties;

    return (
      <div
        className={`ens-gridit-tile ${isSelected ? 'is-selected' : ''} ${
          isHinted ? 'is-hinted' : ''
        } ${isPaused ? 'is-masked' : ''} ${isShaking ? 'is-shaking' : ''} ${
          isEmptySlot ? 'is-empty' : ''
        } ${isAuthored ? 'is-authored' : ''} ${
          isActiveEditorTile ? 'is-editor-focus' : ''
        } ${isRainbow ? 'is-rainbow' : ''} ${isGolden ? 'is-golden' : ''} ${
          tile.addedAtRing ? 'is-newly-grown' : ''
        }`}
        style={tileStyle}
        data-tile-id={tile.id}
        data-rotation-deg={tile.rotationDeg ?? 0}
        aria-label={
          isPaused
            ? 'Hidden die'
            : isEmptySlot
              ? 'Empty tile slot'
              : isRainbow
                ? `Rainbow Wildcard die (${letterUpper})`
                : `Letter ${letterUpper}`
        }
      >
        <div className="ens-gridit-die-cube">
          <div className="ens-gridit-die-face">
            <span className="ens-gridit-tile-gloss" aria-hidden="true" />
            <span
              className="ens-gridit-die-letter-wrap"
              style={{
                transform: isPaused || isEmptySlot ? undefined : `rotate(${baseRot}deg)`,
              }}
            >
              {isPaused ? (
                <span className="ens-gridit-tile-letter">?</span>
              ) : isEmptySlot ? (
                <span className="ens-gridit-tile-empty-dot">·</span>
              ) : isRainbow ? (
                <span className="ens-gridit-rainbow-glyph" title="Wildcard A-Z">
                  <Sparkles size={Math.round(radius * 0.72)} strokeWidth={2.6} />
                </span>
              ) : (
                <>
                  <span className="ens-gridit-tile-letter">{letterUpper}</span>
                  {showOrientBar && <span className="ens-gridit-die-dot" aria-hidden="true" />}
                </>
              )}
            </span>
          </div>
        </div>

        {isGolden && !isPaused && !isEmptySlot && (
          <span className="ens-gridit-mod-badge is-golden" aria-hidden="true">
            <Crown size={9} fill="#fef08a" />
            2×
          </span>
        )}
        {isRainbow && !isPaused && !isEmptySlot && (
          <span className="ens-gridit-mod-badge is-rainbow" aria-hidden="true">
            ★ WILD
          </span>
        )}

        {isSelected && (
          <span className="ens-gridit-tile-order" aria-hidden="true">
            {selectedIndex + 1}
          </span>
        )}
      </div>
    );
  }
);
GridItTileNodeView.displayName = 'GridItTileNodeView';

interface CameraState {
  scale: number;
  tx: number;
  ty: number;
}

export const GridItBoardCanvas: React.FC<GridItBoardCanvasProps> = ({
  board,
  selectedPath,
  hintTileId = null,
  paused = false,
  isShaking = false,
  editorMode = false,
  authoredTileIds,
  activeTileId = null,
  activeRainbowIds,
  activeGoldenIds,
  lightningActive = false,
  readOnly = false,
  onTileTap,
  onPathChange,
  onSubmitPath,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 340,
    height: 290,
  });
  const [panMode, setPanMode] = useState(false);

  const fitCamera = useMemo<CameraState>(() => {
    const pad = 12;
    const availW = Math.max(120, viewportSize.width - pad * 2);
    const availH = Math.max(120, viewportSize.height - pad * 2);
    const scaleX = availW / board.bounds.width;
    const scaleY = availH / board.bounds.height;
    const scale = Math.min(1.35, Math.max(0.32, Math.min(scaleX, scaleY)));
    const centerX = (board.bounds.minX + board.bounds.maxX) / 2;
    const centerY = (board.bounds.minY + board.bounds.maxY) / 2;
    return {
      scale,
      tx: viewportSize.width / 2 - centerX * scale,
      ty: viewportSize.height / 2 - centerY * scale,
    };
  }, [board.bounds, viewportSize.width, viewportSize.height]);

  const [camera, setCamera] = useState<CameraState>(fitCamera);
  const cameraRef = useRef<CameraState>(camera);
  cameraRef.current = camera;

  // Automatically fit the full board whenever board identity or viewport dimensions change
  useEffect(() => {
    setCamera(fitCamera);
  }, [board.id, fitCamera]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tileMap = useMemo(() => {
    const map = new Map<string, GridItTileNode>();
    for (const t of board.tiles) map.set(t.id, t);
    return map;
  }, [board.tiles]);

  const selectedIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    selectedPath.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [selectedPath]);

  const selectedPathRef = useRef<string[]>(selectedPath);
  selectedPathRef.current = selectedPath;

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
  } | null>(null);
  const singleModeRef = useRef<'none' | 'pan' | 'trace'>('none');
  const lastSinglePosRef = useRef<{ x: number; y: number } | null>(null);
  const movedAcrossTilesRef = useRef(false);
  const pointerDownTileRef = useRef<string | null>(null);
  const wasLastTileOnDownRef = useRef(false);

  const clampScale = useCallback(
    (s: number) => Math.min(fitCamera.scale * 3.4, Math.max(fitCamera.scale * 0.85, s)),
    [fitCamera.scale]
  );

  const clampCamera = useCallback(
    (cam: CameraState): CameraState => {
      const scale = clampScale(cam.scale);
      const boardCenterX = (board.bounds.minX + board.bounds.maxX) / 2;
      const boardCenterY = (board.bounds.minY + board.bounds.maxY) / 2;
      const maxOffsetX = Math.max(120, (board.bounds.width * scale) / 2 + viewportSize.width * 0.28);
      const maxOffsetY = Math.max(120, (board.bounds.height * scale) / 2 + viewportSize.height * 0.28);
      const idealTx = viewportSize.width / 2 - boardCenterX * scale;
      const idealTy = viewportSize.height / 2 - boardCenterY * scale;
      return {
        scale,
        tx: Math.max(idealTx - maxOffsetX, Math.min(idealTx + maxOffsetX, cam.tx)),
        ty: Math.max(idealTy - maxOffsetY, Math.min(idealTy + maxOffsetY, cam.ty)),
      };
    },
    [board.bounds, clampScale, viewportSize.height, viewportSize.width]
  );

  const zoomAtScreenPoint = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      setCamera((prev) => {
        const nextScale = clampScale(prev.scale * factor);
        const bx = (sx - prev.tx) / prev.scale;
        const by = (sy - prev.ty) / prev.scale;
        return clampCamera({
          scale: nextScale,
          tx: sx - bx * nextScale,
          ty: sy - by * nextScale,
        });
      });
    },
    [clampCamera, clampScale]
  );

  const screenToBoard = useCallback((clientX: number, clientY: number) => {
    const el = viewportRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: (clientX - rect.left - cam.tx) / cam.scale,
      y: (clientY - rect.top - cam.ty) / cam.scale,
    };
  }, []);

  const hitTestTile = useCallback(
    (bx: number, by: number, radiusFactor: number): GridItTileNode | null => {
      const maxR = board.tileRadius * radiusFactor;
      let best: GridItTileNode | null = null;
      let bestDist = maxR;
      for (const tile of board.tiles) {
        const d = Math.hypot(bx - tile.x, by - tile.y);
        if (d <= bestDist) {
          bestDist = d;
          best = tile;
        }
      }
      return best;
    },
    [board.tileRadius, board.tiles]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (paused || isShaking || readOnly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      // Switching to pinch/two-finger pan immediately cancels any active drag trace
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      pinchStateRef.current = {
        dist,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
      singleModeRef.current = 'none';
      movedAcrossTilesRef.current = false;
      pointerDownTileRef.current = null;
      if (selectedPathRef.current.length > 0) {
        onPathChange([]);
      }
      return;
    }

    lastSinglePosRef.current = { x: e.clientX, y: e.clientY };

    const isPanInteraction = panMode || e.button === 1 || e.button === 2 || e.shiftKey;
    if (isPanInteraction) {
      singleModeRef.current = 'pan';
      return;
    }

    const bPos = screenToBoard(e.clientX, e.clientY);
    const hit = hitTestTile(bPos.x, bPos.y, 0.88);
    if (!hit) {
      singleModeRef.current = 'pan';
      return;
    }

    singleModeRef.current = 'trace';
    movedAcrossTilesRef.current = false;
    pointerDownTileRef.current = hit.id;

    const current = selectedPathRef.current;
    wasLastTileOnDownRef.current = current.length > 0 && hit.id === current[current.length - 1];
    if (current.length === 0) {
      onPathChange([hit.id]);
    } else {
      const lastId = current[current.length - 1];
      const lastTile = tileMap.get(lastId);
      if (hit.id === lastId) {
        // Keep current path on pointerDown so dragging can extend, or tap release pops it
      } else if (
        current.length >= 2 &&
        hit.id === current[current.length - 2]
      ) {
        onPathChange(current.slice(0, -1));
      } else if (!current.includes(hit.id) && lastTile?.neighbors.includes(hit.id)) {
        onPathChange([...current, hit.id]);
      } else {
        // Start a brand-new word trace from this tile
        onPathChange([hit.id]);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchStateRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const newDist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const newMidX = (pts[0].x + pts[1].x) / 2;
      const newMidY = (pts[0].y + pts[1].y) / 2;

      const prevPinch = pinchStateRef.current;
      const factor = newDist / prevPinch.dist;
      const dx = newMidX - prevPinch.midX;
      const dy = newMidY - prevPinch.midY;

      const el = viewportRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const localX = newMidX - rect.left;
        const localY = newMidY - rect.top;
        setCamera((prev) => {
          const nextScale = clampScale(prev.scale * factor);
          const bx = (localX - dx - prev.tx) / prev.scale;
          const by = (localY - dy - prev.ty) / prev.scale;
          return clampCamera({
            scale: nextScale,
            tx: localX - bx * nextScale,
            ty: localY - by * nextScale,
          });
        });
      }
      pinchStateRef.current = { dist: newDist, midX: newMidX, midY: newMidY };
      return;
    }

    if (pointersRef.current.size === 1 && singleModeRef.current === 'pan' && lastSinglePosRef.current) {
      const dx = e.clientX - lastSinglePosRef.current.x;
      const dy = e.clientY - lastSinglePosRef.current.y;
      lastSinglePosRef.current = { x: e.clientX, y: e.clientY };
      setCamera((prev) => clampCamera({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }));
      return;
    }

    if (pointersRef.current.size === 1 && singleModeRef.current === 'trace') {
      const bPos = screenToBoard(e.clientX, e.clientY);
      const hit = hitTestTile(bPos.x, bPos.y, 0.8);
      if (!hit) return;

      const current = selectedPathRef.current;
      if (current.length === 0) {
        onPathChange([hit.id]);
        return;
      }

      const lastId = current[current.length - 1];
      if (hit.id === lastId) return;

      // Backtrack to penultimate tile smoothly
      if (current.length >= 2 && hit.id === current[current.length - 2]) {
        movedAcrossTilesRef.current = true;
        onPathChange(current.slice(0, -1));
        return;
      }

      // Append valid unvisited neighbor
      const lastTile = tileMap.get(lastId);
      if (!current.includes(hit.id) && lastTile?.neighbors.includes(hit.id)) {
        movedAcrossTilesRef.current = true;
        onPathChange([...current, hit.id]);
      }
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (pointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }

    if (pointersRef.current.size === 0) {
      if (singleModeRef.current === 'trace') {
        const path = selectedPathRef.current;
        if (!movedAcrossTilesRef.current && pointerDownTileRef.current && onTileTap) {
          onTileTap(pointerDownTileRef.current);
        }
        if (movedAcrossTilesRef.current && path.length >= 2 && !editorMode) {
          onSubmitPath(path);
        } else if (!movedAcrossTilesRef.current && wasLastTileOnDownRef.current && path.length >= 1) {
          onPathChange(path.slice(0, -1));
        }
      }
      singleModeRef.current = 'none';
      lastSinglePosRef.current = null;
      movedAcrossTilesRef.current = false;
      pointerDownTileRef.current = null;
      wasLastTileOnDownRef.current = false;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zoomAtScreenPoint(e.clientX, e.clientY, factor);
  };

  const selectedPointsString = useMemo(() => {
    return selectedPath
      .map((id) => tileMap.get(id))
      .filter((t): t is GridItTileNode => Boolean(t))
      .map((t) => `${t.x},${t.y}`)
      .join(' ');
  }, [selectedPath, tileMap]);

  const zoomPercent = Math.round((camera.scale / fitCamera.scale) * 100);

  return (
    <div
      ref={viewportRef}
      className={`ens-gridit-board-viewport ${panMode ? 'is-pan-mode' : ''} ${
        lightningActive ? 'is-lightning-active' : ''
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      role="application"
      aria-label="GridIt interactive letter board"
    >
      <div
        className={`ens-gridit-board-world ${isShaking ? 'is-shaking-world' : ''}`}
        style={{
          transform: `translate3d(${camera.tx}px, ${camera.ty}px, 0) scale(${camera.scale})`,
        }}
      >
        {/* Glowing Board Backdrop Aura */}
        <div
          className="ens-gridit-board-aura"
          style={{
            left: board.bounds.minX - 18,
            top: board.bounds.minY - 18,
            width: board.bounds.width + 36,
            height: board.bounds.height + 36,
          }}
          aria-hidden="true"
        />

        {/* Shape-Matching Physical Board Tray */}
        <PhysicalBoardTraySvg board={board} />

        {/* Selected Path Connector Beam */}
        {selectedPath.length >= 2 && !paused && (
          <svg
            className="ens-gridit-path-svg"
            style={{
              left: board.bounds.minX,
              top: board.bounds.minY,
              width: board.bounds.width,
              height: board.bounds.height,
            }}
            viewBox={`${board.bounds.minX} ${board.bounds.minY} ${board.bounds.width} ${board.bounds.height}`}
            aria-hidden="true"
          >
            <polyline
              points={selectedPointsString}
              fill="none"
              stroke="rgba(253, 224, 71, 0.92)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={selectedPointsString}
              fill="none"
              stroke="#ffffff"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Tactile 3D Physical Letter Dice */}
        {board.tiles.map((tile, idx) => {
          const isEmptySlot = !tile.letter || tile.letter.trim().length === 0;
          const isRainbow =
            activeRainbowIds?.has(tile.id) || tile.modifier?.type === 'rainbow';
          const isGolden =
            activeGoldenIds?.has(tile.id) || tile.modifier?.type === 'golden';
          return (
            <GridItTileNodeView
              key={tile.id}
              tile={tile}
              tileIndex={idx}
              radius={board.tileRadius}
              selectedIndex={selectedIndexMap.get(tile.id) ?? -1}
              isHinted={hintTileId === tile.id}
              isPaused={paused}
              isShaking={isShaking}
              isEmptySlot={isEmptySlot}
              isAuthored={Boolean(authoredTileIds?.has(tile.id))}
              isActiveEditorTile={activeTileId === tile.id}
              isRainbow={Boolean(isRainbow)}
              isGolden={Boolean(isGolden)}
            />
          );
        })}
      </div>

      {isShaking && !paused && (
        <div className="ens-gridit-shake-banner" role="status" aria-live="polite">
          <Sparkles size={15} color="#fde047" />
          <span>Shaking Letter Dice...</span>
        </div>
      )}

      {/* Bottom-Left Pan Toggle & Gesture Hint */}
      <div
        className="ens-gridit-canvas-left-tools"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`ens-gridit-cam-btn ${panMode ? 'is-active' : ''}`}
          onClick={() => setPanMode((p) => !p)}
          title={panMode ? 'Switch back to word tracing' : 'Drag to pan board'}
          aria-label="Toggle board pan mode"
          aria-pressed={panMode}
        >
          <Hand size={15} />
        </button>
        <span className="ens-gridit-gesture-hint">
          {readOnly
            ? 'Spectator • Pinch/drag to inspect'
            : panMode
              ? 'Pan mode • Drag board'
              : editorMode
                ? 'Trace path • Place word'
                : 'Pinch zoom • Drag trace'}
        </span>
      </div>

      {/* Bottom-Right Zoom & Fit Reset Controls */}
      <div
        className="ens-gridit-canvas-right-tools"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="ens-gridit-zoom-badge">{zoomPercent}%</span>
        <button
          type="button"
          className="ens-gridit-cam-btn"
          onClick={() => {
            const el = viewportRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            zoomAtScreenPoint(r.left + r.width / 2, r.top + r.height / 2, 1.22);
          }}
          aria-label="Zoom in"
        >
          <Plus size={15} strokeWidth={2.8} />
        </button>
        <button
          type="button"
          className="ens-gridit-cam-btn"
          onClick={() => {
            const el = viewportRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            zoomAtScreenPoint(r.left + r.width / 2, r.top + r.height / 2, 0.82);
          }}
          aria-label="Zoom out"
        >
          <Minus size={15} strokeWidth={2.8} />
        </button>
        <button
          type="button"
          className="ens-gridit-cam-btn"
          onClick={() => setCamera(fitCamera)}
          aria-label="Reset full board fit"
          title="Fit full board"
        >
          <Maximize2 size={14} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
};
