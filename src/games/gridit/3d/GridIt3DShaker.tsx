import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GridItBoard } from '../../../../shared/gridit/types';
import { DiePhysicalState } from './GridIt3DDice';

export interface HostShakePayload {
  rotX: number;
  rotY: number;
  rotZ: number;
  angVel?: number;
}

interface GridIt3DShakerProps {
  board: GridItBoard;
  isShaking: boolean;
  isHost: boolean;
  remoteOrientation?: HostShakePayload | null;
  onEmitOrientation?: (payload: HostShakePayload) => void;
  onShakeSettled?: () => void;
  children: (props: {
    boxGroupRef: React.RefObject<THREE.Group>;
    physicsStates: Map<string, DiePhysicalState>;
    lidOpenAmount: number;
    shakeProgress: number;
  }) => React.ReactNode;
}

const TOTAL_SHAKE_MS = 5000;
const SETTLE_START_MS = 3800;

export const GridIt3DShaker: React.FC<GridIt3DShakerProps> = ({
  board,
  isShaking,
  isHost,
  remoteOrientation,
  onEmitOrientation,
  onShakeSettled,
  children,
}) => {
  const startTimeRef = useRef<number>(Date.now());
  const boxEulerRef = useRef<THREE.Euler>(new THREE.Euler(0, 0, 0, 'YXZ'));
  const boxVelRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const hasSettledRef = useRef(false);
  const lastEmitTimeRef = useRef(0);

  // Bounds for dice containment inside tray + tall lid
  const boundsInfo = useMemo(() => {
    const hw = Math.max(1.2, board.bounds.width / (2 * 64) - 0.25);
    const hh = Math.max(1.2, board.bounds.height / (2 * 64) - 0.25);
    return {
      minX: -hw,
      maxX: hw,
      minZ: -hh,
      maxZ: hh,
      minY: 0.42,
      maxY: 1.95, // Under tall transparent lid
    };
  }, [board.bounds]);

  // Initialize dice physical states with deterministic seed
  const physicsStatesRef = useRef<Map<string, DiePhysicalState>>(new Map());

  const initPhysics = useMemo(() => {
    const states = new Map<string, DiePhysicalState>();
    const seed = board.seed || 1234567;

    board.tiles.forEach((tile, idx) => {
      const homePos = new THREE.Vector3(tile.x / 64, 0.42, tile.y / 64);

      const yaw = ((tile.rotationDeg ?? 0) * Math.PI) / 180;
      const tilt = ((tile.tiltDeg ?? 0) * Math.PI) / 180;
      const targetRot = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(tilt * 0.7, -yaw, tilt * 0.5, 'YXZ')
      );

      // Deterministic initial scattered bounce
      const prng = Math.sin(seed + idx * 7919) * 10000;
      const prng2 = Math.cos(seed + idx * 3571) * 10000;
      const prng3 = Math.sin(seed + idx * 1237) * 10000;

      const initVx = (prng - Math.floor(prng) - 0.5) * 4.5;
      const initVy = (prng2 - Math.floor(prng2)) * 6.5 + 3.0; // Upward burst
      const initVz = (prng3 - Math.floor(prng3) - 0.5) * 4.5;

      states.set(tile.id, {
        id: tile.id,
        pos: homePos.clone().add(new THREE.Vector3(0, 0.2, 0)),
        vel: new THREE.Vector3(initVx, initVy, initVz),
        rot: targetRot.clone(),
        angVel: new THREE.Vector3(
          (prng - Math.floor(prng) - 0.5) * 12,
          (prng2 - Math.floor(prng2) - 0.5) * 12,
          (prng3 - Math.floor(prng3) - 0.5) * 12
        ),
        homePos,
        targetRot,
      });
    });

    physicsStatesRef.current = states;
    return states;
  }, [board.seed, board.tiles]);

  useEffect(() => {
    if (isShaking) {
      startTimeRef.current = Date.now();
      hasSettledRef.current = false;
      // Re-trigger initial burst
      let index = 0;
      initPhysics.forEach((st) => {
        const seed = board.seed || 12345;
        const pr = Math.sin(seed + index * 53) * 10000;
        index++;
        st.pos.copy(st.homePos).add(new THREE.Vector3(0, 0.3, 0));
        st.vel.set(
          ((pr - Math.floor(pr)) - 0.5) * 5.0,
          Math.abs(Math.sin(pr)) * 6.0 + 3.5,
          (Math.cos(pr) - 0.5) * 5.0
        );
      });
    }
  }, [board.seed, initPhysics, isShaking]);

  // Interactive Host Pointer / Drag handling for shaking
  useEffect(() => {
    if (!isShaking || !isHost) return;

    let isPointerDown = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      const elapsed = Date.now() - startTimeRef.current;
      const settleFactor =
        elapsed >= SETTLE_START_MS
          ? Math.max(0, 1 - (elapsed - SETTLE_START_MS) / (TOTAL_SHAKE_MS - SETTLE_START_MS))
          : 1.0;

      // Apply angular impulse to box
      const sensitivity = 0.007 * settleFactor;
      boxVelRef.current.y += dx * sensitivity;
      boxVelRef.current.x += dy * sensitivity;
      boxVelRef.current.z += (dx * dy) * sensitivity * 0.1;

      // Impart velocity to tumbling dice
      physicsStatesRef.current.forEach((die) => {
        die.vel.x += dx * 0.04 * settleFactor;
        die.vel.z += dy * 0.04 * settleFactor;
        die.vel.y += Math.hypot(dx, dy) * 0.02 * settleFactor;
        die.angVel.x += dy * 0.15;
        die.angVel.y += dx * 0.15;
      });
    };

    const onPointerUp = () => {
      isPointerDown = false;
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isHost, isShaking]);

  const boxGroupRef = useRef<THREE.Group>(null);
  const lastLidQuantizedRef = useRef(isShaking ? 0 : 1);
  const [lidOpenAmountState, setLidOpenAmountState] = useState(isShaking ? 0 : 1);

  useFrame((_, delta) => {
    const elapsed = Date.now() - startTimeRef.current;
    const safeDelta = Math.min(0.05, Math.max(0.001, delta));

    if (isShaking) {
      if (elapsed < SETTLE_START_MS) {
        // Active shaking phase (0 to 3.8s)
        if (isHost) {
          // Automatic rhythmic shake if host isn't furiously dragging
          const t = elapsed * 0.001;
          const autoShakeX = Math.sin(t * 14) * 0.28 + Math.sin(t * 7) * 0.12;
          const autoShakeY = Math.cos(t * 11) * 0.24 + Math.cos(t * 5) * 0.1;
          const autoShakeZ = Math.sin(t * 16) * 0.2;

          boxEulerRef.current.x = THREE.MathUtils.damp(
            boxEulerRef.current.x,
            autoShakeX + boxVelRef.current.x,
            8,
            safeDelta
          );
          boxEulerRef.current.y = THREE.MathUtils.damp(
            boxEulerRef.current.y,
            autoShakeY + boxVelRef.current.y,
            8,
            safeDelta
          );
          boxEulerRef.current.z = THREE.MathUtils.damp(
            boxEulerRef.current.z,
            autoShakeZ + boxVelRef.current.z,
            8,
            safeDelta
          );

          // Dampen host angular impulse
          boxVelRef.current.multiplyScalar(0.92);

          // Throttled network broadcast for multiplayer sync (20 fps)
          const now = Date.now();
          if (now - lastEmitTimeRef.current > 50 && onEmitOrientation) {
            lastEmitTimeRef.current = now;
            onEmitOrientation({
              rotX: boxEulerRef.current.x,
              rotY: boxEulerRef.current.y,
              rotZ: boxEulerRef.current.z,
              angVel: boxVelRef.current.length(),
            });
          }
        } else if (remoteOrientation) {
          // Interpolate to host's synchronized orientation
          boxEulerRef.current.x = THREE.MathUtils.damp(
            boxEulerRef.current.x,
            remoteOrientation.rotX,
            12,
            safeDelta
          );
          boxEulerRef.current.y = THREE.MathUtils.damp(
            boxEulerRef.current.y,
            remoteOrientation.rotY,
            12,
            safeDelta
          );
          boxEulerRef.current.z = THREE.MathUtils.damp(
            boxEulerRef.current.z,
            remoteOrientation.rotZ,
            12,
            safeDelta
          );
        }

        // Dice tumbling simulation
        physicsStatesRef.current.forEach((st) => {
          // Gravity & Box Inertia
          st.vel.y -= 19 * safeDelta;

          // Box tilt influence
          st.vel.x += Math.sin(boxEulerRef.current.z) * 14 * safeDelta;
          st.vel.z -= Math.sin(boxEulerRef.current.x) * 14 * safeDelta;

          // Update position
          st.pos.addScaledVector(st.vel, safeDelta);

          // Update rotation
          const rotDelta = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              st.angVel.x * safeDelta,
              st.angVel.y * safeDelta,
              st.angVel.z * safeDelta,
              'XYZ'
            )
          );
          st.rot.multiply(rotDelta);
          st.rot.normalize();

          // Bounce off tray floor
          if (st.pos.y <= boundsInfo.minY) {
            st.pos.y = boundsInfo.minY;
            st.vel.y = Math.abs(st.vel.y) * 0.65;
            st.angVel.x += (Math.random() - 0.5) * 8;
            st.angVel.z += (Math.random() - 0.5) * 8;
          }

          // Bounce off tall lid ceiling
          if (st.pos.y >= boundsInfo.maxY) {
            st.pos.y = boundsInfo.maxY;
            st.vel.y = -Math.abs(st.vel.y) * 0.65;
            st.angVel.x += (Math.random() - 0.5) * 6;
          }

          // Bounce off tray walls
          if (st.pos.x <= boundsInfo.minX) {
            st.pos.x = boundsInfo.minX;
            st.vel.x = Math.abs(st.vel.x) * 0.65;
            st.angVel.y += (Math.random() - 0.5) * 8;
          } else if (st.pos.x >= boundsInfo.maxX) {
            st.pos.x = boundsInfo.maxX;
            st.vel.x = -Math.abs(st.vel.x) * 0.65;
            st.angVel.y += (Math.random() - 0.5) * 8;
          }

          if (st.pos.z <= boundsInfo.minZ) {
            st.pos.z = boundsInfo.minZ;
            st.vel.z = Math.abs(st.vel.z) * 0.65;
            st.angVel.y += (Math.random() - 0.5) * 8;
          } else if (st.pos.z >= boundsInfo.maxZ) {
            st.pos.z = boundsInfo.maxZ;
            st.vel.z = -Math.abs(st.vel.z) * 0.65;
            st.angVel.y += (Math.random() - 0.5) * 8;
          }

          // Friction damping
          st.vel.multiplyScalar(0.985);
          st.angVel.multiplyScalar(0.98);

          // Safety guard against NaN
          if (Number.isNaN(st.pos.x) || Number.isNaN(st.pos.y) || Number.isNaN(st.pos.z)) {
            st.pos.copy(st.homePos);
            st.vel.set(0, 0, 0);
          }
          if (Number.isNaN(st.rot.x) || Number.isNaN(st.rot.w)) {
            st.rot.copy(st.targetRot);
            st.angVel.set(0, 0, 0);
          }
        });

        if (lastLidQuantizedRef.current !== 0) {
          lastLidQuantizedRef.current = 0;
          setLidOpenAmountState(0);
        }
      } else {
        // Automatic Settlement phase (3.8s to 5.0s)
        const settleProgress = (elapsed - SETTLE_START_MS) / (TOTAL_SHAKE_MS - SETTLE_START_MS);
        const ease = Math.min(1.0, settleProgress);

        // Box returns smoothly upright to (0, 0, 0)
        boxEulerRef.current.x = THREE.MathUtils.damp(boxEulerRef.current.x, 0, 9, safeDelta);
        boxEulerRef.current.y = THREE.MathUtils.damp(boxEulerRef.current.y, 0, 9, safeDelta);
        boxEulerRef.current.z = THREE.MathUtils.damp(boxEulerRef.current.z, 0, 9, safeDelta);

        // Dice smoothly interpolate to exact home sockets and predetermined orientations
        physicsStatesRef.current.forEach((st) => {
          st.pos.lerp(st.homePos, THREE.MathUtils.clamp(safeDelta * (8 + ease * 12), 0, 1));
          st.rot.slerp(st.targetRot, THREE.MathUtils.clamp(safeDelta * (6 + ease * 12), 0, 1));
          st.rot.normalize();
          st.vel.set(0, 0, 0);
          st.angVel.set(0, 0, 0);
        });

        // Lid opens smoothly without forcing 60Hz React reconciliation
        const nextLid = Math.round(THREE.MathUtils.clamp(ease * 0.4, 0, 1) * 20) / 20;
        if (Math.abs(nextLid - lastLidQuantizedRef.current) >= 0.05) {
          lastLidQuantizedRef.current = nextLid;
          setLidOpenAmountState(nextLid);
        }
      }

      // Check for completion
      if (elapsed >= TOTAL_SHAKE_MS && !hasSettledRef.current) {
        hasSettledRef.current = true;
        // Snap exactly to predetermined targets
        boxEulerRef.current.set(0, 0, 0);
        physicsStatesRef.current.forEach((st) => {
          st.pos.copy(st.homePos);
          st.rot.copy(st.targetRot);
          st.vel.set(0, 0, 0);
          st.angVel.set(0, 0, 0);
        });
        lastLidQuantizedRef.current = 1.0;
        setLidOpenAmountState(1.0);
        onShakeSettled?.();
      }

      if (boxGroupRef.current) {
        boxGroupRef.current.rotation.copy(boxEulerRef.current);
      }
    } else {
      // Stable gameplay state
      if (lastLidQuantizedRef.current !== 1.0) {
        lastLidQuantizedRef.current = 1.0;
        setLidOpenAmountState(1.0);
      }
      boxEulerRef.current.set(0, 0, 0);
      if (boxGroupRef.current) {
        boxGroupRef.current.rotation.set(0, 0, 0);
      }
    }
  });

  return (
    <>
      {children({
        boxGroupRef,
        physicsStates: physicsStatesRef.current,
        lidOpenAmount: lidOpenAmountState,
        shakeProgress: Math.min(1.0, (Date.now() - startTimeRef.current) / TOTAL_SHAKE_MS),
      })}
    </>
  );
};
