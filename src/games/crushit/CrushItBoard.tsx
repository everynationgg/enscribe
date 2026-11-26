import React, { useCallback, useMemo, useRef } from 'react';
import { isAdjacentCoord } from '../../../shared/crushit/engine';
import { getLetterBasePoints } from '../../../shared/crushit/letterConfig';
import {
  BoardCoord,
  CrushItBoardGrid,
  DestroyedTileInfo,
  PowerUpType,
  TileColor,
} from '../../../shared/crushit/types';

export interface ActiveBlastFx {
  id: string;
  kind: 'word' | 'powerup';
  powerUpType?: PowerUpType;
  targetCoord?: BoardCoord;
  orientation?: 'row' | 'col';
  destroyedTiles: DestroyedTileInfo[];
  scoreGained: number;
  centroidRow: number;
  centroidCol: number;
}

interface CrushItBoardProps {
  board: CrushItBoardGrid;
  selectedPath: BoardCoord[];
  isValidWord: boolean;
  hasPowerUpReward: boolean;
  isLocked: boolean;
  isReshuffling: boolean;
  destroyingCoordKeys: Set<string>;
  fallAnimationKey: number;
  activePowerUp: PowerUpType | null;
  powerUpPreviewCoords: BoardCoord[];
  powerUpTargetCoord: BoardCoord | null;
  activeBlastFx: ActiveBlastFx | null;
  bannerText: string | null;
  onPathChange: (nextPath: BoardCoord[], action: 'select' | 'undo' | 'start') => void;
  onSelectPowerUpTarget: (coord: BoardCoord) => void;
}

const SPARK_COLORS: Record<TileColor, string> = {
  pink: '#ff70c8',
  blue: '#5cc8ff',
  green: '#4ef2a8',
  gold: '#ffe970',
};

export const CrushItBoard: React.FC<CrushItBoardProps> = ({
  board,
  selectedPath,
  isValidWord,
  hasPowerUpReward,
  isLocked,
  isReshuffling,
  destroyingCoordKeys,
  fallAnimationKey,
  activePowerUp,
  powerUpPreviewCoords,
  powerUpTargetCoord,
  activeBlastFx,
  bannerText,
  onPathChange,
  onSelectPowerUpTarget,
}) => {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pathRef = useRef<BoardCoord[]>(selectedPath);
  pathRef.current = selectedPath;
  const didExtendDuringDragRef = useRef(false);
  const tappedLastOnDownRef = useRef(false);

  const boardSize = board.length || 8;

  const selectedIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    selectedPath.forEach((c, idx) => map.set(`${c.row},${c.col}`, idx));
    return map;
  }, [selectedPath]);

  const previewSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of powerUpPreviewCoords) {
      set.add(`${c.row},${c.col}`);
    }
    return set;
  }, [powerUpPreviewCoords]);

  const hitTestCell = useCallback(
    (clientX: number, clientY: number, innerRadiusFactor: number): BoardCoord | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      const rx = clientX - rect.left;
      const ry = clientY - rect.top;
      if (rx < 0 || ry < 0 || rx > rect.width || ry > rect.height) return null;

      const cellW = rect.width / boardSize;
      const cellH = rect.height / boardSize;
      const col = Math.min(boardSize - 1, Math.max(0, Math.floor(rx / cellW)));
      const row = Math.min(boardSize - 1, Math.max(0, Math.floor(ry / cellH)));

      if (innerRadiusFactor < 1) {
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        const dist = Math.hypot(rx - cx, ry - cy);
        const maxDist = Math.min(cellW, cellH) * 0.5 * innerRadiusFactor;
        if (dist > maxDist) return null;
      }

      return { row, col };
    },
    [boardSize]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const coord = hitTestCell(e.clientX, e.clientY, 1.0);
    if (!coord) return;

    // Power-up targeting mode: tap or hover-drag aims the blast
    if (activePowerUp) {
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerIdRef.current = e.pointerId;
      draggingRef.current = true;
      onSelectPowerUpTarget(coord);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;
    draggingRef.current = true;
    didExtendDuringDragRef.current = false;

    const current = pathRef.current;
    const last = current[current.length - 1];
    const prev = current.length >= 2 ? current[current.length - 2] : null;
    tappedLastOnDownRef.current = Boolean(last && last.row === coord.row && last.col === coord.col);

    if (current.length === 0) {
      onPathChange([coord], 'start');
      return;
    }

    if (last && last.row === coord.row && last.col === coord.col) {
      // Allow continuing swipe from last tile, or tapping it to undo on pointerUp
      return;
    }

    if (prev && prev.row === coord.row && prev.col === coord.col) {
      onPathChange(current.slice(0, -1), 'undo');
      didExtendDuringDragRef.current = true;
      return;
    }

    const alreadyInPath = current.some((c) => c.row === coord.row && c.col === coord.col);
    if (!alreadyInPath && last && isAdjacentCoord(last, coord)) {
      onPathChange([...current, coord], 'select');
      didExtendDuringDragRef.current = true;
      return;
    }

    // Starting a new swipe path on a non-adjacent tile seamlessly starts fresh
    onPathChange([coord], 'start');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked || !draggingRef.current || activePointerIdRef.current !== e.pointerId) return;

    if (activePowerUp) {
      const target = hitTestCell(e.clientX, e.clientY, 0.96);
      if (
        target &&
        (!powerUpTargetCoord ||
          powerUpTargetCoord.row !== target.row ||
          powerUpTargetCoord.col !== target.col)
      ) {
        onSelectPowerUpTarget(target);
      }
      return;
    }

    // Inner circular hit radius (0.82 of half-cell = 41% of cell size) keeps diagonal swipes super accurate
    const coord = hitTestCell(e.clientX, e.clientY, 0.82);
    if (!coord) return;

    const current = pathRef.current;
    if (current.length === 0) {
      onPathChange([coord], 'start');
      return;
    }

    const last = current[current.length - 1];
    if (last.row === coord.row && last.col === coord.col) return;

    // Reverse swipe onto previous tile undoes the last letter
    if (current.length >= 2) {
      const prev = current[current.length - 2];
      if (prev.row === coord.row && prev.col === coord.col) {
        didExtendDuringDragRef.current = true;
        onPathChange(current.slice(0, -1), 'undo');
        return;
      }
    }

    // Prevent reusing any tile already in the path
    if (current.some((c) => c.row === coord.row && c.col === coord.col)) {
      return;
    }

    // Only allow 8-directional adjacent tiles
    if (isAdjacentCoord(last, coord)) {
      didExtendDuringDragRef.current = true;
      onPathChange([...current, coord], 'select');
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (
      !activePowerUp &&
      tappedLastOnDownRef.current &&
      !didExtendDuringDragRef.current &&
      pathRef.current.length > 0
    ) {
      // Simple tap on the last selected tile pops it
      onPathChange(pathRef.current.slice(0, -1), 'undo');
    }

    draggingRef.current = false;
    activePointerIdRef.current = null;
    tappedLastOnDownRef.current = false;
    didExtendDuringDragRef.current = false;
  };

  const svgPoints = useMemo(() => {
    if (selectedPath.length < 2) return '';
    return selectedPath
      .map((c) => {
        const x = ((c.col + 0.5) / boardSize) * 100;
        const y = ((c.row + 0.5) / boardSize) * 100;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [boardSize, selectedPath]);

  const beamColor = hasPowerUpReward ? '#fde047' : isValidWord ? '#34d399' : '#38bdf8';

  const sparkParticles = useMemo(() => {
    if (!activeBlastFx) return [];
    const list: Array<{
      key: string;
      left: string;
      top: string;
      dx: string;
      dy: string;
      color: string;
    }> = [];
    const sample = activeBlastFx.destroyedTiles.slice(0, 16);
    sample.forEach((dt, idx) => {
      const leftPct = ((dt.col + 0.5) / boardSize) * 100;
      const topPct = ((dt.row + 0.5) / boardSize) * 100;
      const baseColor = SPARK_COLORS[dt.color] || '#ffffff';
      const count = sample.length > 10 ? 2 : 3;
      for (let s = 0; s < count; s++) {
        const angle = ((idx * 137.5 + s * (360 / count)) * Math.PI) / 180;
        const dist = 22 + ((idx * 17 + s * 13) % 22);
        list.push({
          key: `${activeBlastFx.id}_${dt.id}_${s}`,
          left: `${leftPct.toFixed(2)}%`,
          top: `${topPct.toFixed(2)}%`,
          dx: `${Math.round(Math.cos(angle) * dist)}px`,
          dy: `${Math.round(Math.sin(angle) * dist)}px`,
          color: baseColor,
        });
      }
    });
    return list;
  }, [activeBlastFx, boardSize]);

  return (
    <div className="ci6-board-stage">
      <div
        className={`ci6-board-frame ${activePowerUp ? 'is-targeting' : ''} ${
          isReshuffling ? 'is-reshuffling' : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        role="application"
        aria-label="CrushIt 8 by 8 letter board"
      >
        <div ref={gridRef} className="ci6-board-grid">
          {board.map((rowArr, rIdx) =>
            rowArr.map((tile, cIdx) => {
              const coordKey = `${rIdx},${cIdx}`;
              const isSelected = selectedIndexMap.has(coordKey);
              const isDestroying = destroyingCoordKeys.has(coordKey);
              const isBlastPreview = Boolean(activePowerUp && previewSet.has(coordKey));
              const isBlastCenter = Boolean(
                activePowerUp &&
                  powerUpTargetCoord &&
                  powerUpTargetCoord.row === rIdx &&
                  powerUpTargetCoord.col === cIdx
              );
              const shouldFall = fallAnimationKey > 0 && tile.fallDistance > 0 && !isDestroying;
              const tilePts = getLetterBasePoints(tile.letter);
              const showRarePts = tile.color === 'gold' || tile.color === 'green';

              const style = shouldFall
                ? ({
                    '--fall-rows': tile.fallDistance,
                    '--spawn-opacity': tile.isNew ? 0.35 : 1,
                    animationDelay: `${Math.min(cIdx * 16 + (boardSize - 1 - rIdx) * 10, 120)}ms`,
                  } as React.CSSProperties)
                : undefined;

              return (
                <div
                  key={`${tile.id}_${shouldFall ? fallAnimationKey : 0}`}
                  className={[
                    'ci6-tile',
                    `ci6-tile--${tile.color}`,
                    isSelected ? 'is-selected' : '',
                    isSelected && isValidWord ? 'is-valid-chain' : '',
                    isSelected && hasPowerUpReward ? 'is-powerup-chain' : '',
                    isBlastPreview ? 'is-blast-preview' : '',
                    isBlastCenter ? 'is-blast-center' : '',
                    isDestroying ? 'is-destroying' : '',
                    shouldFall ? 'is-falling' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={style}
                  data-row={rIdx}
                  data-col={cIdx}
                  data-letter={tile.letter}
                  data-color={tile.color}
                >
                  <span className="ci6-tile-letter">{tile.letter}</span>
                  {showRarePts && (
                    <span className="ci6-tile-pts" aria-hidden="true">
                      {tilePts}
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* Smooth glowing swipe path */}
          {svgPoints && !activePowerUp && (
            <svg
              className="ci6-path-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points={svgPoints}
                className="ci6-path-glow"
                style={{ stroke: beamColor, color: beamColor }}
              />
              <polyline points={svgPoints} className="ci6-path-core" />
            </svg>
          )}
        </div>

        {/* Destruction sparks, power-up beams/shockwaves & floating score */}
        {activeBlastFx && (
          <div className="ci6-fx-layer" aria-hidden="true">
            {sparkParticles.map((sp) => (
              <span
                key={sp.key}
                className="ci6-spark"
                style={
                  {
                    left: sp.left,
                    top: sp.top,
                    background: sp.color,
                    '--dx': sp.dx,
                    '--dy': sp.dy,
                  } as React.CSSProperties
                }
              />
            ))}

            {activeBlastFx.kind === 'powerup' && activeBlastFx.targetCoord && (
              <>
                {(activeBlastFx.powerUpType === 'line_blast' &&
                  (activeBlastFx.orientation ?? 'row') === 'row') ||
                activeBlastFx.powerUpType === 'cross_blast' ||
                activeBlastFx.powerUpType === 'mega_blast' ? (
                  <div
                    className="ci6-beam-h"
                    style={{
                      left: 0,
                      right: 0,
                      top: `${((activeBlastFx.targetCoord.row + 0.5) / boardSize) * 100}%`,
                      height: '11%',
                      transform: 'translateY(-50%)',
                    }}
                  />
                ) : null}

                {(activeBlastFx.powerUpType === 'line_blast' &&
                  activeBlastFx.orientation === 'col') ||
                activeBlastFx.powerUpType === 'cross_blast' ||
                activeBlastFx.powerUpType === 'mega_blast' ? (
                  <div
                    className="ci6-beam-v"
                    style={{
                      top: 0,
                      bottom: 0,
                      left: `${((activeBlastFx.targetCoord.col + 0.5) / boardSize) * 100}%`,
                      width: '11%',
                      transform: 'translateX(-50%)',
                    }}
                  />
                ) : null}

                {(activeBlastFx.powerUpType === 'word_bomb' ||
                  activeBlastFx.powerUpType === 'mega_blast' ||
                  activeBlastFx.powerUpType === 'letter_purge') && (
                  <div
                    className="ci6-blast-wave"
                    style={
                      {
                        left: `${((activeBlastFx.targetCoord.col + 0.5) / boardSize) * 100}%`,
                        top: `${((activeBlastFx.targetCoord.row + 0.5) / boardSize) * 100}%`,
                        '--wave-size':
                          activeBlastFx.powerUpType === 'mega_blast' ? '340px' : '210px',
                      } as React.CSSProperties
                    }
                  />
                )}
              </>
            )}

            {activeBlastFx.scoreGained > 0 && (
              <div
                key={`score_${activeBlastFx.id}`}
                className="ci6-float-score"
                style={{
                  left: `${Math.min(82, Math.max(18, ((activeBlastFx.centroidCol + 0.5) / boardSize) * 100))}%`,
                  top: `${Math.min(82, Math.max(18, ((activeBlastFx.centroidRow + 0.5) / boardSize) * 100))}%`,
                }}
              >
                +{activeBlastFx.scoreGained}
              </div>
            )}
          </div>
        )}

        {bannerText && (
          <div className="ci6-board-banner" role="status" aria-live="polite">
            {bannerText}
          </div>
        )}
      </div>
    </div>
  );
};
