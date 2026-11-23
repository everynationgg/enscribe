import React, { memo, useEffect, useMemo, useRef } from 'react';
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
      const baseProps: THREE.MeshStandardMaterialParameters = isGolden
        ? { roughness: 0.22, metalness: 0.15 }
        : isRainbow
          ? { roughness: 0.25, metalness: 0.08 }
          : { roughness: 0.28, metalness: 0.04 };

      const makeFaceMat = (letter: string, isTop: boolean) => {
        const tex = getLetterTexture(letter, {
          isGolden,
          isRainbow,
          isPaused: isTop ? isPaused : false,
          isEmptySlot: isTop ? isEmptySlot : false,
        });
        return new THREE.MeshStandardMaterial({
          map: tex,
          ...baseProps,
        });
      };

      // 6 materials for [+X, -X, +Y (TOP), -Y, +Z, -Z] — reused across selection/hint changes
      return [
        makeFaceMat(altPool[0] ?? 'A', false),
        makeFaceMat(altPool[1] ?? 'B', false),
        makeFaceMat(topLetter, true), // +Y TOP FACE
        makeFaceMat(altPool[2] ?? 'C', false),
        makeFaceMat(altPool[3] ?? 'D', false),
        makeFaceMat(altPool[4] ?? 'E', false),
      ];
    }, [tile.letter, tileIndex, isRainbow, isGolden, isPaused, isEmptySlot]);

    useEffect(() => {
      return () => {
        for (const mat of faceMaterials) {
          mat.dispose();
        }
      };
    }, [faceMaterials]);

    // Update color/emissive highlight in place without re-allocating GPU materials
    useEffect(() => {
      const colorHex = isGolden
        ? isSelected
          ? '#fffbeb'
          : '#ffffff'
        : isRainbow
          ? '#ffffff'
          : isSelected
            ? '#fef08a'
            : '#ffffff';
      const emissiveHex = isGolden
        ? isSelected
          ? '#f59e0b'
          : '#d97706'
        : isRainbow
          ? isSelected
            ? '#ec4899'
            : '#c084fc'
          : isSelected
            ? '#f59e0b'
            : isHinted
              ? '#38bdf8'
              : '#000000';
      const emissiveIntensity = isGolden
        ? isSelected
          ? 0.65
          : 0.1
        : isRainbow
          ? isSelected
            ? 0.75
            : 0.18
          : isSelected
            ? 0.65
            : isHinted
              ? 0.5
              : 0;

      for (const mat of faceMaterials) {
        mat.color.set(colorHex);
        mat.emissive.set(emissiveHex);
        mat.emissiveIntensity = emissiveIntensity;
      }
    }, [faceMaterials, isGolden, isRainbow, isSelected, isHinted]);

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

    const targetQuaternion = useMemo(
      () => new THREE.Quaternion().setFromEuler(baseRotationEuler),
      [baseRotationEuler]
    );

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
          grp.quaternion.copy(targetQuaternion);
        }
      } else {
        // Stable gameplay mode: smooth lift when selected
        const targetY = isSelected ? homePos.y + 0.24 : homePos.y;
        grp.position.x = homePos.x;
        grp.position.z = homePos.z;
        const currentY = Number.isNaN(grp.position.y) ? homePos.y : grp.position.y;
        grp.position.y = THREE.MathUtils.damp(currentY, targetY, 14, safeDelta);

        // Align smoothly to target resting orientation
        if (Number.isNaN(grp.quaternion.x) || Number.isNaN(grp.quaternion.w)) {
          grp.quaternion.copy(targetQuaternion);
        } else {
          grp.quaternion.slerp(targetQuaternion, THREE.MathUtils.clamp(safeDelta * 10, 0, 1));
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
