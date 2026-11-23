import React, { useMemo } from 'react';
import * as THREE from 'three';
import { GridItBoard } from '../../../../shared/gridit/types';
import {
  createGoldTrimGeometry,
  createNameplateTexture,
  createPawLatchGeometries,
  createTallLidCeilingGeometry,
  createTallLidWallsGeometry,
  createTrayFloorGeometry,
  createTrayWallsGeometry,
} from './trayGeometries';

interface GridIt3DBoxProps {
  board: GridItBoard;
  isShaking: boolean;
  lidOpenAmount?: number; // 0 = closed (shaking), 1 = fully open/clear (playing)
}

export const GridIt3DBox: React.FC<GridIt3DBoxProps> = ({
  board,
  isShaking,
  lidOpenAmount = 0,
}) => {
  const hw = board.bounds.width / (2 * 64);
  const hh = board.bounds.height / (2 * 64);

  // Tray geometries
  const trayWallsGeom = useMemo(() => createTrayWallsGeometry(board.shapeId, board.bounds), [
    board.shapeId,
    board.bounds,
  ]);
  const trayFloorGeom = useMemo(() => createTrayFloorGeometry(board.shapeId, board.bounds), [
    board.shapeId,
    board.bounds,
  ]);
  const goldTrimGeom = useMemo(() => createGoldTrimGeometry(board.shapeId, board.bounds), [
    board.shapeId,
    board.bounds,
  ]);
  const lidWallsGeom = useMemo(() => createTallLidWallsGeometry(board.shapeId, board.bounds), [
    board.shapeId,
    board.bounds,
  ]);
  const lidCeilingGeom = useMemo(() => createTallLidCeilingGeometry(board.shapeId, board.bounds), [
    board.shapeId,
    board.bounds,
  ]);
  const { mainPad, toes } = useMemo(() => createPawLatchGeometries(), []);
  const nameplateTex = useMemo(() => createNameplateTexture(), []);

  // Rubber feet positions
  const feetPositions = useMemo<[number, number, number][]>(() => {
    const rx = Math.max(0.6, hw - 0.4);
    const rz = Math.max(0.6, hh - 0.4);
    return [
      [-rx, -0.68, -rz],
      [rx, -0.68, -rz],
      [-rx, -0.68, rz],
      [rx, -0.68, rz],
    ];
  }, [hw, hh]);

  // Corner crystal positions
  const crystalPositions = useMemo<[number, number, number][]>(() => {
    const rx = hw + 0.42;
    const rz = hh + 0.42;
    return [
      [-rx, 0.52, -rz],
      [rx, 0.52, -rz],
      [-rx, 0.52, rz],
      [rx, 0.52, rz],
    ];
  }, [hw, hh]);

  // Socket geometry for each die slot
  const socketGeom = useMemo(() => {
    return new THREE.BoxGeometry(0.9, 0.08, 0.9);
  }, []);

  return (
    <group name="gridit-3d-box-assembly">
      {/* 1. Glossy Deep Purple Tray Outer Walls (Hollow Rim) */}
      <mesh geometry={trayWallsGeom} castShadow receiveShadow position={[0, 0.48, 0]}>
        <meshStandardMaterial
          color="#38156e"
          roughness={0.24}
          metalness={0.28}
        />
      </mesh>

      {/* Tray Interior Floor */}
      <mesh geometry={trayFloorGeom} receiveShadow position={[0, -0.04, 0]}>
        <meshStandardMaterial
          color="#220c44"
          roughness={0.32}
          metalness={0.22}
        />
      </mesh>

      {/* Tray Underside Bottom Plate */}
      <mesh geometry={trayFloorGeom} receiveShadow position={[0, -0.56, 0]}>
        <meshStandardMaterial
          color="#140728"
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* Recessed Sockets for Each Die */}
      <group name="dice-sockets-group" position={[0, 0, 0]}>
        {board.tiles.map((tile) => (
          <mesh
            key={`socket-${tile.id}`}
            geometry={socketGeom}
            receiveShadow
            position={[tile.x / 64, -0.01, tile.y / 64]}
          >
            <meshStandardMaterial
              color="#0d041c"
              roughness={0.5}
              metalness={0.08}
            />
          </mesh>
        ))}
      </group>

      {/* 2. Gold Metallic Trim around the Top Rim (Hollow Rim Border) */}
      <mesh geometry={goldTrimGeom} position={[0, 0.54, 0]} castShadow>
        <meshStandardMaterial
          color="#facc15"
          emissive="#78350f"
          emissiveIntensity={0.25}
          roughness={0.18}
          metalness={0.9}
        />
      </mesh>

      {/* 3. Gold & Purple Paw-Shaped Latch Clasp (Front center) */}
      <group
        name="paw-latch"
        position={[0, 0.46, hh + 0.52]}
        rotation={[-0.2, 0, 0]}
      >
        {/* Main Paw Pad: Purple with gold rim */}
        <mesh geometry={mainPad} castShadow>
          <meshStandardMaterial
            color="#581c87"
            emissive="#3b0764"
            roughness={0.3}
            metalness={0.5}
          />
        </mesh>
        {/* 4 Small Golden Toe Pads */}
        {toes.map((toe, idx) => (
          <mesh key={`paw-toe-${idx}`} geometry={toe} castShadow>
            <meshStandardMaterial
              color="#facc15"
              roughness={0.2}
              metalness={0.85}
            />
          </mesh>
        ))}
      </group>

      {/* 4. Embossed Gold "GRIDIT" Nameplate (Front wall) */}
      <mesh
        position={[0, 0.12, hh + 0.58]}
        rotation={[0, 0, 0]}
        castShadow
      >
        <planeGeometry args={[1.5, 0.38]} />
        <meshStandardMaterial
          map={nameplateTex}
          transparent
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* 5. Illuminated Crystal Accents at Corners */}
      {crystalPositions.map((pos, idx) => (
        <group key={`crystal-${idx}`} position={pos}>
          <mesh castShadow>
            <octahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial
              color="#c084fc"
              emissive="#a855f7"
              emissiveIntensity={0.9}
              roughness={0.1}
              metalness={0.2}
            />
          </mesh>
          <pointLight
            color="#c084fc"
            intensity={0.35}
            distance={1.6}
            decay={2}
          />
        </group>
      ))}

      {/* 6. Rubber Feet (Bottom of tray) */}
      {feetPositions.map((pos, idx) => (
        <mesh key={`foot-${idx}`} position={pos} receiveShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.12, 16]} />
          <meshStandardMaterial
            color="#090514"
            roughness={0.8}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* 7. Raised, Transparent Violet-Tinted Tall Lid */}
      {/* Significantly taller than the previous reference (~2.1 units), hollow chamber for tumbling dice */}
      <group
        name="tall-violet-lid"
        position={[
          0,
          0.54 + lidOpenAmount * 2.8,
          lidOpenAmount * -0.6,
        ]}
        rotation={[lidOpenAmount * -0.28, 0, 0]}
      >
        {/* Transparent Violet Side Walls */}
        <mesh
          geometry={lidWallsGeom}
          castShadow={isShaking}
          raycast={() => null} // Ignore raycasting so letter tracing passes straight to dice
        >
          <meshStandardMaterial
            color="#c084fc"
            transparent
            opacity={isShaking ? 0.22 : Math.max(0.02, 0.22 - lidOpenAmount * 0.2)}
            depthWrite={false}
            roughness={0.08}
            metalness={0.12}
          />
        </mesh>

        {/* Transparent Violet Top Ceiling */}
        <mesh
          geometry={lidCeilingGeom}
          position={[0, 2.06, 0]}
          castShadow={isShaking}
          visible={isShaking || lidOpenAmount < 0.6}
          raycast={() => null}
        >
          <meshStandardMaterial
            color="#c084fc"
            transparent
            opacity={isShaking ? 0.22 : Math.max(0.02, 0.22 - lidOpenAmount * 0.2)}
            depthWrite={false}
            roughness={0.08}
            metalness={0.12}
          />
        </mesh>
      </group>
    </group>
  );
};
