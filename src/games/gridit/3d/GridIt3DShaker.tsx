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

interface DieRattleProfile {
  phaseX: number;
  phaseY: number;
  phaseZ: number;
  bounceFreq: number;
  wobbleFreqX: number;
  wobbleFreqZ: number;
  hopAmp: number;
  baseSpin: THREE.Vector3;
}

const TOTAL_SHAKE_MS = 5000;
const SETTLE_START_MS = 4000;
const MAX_SLOT_OFFSET_XZ = 0.065;
const MAX_SLOT_HOP_Y = 0.56;

// Reusable scratch math objects (zero per-frame GC allocations)
const _tmpEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _tmpQuat = new THREE.Quaternion();

function hash01(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

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
  const hostEnergyRef = useRef<number>(0);
  const hasSettledRef = useRef(false);
  const lastEmitTimeRef = useRef(0);

  const physicsStatesRef = useRef<Map<string, DiePhysicalState>>(new Map());
  const rattleProfilesRef = useRef<Map<string, DieRattleProfile>>(new Map());

  // Assign each die to its permanent board slot & deterministic rattle profile BEFORE shaking starts
  const initPhysics = useMemo(() => {
    const states = new Map<string, DiePhysicalState>();
    const profiles = new Map<string, DieRattleProfile>();
    const seed = board.seed || 1234567;

    board.tiles.forEach((tile, idx) => {
      const homePos = new THREE.Vector3(tile.x / 64, 0.42, tile.y / 64);

      const yaw = ((tile.rotationDeg ?? 0) * Math.PI) / 180;
      const tilt = ((tile.tiltDeg ?? 0) * Math.PI) / 180;
      const targetRot = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(tilt * 0.7, -yaw, tilt * 0.5, 'YXZ')
      );

      const r0 = hash01(seed, idx * 17 + 0);
      const r1 = hash01(seed, idx * 17 + 1);
      const r2 = hash01(seed, idx * 17 + 2);
      const r3 = hash01(seed, idx * 17 + 3);
      const r4 = hash01(seed, idx * 17 + 4);
      const r5 = hash01(seed, idx * 17 + 5);
      const r6 = hash01(seed, idx * 17 + 6);
      const r7 = hash01(seed, idx * 17 + 7);
      const r8 = hash01(seed, idx * 17 + 8);
      const r9 = hash01(seed, idx * 17 + 9);

      const sx = r7 >= 0.5 ? 1 : -1;
      const sy = r8 >= 0.5 ? 1 : -1;
      const sz = r9 >= 0.5 ? 1 : -1;
      const baseSpin = new THREE.Vector3(
        sx * (7.5 + r3 * 8.0),
        sy * (7.5 + r4 * 8.0),
        sz * (7.5 + r5 * 8.0)
      );

      const profile: DieRattleProfile = {
        phaseX: r0 * Math.PI * 2,
        phaseY: r1 * Math.PI * 2,
        phaseZ: r2 * Math.PI * 2,
        bounceFreq: 13 + r3 * 8,
        wobbleFreqX: 11 + r4 * 8,
        wobbleFreqZ: 11 + r5 * 8,
        hopAmp: 0.22 + r6 * 0.24,
        baseSpin,
      };
      profiles.set(tile.id, profile);

      states.set(tile.id, {
        id: tile.id,
        pos: homePos.clone(),
        vel: new THREE.Vector3(0, 0, 0),
        rot: targetRot.clone(),
        angVel: baseSpin.clone(),
        homePos,
        targetRot,
      });
    });

    physicsStatesRef.current = states;
    rattleProfilesRef.current = profiles;
    return states;
  }, [board.seed, board.tiles]);

  useEffect(() => {
    if (isShaking) {
      startTimeRef.current = Date.now();
      hasSettledRef.current = false;
      hostEnergyRef.current = 0;

      initPhysics.forEach((st, id) => {
        const p = rattleProfilesRef.current.get(id);
        st.pos.copy(st.homePos);
        st.vel.set(0, 0, 0);
        if (p) {
          st.angVel.copy(p.baseSpin);
          _tmpEuler.set(p.phaseX * 0.4, p.phaseY * 0.5, p.phaseZ * 0.4, 'XYZ');
          _tmpQuat.setFromEuler(_tmpEuler);
          st.rot.copy(st.targetRot).multiply(_tmpQuat).normalize();
        } else {
          st.rot.copy(st.targetRot);
          st.angVel.set(0, 0, 0);
        }
      });
    }
  }, [initPhysics, isShaking]);

  // Interactive Host Pointer / Drag handling for rattling box
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

      // Apply angular impulse to tray box
      const sensitivity = 0.007 * settleFactor;
      boxVelRef.current.y += dx * sensitivity;
      boxVelRef.current.x += dy * sensitivity;
      boxVelRef.current.z += dx * dy * sensitivity * 0.1;

      // Pump bounded in-slot rattle spin energy without throwing dice outside slots
      hostEnergyRef.current = Math.min(
        1.0,
        hostEnergyRef.current + Math.hypot(dx, dy) * 0.008 * settleFactor
      );
      physicsStatesRef.current.forEach((die) => {
        die.angVel.x = THREE.MathUtils.clamp(die.angVel.x + dy * 0.12 * settleFactor, -22, 22);
        die.angVel.y = THREE.MathUtils.clamp(die.angVel.y + dx * 0.12 * settleFactor, -22, 22);
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
    const t = elapsed * 0.001;

    if (isShaking) {
      if (!isHost && remoteOrientation?.angVel) {
        hostEnergyRef.current = Math.max(
          hostEnergyRef.current,
          THREE.MathUtils.clamp(remoteOrientation.angVel * 0.45, 0, 1)
        );
      }
      hostEnergyRef.current = THREE.MathUtils.damp(hostEnergyRef.current, 0, 4.5, safeDelta);

      if (elapsed < SETTLE_START_MS) {
        // Active in-slot rattling phase (0.0s to 4.0s)
        if (isHost) {
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

          boxVelRef.current.multiplyScalar(0.92);

          const now = Date.now();
          if (now - lastEmitTimeRef.current > 50 && onEmitOrientation) {
            lastEmitTimeRef.current = now;
            onEmitOrientation({
              rotX: boxEulerRef.current.x,
              rotY: boxEulerRef.current.y,
              rotZ: boxEulerRef.current.z,
              angVel: Math.max(boxVelRef.current.length(), hostEnergyRef.current),
            });
          }
        } else if (remoteOrientation) {
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

        const rampIn = THREE.MathUtils.clamp(elapsed / 180, 0.35, 1.0);
        const preTaper =
          elapsed > 3700 ? THREE.MathUtils.lerp(1.0, 0.88, (elapsed - 3700) / 300) : 1.0;
        const energy = rampIn * preTaper * (1 + hostEnergyRef.current * 0.35);

        physicsStatesRef.current.forEach((st) => {
          const p = rattleProfilesRef.current.get(st.id);
          if (!p) return;

          const rawDx =
            (Math.sin(t * p.wobbleFreqX + p.phaseX) * 0.042 +
              Math.cos(t * (p.wobbleFreqZ * 1.37) + p.phaseZ) * 0.018) *
            energy;
          const rawDz =
            (Math.cos(t * p.wobbleFreqZ + p.phaseZ) * 0.042 +
              Math.sin(t * (p.wobbleFreqX * 1.29) + p.phaseX) * 0.018) *
            energy;
          const dx = THREE.MathUtils.clamp(rawDx, -MAX_SLOT_OFFSET_XZ, MAX_SLOT_OFFSET_XZ);
          const dz = THREE.MathUtils.clamp(rawDz, -MAX_SLOT_OFFSET_XZ, MAX_SLOT_OFFSET_XZ);

          const primaryHop = Math.abs(Math.sin(t * p.bounceFreq + p.phaseY));
          const chatterHop = 0.25 * Math.abs(Math.sin(t * p.bounceFreq * 2.13 + p.phaseX));
          const rawDy = (primaryHop * p.hopAmp + chatterHop * 0.14) * energy;
          const dy = THREE.MathUtils.clamp(rawDy, 0, MAX_SLOT_HOP_Y);

          st.pos.set(st.homePos.x + dx, st.homePos.y + dy, st.homePos.z + dz);

          // Relax back toward distinct per-die spin profile and integrate rotation in place
          st.angVel.lerp(p.baseSpin, THREE.MathUtils.clamp(safeDelta * 2.2, 0, 1));
          const spinBoost = (0.85 + 0.3 * primaryHop) * (1 + hostEnergyRef.current * 0.5);
          _tmpEuler.set(
            st.angVel.x * spinBoost * safeDelta,
            st.angVel.y * spinBoost * safeDelta,
            st.angVel.z * spinBoost * safeDelta,
            'XYZ'
          );
          _tmpQuat.setFromEuler(_tmpEuler);
          st.rot.multiply(_tmpQuat).normalize();
          st.vel.set(0, 0, 0);

          if (Number.isNaN(st.pos.x) || Number.isNaN(st.pos.y) || Number.isNaN(st.pos.z)) {
            st.pos.copy(st.homePos);
          }
          if (Number.isNaN(st.rot.x) || Number.isNaN(st.rot.w)) {
            st.rot.copy(st.targetRot);
          }
        });

        if (lastLidQuantizedRef.current !== 0) {
          lastLidQuantizedRef.current = 0;
          setLidOpenAmountState(0);
        }
      } else {
        // Controlled settlement phase (final second: 4.0s to 5.0s)
        const settleT = THREE.MathUtils.clamp(
          (elapsed - SETTLE_START_MS) / (TOTAL_SHAKE_MS - SETTLE_START_MS),
          0,
          1
        );
        const dampSq = (1 - settleT) * (1 - settleT);
        const energy = dampSq * 0.88;

        // Box returns smoothly upright to (0, 0, 0)
        boxEulerRef.current.x = THREE.MathUtils.damp(boxEulerRef.current.x, 0, 9, safeDelta);
        boxEulerRef.current.y = THREE.MathUtils.damp(boxEulerRef.current.y, 0, 9, safeDelta);
        boxEulerRef.current.z = THREE.MathUtils.damp(boxEulerRef.current.z, 0, 9, safeDelta);

        // Gradually reduce wobble/bounce inside slot and settle onto predetermined upward letter
        physicsStatesRef.current.forEach((st) => {
          const p = rattleProfilesRef.current.get(st.id);
          if (p) {
            const rawDx =
              (Math.sin(t * p.wobbleFreqX + p.phaseX) * 0.042 +
                Math.cos(t * (p.wobbleFreqZ * 1.37) + p.phaseZ) * 0.018) *
              energy;
            const rawDz =
              (Math.cos(t * p.wobbleFreqZ + p.phaseZ) * 0.042 +
                Math.sin(t * (p.wobbleFreqX * 1.29) + p.phaseX) * 0.018) *
              energy;
            const dx = THREE.MathUtils.clamp(rawDx, -MAX_SLOT_OFFSET_XZ, MAX_SLOT_OFFSET_XZ);
            const dz = THREE.MathUtils.clamp(rawDz, -MAX_SLOT_OFFSET_XZ, MAX_SLOT_OFFSET_XZ);
            const primaryHop = Math.abs(Math.sin(t * p.bounceFreq + p.phaseY));
            const dy = THREE.MathUtils.clamp(primaryHop * p.hopAmp * energy, 0, MAX_SLOT_HOP_Y);

            st.pos.set(st.homePos.x + dx, st.homePos.y + dy, st.homePos.z + dz);

            _tmpEuler.set(
              st.angVel.x * dampSq * safeDelta,
              st.angVel.y * dampSq * safeDelta,
              st.angVel.z * dampSq * safeDelta,
              'XYZ'
            );
            _tmpQuat.setFromEuler(_tmpEuler);
            st.rot.multiply(_tmpQuat);
            st.rot.slerp(
              st.targetRot,
              THREE.MathUtils.clamp(safeDelta * (3.5 + settleT * 18), 0, 1)
            );
            st.rot.normalize();
          } else {
            st.pos.lerp(st.homePos, THREE.MathUtils.clamp(safeDelta * (8 + settleT * 12), 0, 1));
            st.rot.slerp(st.targetRot, THREE.MathUtils.clamp(safeDelta * (6 + settleT * 12), 0, 1));
            st.rot.normalize();
          }

          st.vel.set(0, 0, 0);
          if (Number.isNaN(st.pos.x) || Number.isNaN(st.pos.y) || Number.isNaN(st.pos.z)) {
            st.pos.copy(st.homePos);
          }
          if (Number.isNaN(st.rot.x) || Number.isNaN(st.rot.w)) {
            st.rot.copy(st.targetRot);
          }
        });

        const nextLid = Math.round(THREE.MathUtils.clamp(settleT * 0.45, 0, 1) * 20) / 20;
        if (Math.abs(nextLid - lastLidQuantizedRef.current) >= 0.05) {
          lastLidQuantizedRef.current = nextLid;
          setLidOpenAmountState(nextLid);
        }
      }

      if (elapsed >= TOTAL_SHAKE_MS && !hasSettledRef.current) {
        hasSettledRef.current = true;
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
