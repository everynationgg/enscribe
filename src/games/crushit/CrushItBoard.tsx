import React, { useCallback, useMemo, useRef } from 'react';
import { isAdjacentCoord } from '../../../shared/crushit/engine';
import { getLetterBasePoints } from '../../../shared/crushit/letterConfig';
import {
  BoardCoord,
  CrushItBoardGrid,
  DestroyedTileInfo,
  PowerUpActivationRecord,
  TileColor,
  TilePowerUp,
} from '../../../shared/crushit/types';

export interface ActiveTurnFx {
  id: string;
  activations: PowerUpActivationRecord[];
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
  illuminatedCoordKeys: Set<string>;
  destroyingCoordKeys: Set<string>;
  fallAnimationKey: number;
  activeTurnFx: ActiveTurnFx | null;
  onPathChange: (nextPath: BoardCoord[], action: 'select' | 'undo' | 'start') => void;
}

const SPARK_COLORS: Record<TileColor, string> = {
  pink: '#ff70c8',
  blue: '#5cc8ff',
  green: '#4ef2a8',
  gold: '#ffe970',
};

function getPowerUpTileClass(powerUp?: TilePowerUp | null): string {
  if (!powerUp) return '';
  switch (powerUp.type) {
    case 'line_blast':
      return powerUp.orientation === 'col' ? 'ci6-tile--pu-line-col' : 'ci6-tile--pu-line-row';
    case 'cross_blast':
      return 'ci6-tile--pu-cross';
    case 'word_bomb':
      return 'ci6-tile--pu-bomb';
    case 'letter_purge':
      return 'ci6-tile--pu-purge';
    case 'mega_blast':
      return 'ci6-tile--pu-mega';
  }
}

function renderPowerUpChrome(powerUp?: TilePowerUp | null) {
  if (!powerUp) return null;
  switch (powerUp.type) {
    case 'line_blast':
      return powerUp.orientation === 'col' ? (
        <>
          <span className="ci6-pu-flow-col" aria-hidden="true" />
          <span className="ci6-pu-arrow ci6-pu-arrow--up" aria-hidden="true" />
          <span className="ci6-pu-arrow ci6-pu-arrow--down" aria-hidden="true" />
        </>
      ) : (
        <>
          <span className="ci6-pu-flow-row" aria-hidden="true" />
          <span className="ci6-pu-arrow ci6-pu-arrow--left" aria-hidden="true" />
          <span className="ci6-pu-arrow ci6-pu-arrow--right" aria-hidden="true" />
        </>
      );
    case 'cross_blast':
      return (
        <>
          <span className="ci6-pu-cross-pulse" aria-hidden="true" />
          <span className="ci6-pu-arrow ci6-pu-arrow--up" aria-hidden="true" />
          <span className="ci6-pu-arrow ci6-pu-arrow--down" aria-hidden="true" />
          <span className="ci6-pu-arrow ci6-pu-arrow--left" aria-hidden="true" />
          <span className="ci6-pu-arrow ci6-pu-arrow--right" aria-hidden="true" />
        </>
      );
    case 'word_bomb':
      return <span className="ci6-pu-bomb-ring" aria-hidden="true" />;
    case 'letter_purge':
      return <span className="ci6-pu-purge-orbit" aria-hidden="true" />;
    case 'mega_blast':
      return (
        <>
          <span className="ci6-pu-mega-star" aria-hidden="true" />
          <span className="ci6-pu-mega-core" aria-hidden="true" />
        </>
      );
  }
}

export const CrushItBoard: React.FC<CrushItBoardProps> = ({
  board,
  selectedPath,
  isValidWord,
  hasPowerUpReward,
  isLocked,
  isReshuffling,
  illuminatedCoordKeys,
  destroyingCoordKeys,
  fallAnimationKey,
  activeTurnFx,
  onPathChange,
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

    onPathChange([coord], 'start');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked || !draggingRef.current || activePointerIdRef.current !== e.pointerId) return;

    const coord = hitTestCell(e.clientX, e.clientY, 0.82);
    if (!coord) return;

    const current = pathRef.current;
    if (current.length === 0) {
      onPathChange([coord], 'start');
      return;
    }

    const last = current[current.length - 1];
    if (last.row === coord.row && last.col === coord.col) return;

    if (current.length >= 2) {
      const prev = current[current.length - 2];
      if (prev.row === coord.row && prev.col === coord.col) {
        didExtendDuringDragRef.current = true;
        onPathChange(current.slice(0, -1), 'undo');
        return;
      }
    }

    if (current.some((c) => c.row === coord.row && c.col === coord.col)) {
      return;
    }

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
      tappedLastOnDownRef.current &&
      !didExtendDuringDragRef.current &&
      pathRef.current.length > 0
    ) {
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
    if (!activeTurnFx) return [];
    const list: Array<{
      key: string;
      left: string;
      top: string;
      dx: string;
      dy: string;
      color: string;
    }> = [];
    const sample = activeTurnFx.destroyedTiles.slice(0, 18);
    sample.forEach((dt, idx) => {
      const leftPct = ((dt.col + 0.5) / boardSize) * 100;
      const topPct = ((dt.row + 0.5) / boardSize) * 100;
      const baseColor = dt.hadPowerUp ? '#fde047' : SPARK_COLORS[dt.color] || '#ffffff';
      const count = sample.length > 10 ? 2 : 3;
      for (let s = 0; s < count; s++) {
        const angle = ((idx * 137.5 + s * (360 / count)) * Math.PI) / 180;
        const dist = 22 + ((idx * 17 + s * 13) % 24);
        list.push({
          key: `${activeTurnFx.id}_${dt.id}_${s}`,
          left: `${leftPct.toFixed(2)}%`,
          top: `${topPct.toFixed(2)}%`,
          dx: `${Math.round(Math.cos(angle) * dist)}px`,
          dy: `${Math.round(Math.sin(angle) * dist)}px`,
          color: baseColor,
        });
      }
    });
    return list;
  }, [activeTurnFx, boardSize]);

  return (
    <div className="ci6-board-stage">
      <div
        className={`ci6-board-frame ${isReshuffling ? 'is-reshuffling' : ''}`}
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
              const isIlluminated = illuminatedCoordKeys.has(coordKey);
              const isDestroying = destroyingCoordKeys.has(coordKey);
              const shouldFall = fallAnimationKey > 0 && tile.fallDistance > 0 && !isDestroying;
              const isJustBornPu =
                fallAnimationKey > 0 && Boolean(tile.justCreatedPowerUp) && !isDestroying;
              const tilePts = getLetterBasePoints(tile.letter);
              const showRarePts = !tile.powerUp && (tile.color === 'gold' || tile.color === 'green');
              const puClass = getPowerUpTileClass(tile.powerUp);

              const style = shouldFall
                ? ({
                    '--fall-rows': tile.fallDistance,
                    '--spawn-opacity': tile.isNew ? 0.35 : 1,
                    animationDelay: `${Math.min(cIdx * 14 + (boardSize - 1 - rIdx) * 9, 110)}ms`,
                  } as React.CSSProperties)
                : undefined;

              return (
                <div
                  key={`${tile.id}_${shouldFall || isJustBornPu ? fallAnimationKey : 0}`}
                  className={[
                    'ci6-tile',
                    puClass || `ci6-tile--${tile.color}`,
                    isSelected ? 'is-selected' : '',
                    isSelected && isValidWord ? 'is-valid-chain' : '',
                    isSelected && hasPowerUpReward ? 'is-powerup-chain' : '',
                    isIlluminated ? 'is-illuminated' : '',
                    isDestroying ? 'is-destroying' : '',
                    shouldFall ? 'is-falling' : '',
                    isJustBornPu && !shouldFall ? 'is-pu-born' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={style}
                  data-row={rIdx}
                  data-col={cIdx}
                  data-letter={tile.letter}
                  data-color={tile.color}
                  data-powerup={tile.powerUp?.type ?? ''}
                  data-orientation={tile.powerUp?.orientation ?? ''}
                >
                  {renderPowerUpChrome(tile.powerUp)}
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

          {svgPoints && (
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

        {/* Distinct Power-Up Activation FX, Purge Tethers, Chain Arcs & Floating Score */}
        {activeTurnFx && (
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

            {/* SVG energy tethers for Letter Purge & Chain Reactions */}
            <svg
              className="ci6-fx-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {activeTurnFx.activations.map((act, idx) => {
                const x1 = ((act.col + 0.5) / boardSize) * 100;
                const y1 = ((act.row + 0.5) / boardSize) * 100;
                const delay = `${act.chainDepth * 70}ms`;

                return (
                  <React.Fragment key={`svg_${act.tileId}_${idx}`}>
                    {act.triggeredBy && (
                      <line
                        x1={((act.triggeredBy.col + 0.5) / boardSize) * 100}
                        y1={((act.triggeredBy.row + 0.5) / boardSize) * 100}
                        x2={x1}
                        y2={y1}
                        className="ci6-chain-arc"
                        style={{ animationDelay: delay }}
                      />
                    )}
                    {act.type === 'letter_purge' &&
                      act.affectedCoords.map((ac, acIdx) => (
                        <line
                          key={`pt_${acIdx}`}
                          x1={x1}
                          y1={y1}
                          x2={((ac.col + 0.5) / boardSize) * 100}
                          y2={((ac.row + 0.5) / boardSize) * 100}
                          className="ci6-purge-tether"
                          style={{ animationDelay: delay }}
                        />
                      ))}
                  </React.Fragment>
                );
              })}
            </svg>

            {/* Row/Col Beams & Radial/Mega Shockwaves for every activated power-up */}
            {activeTurnFx.activations.map((act, idx) => {
              const leftPct = `${((act.col + 0.5) / boardSize) * 100}%`;
              const topPct = `${((act.row + 0.5) / boardSize) * 100}%`;
              const delay = `${act.chainDepth * 75}ms`;
              return (
                <React.Fragment key={`fx_${act.tileId}_${idx}`}>
                  {((act.type === 'line_blast' && (act.orientation ?? 'row') === 'row') ||
                    act.type === 'cross_blast') && (
                    <div
                      className={`ci6-beam-h ${act.type === 'cross_blast' ? 'is-violet' : ''}`}
                      style={{
                        left: 0,
                        right: 0,
                        top: topPct,
                        height: '11%',
                        transform: 'translateY(-50%)',
                        animationDelay: delay,
                      }}
                    />
                  )}
                  {((act.type === 'line_blast' && act.orientation === 'col') ||
                    act.type === 'cross_blast') && (
                    <div
                      className={`ci6-beam-v ${act.type === 'cross_blast' ? 'is-violet' : ''}`}
                      style={{
                        top: 0,
                        bottom: 0,
                        left: leftPct,
                        width: '11%',
                        transform: 'translateX(-50%)',
                        animationDelay: delay,
                      }}
                    />
                  )}
                  {(act.type === 'word_bomb' || act.type === 'mega_blast') && (
                    <div
                      className={`ci6-blast-wave ${act.type === 'mega_blast' ? 'is-mega' : ''}`}
                      style={
                        {
                          left: leftPct,
                          top: topPct,
                          '--wave-size': act.type === 'mega_blast' ? '310px' : '190px',
                          animationDelay: delay,
                        } as React.CSSProperties
                      }
                    />
                  )}
                </React.Fragment>
              );
            })}

            {activeTurnFx.scoreGained > 0 && (
              <div
                key={`score_${activeTurnFx.id}`}
                className="ci6-float-score"
                style={{
                  left: `${Math.min(82, Math.max(18, ((activeTurnFx.centroidCol + 0.5) / boardSize) * 100))}%`,
                  top: `${Math.min(82, Math.max(18, ((activeTurnFx.centroidRow + 0.5) / boardSize) * 100))}%`,
                }}
              >
                +{activeTurnFx.scoreGained.toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
