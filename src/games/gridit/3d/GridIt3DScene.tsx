import React, { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { GridItBoard, GridItTileNode } from '../../../../shared/gridit/types';
import { GridIt3DBox } from './GridIt3DBox';
import { GridIt3DCameraController } from './GridIt3DCameraController';
import { GridIt3DDiceCollection } from './GridIt3DDice';
import { GridIt3DShaker, HostShakePayload } from './GridIt3DShaker';
import { GridIt3DWordBeams } from './GridIt3DWordBeams';

interface GridIt3DSceneProps {
  board: GridItBoard;
  selectedPath: string[];
  hintTileId?: string | null;
  paused?: boolean;
  isShaking: boolean;
  isHost?: boolean;
  resetViewTrigger: number;
  rotateCwTrigger: number;
  rotateCcwTrigger: number;
  isLetterSelected?: boolean;
  readOnly?: boolean;
  editorMode?: boolean;
  activeRainbowIds?: Set<string>;
  activeGoldenIds?: Set<string>;
  remoteOrientation?: HostShakePayload | null;
  onEmitOrientation?: (payload: HostShakePayload) => void;
  onShakeSettled?: () => void;
  onTileTap?: (tileId: string) => void;
  onPathChange: (nextPath: string[]) => void;
  onSubmitPath: (path: string[]) => void;
}

export const GridIt3DScene: React.FC<GridIt3DSceneProps> = ({
  board,
  selectedPath,
  hintTileId,
  paused = false,
  isShaking,
  isHost = true,
  resetViewTrigger,
  rotateCwTrigger,
  rotateCcwTrigger,
  isLetterSelected = false,
  readOnly = false,
  editorMode = false,
  activeRainbowIds,
  activeGoldenIds,
  remoteOrientation,
  onEmitOrientation,
  onShakeSettled,
  onTileTap,
  onPathChange,
  onSubmitPath,
}) => {
  const { scene, camera } = useThree();
  if (typeof window !== 'undefined') {
    (window as any).__GRIDIT_3D__ = { scene, camera };
  }
  const tileMap = useMemo(() => {
    const map = new Map<string, GridItTileNode>();
    board.tiles.forEach((t) => map.set(t.id, t));
    return map;
  }, [board.tiles]);

  const selectedIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    selectedPath.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [selectedPath]);

  const selectedPathRef = useRef<string[]>(selectedPath);
  selectedPathRef.current = selectedPath;

  const isDraggingWordRef = useRef(false);
  const pointerDownTileRef = useRef<string | null>(null);
  const movedAcrossTilesRef = useRef(false);

  // Pointer interactions on dice
  const handlePointerDownTile = useCallback(
    (tileId: string, e: any) => {
      if (paused || isShaking || readOnly) return;
      if (e.button !== 0 && e.button !== undefined) return;

      isDraggingWordRef.current = true;
      movedAcrossTilesRef.current = false;
      pointerDownTileRef.current = tileId;

      const current = selectedPathRef.current;
      if (current.length === 0) {
        onPathChange([tileId]);
      } else {
        const lastId = current[current.length - 1];
        const lastTile = tileMap.get(lastId);

        if (tileId === lastId) {
          // Keep current path
        } else if (current.length >= 2 && tileId === current[current.length - 2]) {
          onPathChange(current.slice(0, -1));
        } else if (!current.includes(tileId) && lastTile?.neighbors.includes(tileId)) {
          onPathChange([...current, tileId]);
        } else {
          onPathChange([tileId]);
        }
      }
    },
    [isShaking, onPathChange, paused, readOnly, tileMap]
  );

  const handlePointerEnterTile = useCallback(
    (tileId: string) => {
      if (paused || isShaking || readOnly || !isDraggingWordRef.current) return;

      const current = selectedPathRef.current;
      if (current.length === 0) {
        onPathChange([tileId]);
        return;
      }

      const lastId = current[current.length - 1];
      if (tileId === lastId) return;

      // Backtrack
      if (current.length >= 2 && tileId === current[current.length - 2]) {
        movedAcrossTilesRef.current = true;
        onPathChange(current.slice(0, -1));
        return;
      }

      // Append valid unvisited neighbor
      const lastTile = tileMap.get(lastId);
      if (!current.includes(tileId) && lastTile?.neighbors.includes(tileId)) {
        movedAcrossTilesRef.current = true;
        onPathChange([...current, tileId]);
      }
    },
    [isShaking, onPathChange, paused, readOnly, tileMap]
  );

  // Global pointer up listener for word submission
  React.useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (!isDraggingWordRef.current) return;
      isDraggingWordRef.current = false;

      const path = selectedPathRef.current;
      if (movedAcrossTilesRef.current && path.length >= 2 && !editorMode) {
        onSubmitPath(path);
      } else if (!movedAcrossTilesRef.current && pointerDownTileRef.current) {
        if (onTileTap) {
          onTileTap(pointerDownTileRef.current);
        }
      }

      movedAcrossTilesRef.current = false;
      pointerDownTileRef.current = null;
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [editorMode, onSubmitPath, onTileTap]);

  return (
    <>
      {/* Studio Lighting Setup */}
      <ambientLight color="#f8fafc" intensity={0.75} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={28}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-6, 8, -6]} intensity={0.5} color="#c084fc" />
      <directionalLight position={[0, -4, 6]} intensity={0.3} color="#93c5fd" />

      {/* Realistic Tabletop Contact Shadows */}
      <ContactShadows
        opacity={0.55}
        scale={16}
        blur={2.4}
        far={5}
        position={[0, -0.74, 0]}
      />

      {/* Top-down locked Camera Controller during gameplay */}
      <GridIt3DCameraController
        board={board}
        isShaking={isShaking}
        resetViewTrigger={resetViewTrigger}
        rotateCwTrigger={rotateCwTrigger}
        rotateCcwTrigger={rotateCcwTrigger}
        isLetterSelected={isLetterSelected}
      />

      {/* Interactive 5-Second Shaker Wrapper */}
      <GridIt3DShaker
        board={board}
        isShaking={isShaking}
        isHost={isHost}
        remoteOrientation={remoteOrientation}
        onEmitOrientation={onEmitOrientation}
        onShakeSettled={onShakeSettled}
      >
        {({ boxRotation, physicsStates, lidOpenAmount }) => (
          <group
            name="entire-3d-box-unit"
            rotation={boxRotation}
          >
            {/* 3D Box Geometry (Tray, Gold Trim, Tall Lid, Latch, Nameplate, Crystals, Feet) */}
            <GridIt3DBox
              board={board}
              isShaking={isShaking}
              lidOpenAmount={lidOpenAmount}
            />

            {/* Glowing 3D Word Beams connecting selected dice */}
            <GridIt3DWordBeams
              selectedPath={selectedPath}
              tileMap={tileMap}
              paused={paused}
            />

            {/* Tactile 3D Letter Dice with 6-face dimensional lettering */}
            <GridIt3DDiceCollection
              tiles={board.tiles}
              selectedIndexMap={selectedIndexMap}
              hintTileId={hintTileId}
              paused={Boolean(paused)}
              isShaking={isShaking}
              activeRainbowIds={activeRainbowIds}
              activeGoldenIds={activeGoldenIds}
              physicsStates={physicsStates}
              onPointerEnterTile={handlePointerEnterTile}
              onPointerDownTile={handlePointerDownTile}
            />
          </group>
        )}
      </GridIt3DShaker>
    </>
  );
};
