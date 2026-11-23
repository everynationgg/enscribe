import React, { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { GridItBoard } from '../../../../shared/gridit/types';

interface GridIt3DCameraControllerProps {
  board: GridItBoard;
  isShaking: boolean;
  resetViewTrigger: number;
  /** Positive = CW step, negative = CCW step. Each step rotates 90°. */
  rotateCwTrigger: number;
  rotateCcwTrigger: number;
  isLetterSelected?: boolean;
}

export const GridIt3DCameraController: React.FC<GridIt3DCameraControllerProps> = ({
  board,
  isShaking,
  resetViewTrigger,
  rotateCwTrigger,
  rotateCcwTrigger,
  isLetterSelected = false,
}) => {
  const { camera, gl } = useThree();

  const hw = board.bounds.width / (2 * 64);
  const hh = board.bounds.height / (2 * 64);
  const boardRadius = Math.hypot(hw, hh);

  const computeFitDistance = useCallback(() => {
    const size = gl.domElement.getBoundingClientRect();
    const aspect = size.width / Math.max(1, size.height);
    const baseDist = Math.max(5.8, boardRadius * 1.55);
    return aspect < 1.0 ? baseDist / Math.max(0.58, aspect * 0.92) : baseDist;
  }, [boardRadius, gl.domElement]);

  const defaultDistance = computeFitDistance();
  const LOCKED_POLAR = 0.18; // ~10° from straight-down top-down perspective
  const defaultAzimuth = 0;

  const currentSpherical = useRef(new THREE.Spherical(defaultDistance, LOCKED_POLAR, defaultAzimuth));
  const targetSpherical = useRef(new THREE.Spherical(defaultDistance, LOCKED_POLAR, defaultAzimuth));
  const panOffset = useRef(new THREE.Vector2(0, 0));
  const targetPan = useRef(new THREE.Vector2(0, 0));
  const isResetting = useRef(false);

  // ── Reset ──────────────────────────────────────────────────────────
  const triggerReset = useCallback(() => {
    targetSpherical.current.radius = computeFitDistance();
    targetSpherical.current.phi = LOCKED_POLAR;
    targetSpherical.current.theta = defaultAzimuth;
    targetPan.current.set(0, 0);
    isResetting.current = true;
  }, [computeFitDistance]);

  useEffect(() => {
    if (resetViewTrigger > 0) triggerReset();
  }, [resetViewTrigger, triggerReset]);

  // ── Button-driven 90° rotation (BLOCKED when letter is selected) ────
  useEffect(() => {
    if (rotateCwTrigger > 0 && !isLetterSelected) {
      targetSpherical.current.theta -= Math.PI / 2;
      isResetting.current = true;
    }
  }, [rotateCwTrigger, isLetterSelected]);

  useEffect(() => {
    if (rotateCcwTrigger > 0 && !isLetterSelected) {
      targetSpherical.current.theta += Math.PI / 2;
      isResetting.current = true;
    }
  }, [rotateCcwTrigger, isLetterSelected]);

  // ── Resize ────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      if (!isShaking) {
        targetSpherical.current.radius = computeFitDistance();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computeFitDistance, isShaking]);

  // ── Gestures: zoom only + pan when zoomed (NO drag-to-rotate) ──────
  useEffect(() => {
    const dom = gl.domElement;
    if (!dom) return;

    let initialPinchDist = 0;
    let lastMidX = 0;
    let lastMidY = 0;
    let isPanningMouse = false;
    let lastPanX = 0;
    let lastPanY = 0;

    // Mouse wheel zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      const fitD = computeFitDistance();
      targetSpherical.current.radius = THREE.MathUtils.clamp(
        targetSpherical.current.radius * zoomFactor,
        fitD * 0.45,
        fitD * 2.4
      );
      isResetting.current = false;
    };

    // Right-click / Middle-click mouse pan
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 1 || e.button === 2) {
        isPanningMouse = true;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPanningMouse) return;
      const dx = e.clientX - lastPanX;
      const dy = e.clientY - lastPanY;
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      const theta = currentSpherical.current.theta;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const panSpeed = 0.005 * (currentSpherical.current.radius / defaultDistance);
      targetPan.current.x += (-dx * cosT - dy * sinT) * panSpeed;
      targetPan.current.y += (dx * sinT - dy * cosT) * panSpeed;
    };

    const onPointerUp = () => {
      isPanningMouse = false;
    };

    // Mobile 2-finger pinch zoom and pan
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.max(10, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        if (initialPinchDist > 0) {
          const factor = initialPinchDist / dist;
          const fitD = computeFitDistance();
          targetSpherical.current.radius = THREE.MathUtils.clamp(
            targetSpherical.current.radius * factor,
            fitD * 0.45,
            fitD * 2.4
          );
        }
        initialPinchDist = dist;

        if (lastMidX !== 0 && lastMidY !== 0) {
          const dx = midX - lastMidX;
          const dy = midY - lastMidY;
          const theta = currentSpherical.current.theta;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const panSpeed = 0.005 * (currentSpherical.current.radius / defaultDistance);
          targetPan.current.x += (-dx * cosT - dy * sinT) * panSpeed;
          targetPan.current.y += (dx * sinT - dy * cosT) * panSpeed;
        }
        lastMidX = midX;
        lastMidY = midY;
        isResetting.current = false;
      }
    };

    const onTouchEnd = () => {
      initialPinchDist = 0;
      lastMidX = 0;
      lastMidY = 0;
    };

    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('touchmove', onTouchMove, { passive: false });
    dom.addEventListener('touchend', onTouchEnd);

    return () => {
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
    };
  }, [computeFitDistance, defaultDistance, gl.domElement]);

  // ── Per-frame interpolation ───────────────────────────────────────
  useFrame((_, delta) => {
    const lerpSpeed = isResetting.current ? 12 : 9;

    currentSpherical.current.radius = THREE.MathUtils.damp(
      currentSpherical.current.radius,
      targetSpherical.current.radius,
      lerpSpeed,
      delta
    );
    currentSpherical.current.phi = THREE.MathUtils.damp(
      currentSpherical.current.phi,
      LOCKED_POLAR,
      lerpSpeed,
      delta
    );
    currentSpherical.current.theta = THREE.MathUtils.damp(
      currentSpherical.current.theta,
      targetSpherical.current.theta,
      lerpSpeed,
      delta
    );

    panOffset.current.x = THREE.MathUtils.damp(panOffset.current.x, targetPan.current.x, lerpSpeed, delta);
    panOffset.current.y = THREE.MathUtils.damp(panOffset.current.y, targetPan.current.y, lerpSpeed, delta);

    camera.position.setFromSpherical(currentSpherical.current);
    camera.position.x += panOffset.current.x;
    camera.position.z += panOffset.current.y;

    const lookTarget = new THREE.Vector3(panOffset.current.x, 0.2, panOffset.current.y);
    camera.lookAt(lookTarget);
  });

  return null;
};
