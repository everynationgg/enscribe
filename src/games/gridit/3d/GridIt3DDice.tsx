import React, { memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GridItTileNode } from '../../../../shared/gridit/types';
import { BOGGLE_DIE_FACES, getLetterTexture } from './letterTextureAtlas';

const sharedDieGeometry = new RoundedBoxGeometry(0.85, 0.85, 0.85, 4, 0.13);

const orderBadgeCache = new Map<number, THREE.CanvasTexture>();

function getOrderBadgeTexture(order: number): THREE.CanvasTexture {
  const cached = orderBadgeCache.get(order);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#451a03';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(order), 32, 34);
  const tex = new THREE.CanvasTexture(canvas);
  orderBadgeCache.set(order, tex);
  return tex;
}

export interface DiePhysicalState {
  id: string;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Quaternion;
  angVel: THREE.Vector3;
  homePos: THREE.Vector3;
  targetRot: THREE.Quaternion;
}

interface GridIt3DSingleDieProps {
  tile: GridItTileNode;
  tileIndex: number;
  selectedIndex: number;
  isHinted: boolean;
  isPaused: boolean;
  isShaking: boolean;
  isEmptySlot: boolean;
  isRainbow: boolean;
  isGolden: boolean;
  physicsState?: DiePhysicalState;
  onPointerEnterTile?: (id: string) => void;
  onPointerDownTile?: (id: string, e: any) => void;
}

export const GridIt3DSingleDie = memo<GridIt3DSingleDieProps>(
  ({
    tile,
    tileIndex,
    selectedIndex,
    isHinted,
    isPaused,
    isShaking,
    isEmptySlot,
    isRainbow,
    isGolden,
    physicsState,
    onPointerEnterTile,
    onPointerDownTile,
  }) => {
    const groupRef = useRef<THREE.Group>(null);
    const isSelected = selectedIndex >= 0;

    // Determine letters for all 6 faces:
    // BoxGeometry material faces order: [+X (right), -X (left), +Y (top), -Y (bottom), +Z (front), -Z (back)]
    // Top face (+Y, index 2) MUST be the assigned letter!
    const faceMaterials = useMemo(() => {
      const topLetter = tile.letter || '·';
      const altPool = BOGGLE_DIE_FACES[tileIndex % BOGGLE_DIE_FACES.length];

      const topTex = getLetterTexture(topLetter, {
        isRainbow,
        isGolden,
        isPaused,
        isEmptySlot,
      });

      const makeSideMat = (letter: string) => {
        const tex = getLetterTexture(letter, {
          isGolden: false,
          isRainbow: false,
          isPaused: false,
          isEmptySlot: false,
        });
        return new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.28,
          metalness: 0.05,
        });
      };

      const topMat = isGolden
        ? new THREE.MeshStandardMaterial({
            map: topTex,
            roughness: 0.2,
            metalness: 0.92,
            color: '#ffffff',
            emissive: '#f59e0b',
            emissiveIntensity: isSelected ? 0.6 : 0.25,
          })
        : isRainbow
        ? new THREE.MeshStandardMaterial({
            map: topTex,
            roughness: 0.25,
            metalness: 0.1,
            color: '#ffffff',
            emissive: '#c084fc',
            emissiveIntensity: isSelected ? 0.7 : 0.35,
          })
        : new THREE.MeshStandardMaterial({
            map: topTex,
            roughness: 0.28,
            metalness: 0.05,
            color: isSelected ? '#fef08a' : '#ffffff',
            emissive: isSelected ? '#f59e0b' : isHinted ? '#38bdf8' : '#000000',
            emissiveIntensity: isSelected ? 0.65 : isHinted ? 0.5 : 0,
          });

      // 6 materials for [+X, -X, +Y (TOP), -Y, +Z, -Z]
      return [
        makeSideMat(altPool[0] ?? 'A'),
        makeSideMat(altPool[1] ?? 'B'),
        topMat, // +Y TOP FACE
        makeSideMat(altPool[2] ?? 'C'),
        makeSideMat(altPool[3] ?? 'D'),
        makeSideMat(altPool[4] ?? 'E'),
      ];
    }, [tile.letter, tileIndex, isRainbow, isGolden, isPaused, isEmptySlot, isSelected, isHinted]);

    // Target home resting transform
    const homePos = useMemo(
      () => new THREE.Vector3(tile.x / 64, 0.42, tile.y / 64),
      [tile.x, tile.y]
    );

    const baseRotationEuler = useMemo(() => {
      const yaw = ((tile.rotationDeg ?? 0) * Math.PI) / 180;
      const tilt = ((tile.tiltDeg ?? 0) * Math.PI) / 180;
      return new THREE.Euler(tilt * 0.7, -yaw, tilt * 0.5, 'YXZ');
    }, [tile.rotationDeg, tile.tiltDeg]);

    useFrame((_, delta) => {
      const grp = groupRef.current;
      if (!grp) return;

      const safeDelta = Math.min(0.05, Math.max(0.001, delta));

      if (isShaking && physicsState) {
        if (!Number.isNaN(physicsState.pos.x) && !Number.isNaN(physicsState.pos.y) && !Number.isNaN(physicsState.pos.z)) {
          grp.position.copy(physicsState.pos);
        } else {
          grp.position.copy(homePos);
        }
        if (!Number.isNaN(physicsState.rot.x) && !Number.isNaN(physicsState.rot.w)) {
          grp.quaternion.copy(physicsState.rot);
        } else {
          grp.quaternion.setFromEuler(baseRotationEuler);
        }
      } else {
        // Stable gameplay mode: smooth lift when selected
        const targetY = isSelected ? homePos.y + 0.24 : homePos.y;
        grp.position.x = homePos.x;
        grp.position.z = homePos.z;
        const currentY = Number.isNaN(grp.position.y) ? homePos.y : grp.position.y;
        grp.position.y = THREE.MathUtils.damp(currentY, targetY, 14, safeDelta);

        // Align smoothly to target resting orientation
        const targetQ = new THREE.Quaternion().setFromEuler(baseRotationEuler);
        if (Number.isNaN(grp.quaternion.x) || Number.isNaN(grp.quaternion.w)) {
          grp.quaternion.copy(targetQ);
        } else {
          grp.quaternion.slerp(targetQ, THREE.MathUtils.clamp(safeDelta * 10, 0, 1));
        }
      }
    });

    return (
      <group
        ref={groupRef}
        position={[homePos.x, homePos.y, homePos.z]}
        userData={{ tileId: tile.id }}
      >
        {/* Rounded Die Mesh */}
        <mesh
          geometry={sharedDieGeometry}
          castShadow
          receiveShadow
          material={faceMaterials}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDownTile?.(tile.id, e);
          }}
          onPointerEnter={(e) => {
            e.stopPropagation();
            onPointerEnterTile?.(tile.id);
          }}
        />

        {/* Selection order badge floating above selected die */}
        {isSelected && !isShaking && (
          <sprite position={[0, 0.65, 0]} scale={[0.42, 0.42, 0.42]}>
            <spriteMaterial
              map={getOrderBadgeTexture(selectedIndex + 1)}
              transparent
              depthTest={false}
            />
          </sprite>
        )}
      </group>
    );
  }
);
GridIt3DSingleDie.displayName = 'GridIt3DSingleDie';

interface GridIt3DDiceCollectionProps {
  tiles: GridItTileNode[];
  selectedIndexMap: Map<string, number>;
  hintTileId?: string | null;
  paused: boolean;
  isShaking: boolean;
  activeRainbowIds?: Set<string>;
  activeGoldenIds?: Set<string>;
  physicsStates?: Map<string, DiePhysicalState>;
  onPointerEnterTile?: (id: string) => void;
  onPointerDownTile?: (id: string, e: any) => void;
}

export const GridIt3DDiceCollection: React.FC<GridIt3DDiceCollectionProps> = memo(
  ({
    tiles,
    selectedIndexMap,
    hintTileId,
    paused,
    isShaking,
    activeRainbowIds,
    activeGoldenIds,
    physicsStates,
    onPointerEnterTile,
    onPointerDownTile,
  }) => {
    return (
      <group name="gridit-3d-dice-collection">
        {tiles.map((tile, idx) => {
          const isEmptySlot = !tile.letter || tile.letter.trim().length === 0;
          const isRainbow =
            activeRainbowIds?.has(tile.id) || tile.modifier?.type === 'rainbow';
          const isGolden =
            activeGoldenIds?.has(tile.id) || tile.modifier?.type === 'golden';
          const selectedIdx = selectedIndexMap.get(tile.id) ?? -1;

          return (
            <GridIt3DSingleDie
              key={tile.id}
              tile={tile}
              tileIndex={idx}
              selectedIndex={selectedIdx}
              isHinted={hintTileId === tile.id}
              isPaused={paused}
              isShaking={isShaking}
              isEmptySlot={isEmptySlot}
              isRainbow={Boolean(isRainbow)}
              isGolden={Boolean(isGolden)}
              physicsState={physicsStates?.get(tile.id)}
              onPointerEnterTile={onPointerEnterTile}
              onPointerDownTile={onPointerDownTile}
            />
          );
        })}
      </group>
    );
  }
);
GridIt3DDiceCollection.displayName = 'GridIt3DDiceCollection';
