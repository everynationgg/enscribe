import React, { useMemo } from 'react';
import * as THREE from 'three';
import { GridItTileNode } from '../../../../shared/gridit/types';

interface GridIt3DWordBeamsProps {
  selectedPath: string[];
  tileMap: Map<string, GridItTileNode>;
  paused?: boolean;
}

export const GridIt3DWordBeams: React.FC<GridIt3DWordBeamsProps> = ({
  selectedPath,
  tileMap,
  paused = false,
}) => {
  const points = useMemo(() => {
    if (paused || selectedPath.length < 2) return [];
    return selectedPath
      .map((id) => tileMap.get(id))
      .filter((t): t is GridItTileNode => Boolean(t))
      .map((t) => new THREE.Vector3(t.x / 64, 0.72, t.y / 64));
  }, [paused, selectedPath, tileMap]);

  const curve = useMemo(() => {
    if (points.length < 2) return null;
    return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.2);
  }, [points]);

  const tubeGeom = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, points.length * 12, 0.075, 8, false);
  }, [curve, points.length]);

  const outerTubeGeom = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, points.length * 12, 0.14, 8, false);
  }, [curve, points.length]);

  if (!tubeGeom || !outerTubeGeom || points.length < 2) {
    return null;
  }

  return (
    <group name="3d-word-path-beams">
      {/* Outer Golden Neon Aura */}
      <mesh geometry={outerTubeGeom}>
        <meshStandardMaterial
          color="#facc15"
          emissive="#eab308"
          emissiveIntensity={1.2}
          transparent
          opacity={0.65}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>

      {/* Inner White Core Energy Beam */}
      <mesh geometry={tubeGeom}>
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Glowing Energy Node Spheres at Each Connected Die */}
      {points.map((pt, idx) => (
        <group key={`beam-node-${idx}`} position={pt}>
          <mesh>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fde047"
              emissiveIntensity={1.5}
            />
          </mesh>
          <pointLight
            color="#fde047"
            intensity={0.4}
            distance={1.2}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
};
