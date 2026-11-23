import React, { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GridItTileNode } from '../../../../shared/gridit/types';
import { BOGGLE_DIE_FACES, getLetterTexture } from './letterTextureAtlas';

const sharedDieGeometry = new RoundedBoxGeometry(0.85, 0.85, 0.85, 4, 0.13);

const orderBadgeCache = new Map<number, THREE.CanvasTexture>();

// Shared immutable palette constants + reusable scratch colors (zero per-frame GC allocations)
const COLOR_WHITE = new THREE.Color('#ffffff');
const COLOR_BLACK = new THREE.Color('#000000');
const COLOR_SELECT_TINT = new THREE.Color('#fef08a');
const COLOR_SELECT_EMISSIVE = new THREE.Color('#f59e0b');
const COLOR_HINT_EMISSIVE = new THREE.Color('#38bdf8');
const COLOR_GOLD_SIDE = new THREE.Color('#facc15');
const COLOR_GOLD_TOP = new THREE.Color('#fde047');
const COLOR_GOLD_SIDE_EMISSIVE = new THREE.Color('#d97706');
const COLOR_GOLD_TOP_EMISSIVE = new THREE.Color('#92400e');

const _tmpColor = new THREE.Color();
const _tmpEmissive = new THREE.Color();
const _tmpTargetColor = new THREE.Color();
const _tmpTargetEmissive = new THREE.Color();

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

    // Smooth blend states for activation/expiration without jarring swaps
    const rainbowBlendRef = useRef(isRainbow ? 1 : 0);
    const goldenBlendRef = useRef(isGolden ? 1 : 0);
    const selectedBlendRef = useRef(isSelected ? 1 : 0);
    const hintBlendRef = useRef(isHinted ? 1 : 0);
    const matDirtyRef = useRef(true);
    const wasMatActiveRef = useRef(isRainbow || isGolden || isSelected || isHinted);

    // Build stable 6-face materials once per tile face content; modifier colors/shaders
    // animate smoothly in place inside useFrame without tearing down materials.
    // Order: [+X (right), -X (left), +Y (TOP), -Y (bottom), +Z (front), -Z (back)]
    const faceMaterials = useMemo(() => {
      const topLetter = tile.letter || '·';
      const altPool = BOGGLE_DIE_FACES[tileIndex % BOGGLE_DIE_FACES.length];

      const makeFaceMat = (letter: string, isTop: boolean) => {
        const tex = getLetterTexture(letter, {
          isPaused: isTop ? isPaused : false,
          isEmptySlot: isTop ? isEmptySlot : false,
        });
        return new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.28,
          metalness: 0.04,
        });
      };

      return [
        makeFaceMat(altPool[0] ?? 'A', false),
        makeFaceMat(altPool[1] ?? 'B', false),
        makeFaceMat(topLetter, true), // +Y TOP FACE
        makeFaceMat(altPool[2] ?? 'C', false),
        makeFaceMat(altPool[3] ?? 'D', false),
        makeFaceMat(altPool[4] ?? 'E', false),
      ];
    }, [tile.letter, tileIndex, isPaused, isEmptySlot]);

    useEffect(() => {
      return () => {
        for (const mat of faceMaterials) {
          mat.dispose();
        }
      };
    }, [faceMaterials]);

    useEffect(() => {
      matDirtyRef.current = true;
    }, [faceMaterials, isRainbow, isGolden, isSelected, isHinted]);

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

    useFrame((state, delta) => {
      const grp = groupRef.current;
      if (!grp) return;

      const safeDelta = Math.min(0.05, Math.max(0.001, delta));
      const t = state.clock.elapsedTime;

      // 1. Update transform (shaking in-slot vs settled gameplay)
      if (isShaking && physicsState) {
        if (
          !Number.isNaN(physicsState.pos.x) &&
          !Number.isNaN(physicsState.pos.y) &&
          !Number.isNaN(physicsState.pos.z)
        ) {
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
        const targetY = isSelected ? homePos.y + 0.24 : homePos.y;
        grp.position.x = homePos.x;
        grp.position.z = homePos.z;
        const currentY = Number.isNaN(grp.position.y) ? homePos.y : grp.position.y;
        grp.position.y = THREE.MathUtils.damp(currentY, targetY, 14, safeDelta);

        if (Number.isNaN(grp.quaternion.x) || Number.isNaN(grp.quaternion.w)) {
          grp.quaternion.copy(targetQuaternion);
        } else {
          grp.quaternion.slerp(targetQuaternion, THREE.MathUtils.clamp(safeDelta * 10, 0, 1));
        }
      }

      // 2. Smoothly blend Rainbow / Golden / Selection / Hint cube materials in place
      const rb = (rainbowBlendRef.current = THREE.MathUtils.damp(
        rainbowBlendRef.current,
        isRainbow ? 1 : 0,
        4.2,
        safeDelta
      ));
      const gd = (goldenBlendRef.current = THREE.MathUtils.damp(
        goldenBlendRef.current,
        isGolden ? 1 : 0,
        4.2,
        safeDelta
      ));
      const sel = (selectedBlendRef.current = THREE.MathUtils.damp(
        selectedBlendRef.current,
        isSelected ? 1 : 0,
        16,
        safeDelta
      ));
      const hnt = (hintBlendRef.current = THREE.MathUtils.damp(
        hintBlendRef.current,
        isHinted ? 1 : 0,
        8,
        safeDelta
      ));

      const isActive = rb > 0.001 || gd > 0.001 || sel > 0.001 || hnt > 0.001;
      if (isActive || wasMatActiveRef.current || matDirtyRef.current) {
        const shimmer = 0.5 + 0.5 * Math.sin(t * 2.4 + tileIndex * 0.7);
        const baseHue = (t * 0.32 + tileIndex * 0.11) % 1;
        const modSuppression = Math.max(rb, gd);

        for (let faceIdx = 0; faceIdx < faceMaterials.length; faceIdx++) {
          const mat = faceMaterials[faceIdx];
          const isTop = faceIdx === 2;

          // Base neutral ivory die
          _tmpColor.copy(COLOR_WHITE);
          _tmpEmissive.copy(COLOR_BLACK);
          let emissiveIntensity = 0;
          let metalness = 0.04;
          let roughness = 0.28;

          // Golden Letter: metallic gold cube body + edge glow + high-contrast top face
          if (gd > 0.001) {
            const gCol = isTop ? COLOR_GOLD_TOP : COLOR_GOLD_SIDE;
            const gEm = isTop ? COLOR_GOLD_TOP_EMISSIVE : COLOR_GOLD_SIDE_EMISSIVE;
            const gEmInt = isTop ? 0.14 + shimmer * 0.05 : 0.3 + shimmer * 0.12;
            const gMet = isTop ? 0.42 : 0.78;
            const gRough = isTop ? 0.2 : 0.18;

            _tmpColor.lerp(gCol, gd);
            _tmpEmissive.lerp(gEm, gd);
            emissiveIntensity = THREE.MathUtils.lerp(emissiveIntensity, gEmInt, gd);
            metalness = THREE.MathUtils.lerp(metalness, gMet, gd);
            roughness = THREE.MathUtils.lerp(roughness, gRough, gd);
          }

          // Rainbow Wildcard: animated iridescent cube body + bright legible top face
          if (rb > 0.001) {
            const faceHue = isTop ? baseHue : (baseHue + faceIdx * 0.16) % 1;
            _tmpTargetColor.setHSL(faceHue, isTop ? 0.84 : 0.92, isTop ? 0.78 : 0.62);
            _tmpTargetEmissive.setHSL(
              (faceHue + (isTop ? 0.1 : 0.08)) % 1,
              isTop ? 0.9 : 0.95,
              isTop ? 0.55 : 0.5
            );
            const rEmInt = isTop ? 0.14 : 0.46;
            const rMet = isTop ? 0.18 : 0.28;
            const rRough = isTop ? 0.2 : 0.18;

            _tmpColor.lerp(_tmpTargetColor, rb);
            _tmpEmissive.lerp(_tmpTargetEmissive, rb);
            emissiveIntensity = THREE.MathUtils.lerp(emissiveIntensity, rEmInt, rb);
            metalness = THREE.MathUtils.lerp(metalness, rMet, rb);
            roughness = THREE.MathUtils.lerp(roughness, rRough, rb);
          }

          // Hint glow (underneath selection)
          if (hnt > 0.001) {
            const hWeight = hnt * (1 - modSuppression * 0.65);
            _tmpEmissive.lerp(COLOR_HINT_EMISSIVE, hWeight);
            emissiveIntensity += (isTop ? 0.22 : 0.45) * hnt * (1 - sel);
          }

          // Selection highlight (preserves modifier hue while clearly indicating active trace)
          if (sel > 0.001) {
            const normalWeight = sel * (1 - modSuppression);
            if (normalWeight > 0.001) {
              _tmpColor.lerp(COLOR_SELECT_TINT, normalWeight);
              _tmpEmissive.lerp(COLOR_SELECT_EMISSIVE, normalWeight);
              emissiveIntensity = THREE.MathUtils.lerp(
                emissiveIntensity,
                isTop ? 0.28 : 0.55,
                normalWeight
              );
            }
            if (modSuppression > 0.001) {
              emissiveIntensity += (isTop ? 0.14 : 0.25) * sel * modSuppression;
            }
          }

          mat.color.copy(_tmpColor);
          mat.emissive.copy(_tmpEmissive);
          mat.emissiveIntensity = emissiveIntensity;
          mat.metalness = metalness;
          mat.roughness = roughness;
        }

        wasMatActiveRef.current = isActive;
        matDirtyRef.current = false;
      }

      // Expose inspectable runtime metadata cleanly on group.userData
      grp.userData.tileId = tile.id;
      grp.userData.letter = tile.letter;
      grp.userData.isRainbow = isRainbow;
      grp.userData.isGolden = isGolden;
      grp.userData.rainbowBlend = rb;
      grp.userData.goldenBlend = gd;
      if (!grp.userData.homePos) {
        grp.userData.homePos = { x: homePos.x, y: homePos.y, z: homePos.z };
      } else {
        grp.userData.homePos.x = homePos.x;
        grp.userData.homePos.y = homePos.y;
        grp.userData.homePos.z = homePos.z;
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
