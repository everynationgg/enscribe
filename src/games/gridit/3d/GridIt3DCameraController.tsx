import React, { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { GridItBoard } from '../../../../shared/gridit/types';

interface GridIt3DCameraControllerProps {
  board: GridItBoard;
  isShaking: boolean;
  resetViewTrigger: number;
  readOnly?: boolean;
  isDraggingWordRef?: React.MutableRefObject<boolean>;
}

export const GridIt3DCameraController: React.FC<GridIt3DCameraControllerProps> = ({
  board,
  isShaking,
  resetViewTrigger,
  readOnly = false,
  isDraggingWordRef,
}) => {
  const { camera, gl } = useThree();

  const hw = board.bounds.width / (2 * 64);
  const hh = board.bounds.height / (2 * 64);
  const boardRadius = Math.hypot(hw, hh);

  // Compute optimal default distance for a top-down orthographic-like fit
  const computeFitDistance = useCallback(() => {
    const size = gl.domElement.getBoundingClientRect();
    const aspect = size.width / Math.max(1, size.height);
    const baseDist = Math.max(5.8, boardRadius * 1.55);
    return aspect < 1.0 ? baseDist / Math.max(0.58, aspect * 0.92) : baseDist;
  }, [boardRadius, gl.domElement]);

  const defaultDistance = computeFitDistance();
  // Lock to a slight overhead angle — close to top-down but with enough 3D
  // depth that dice, box walls, and shadows remain visible.
  const LOCKED_POLAR = 0.18; // ~10° from straight-down
  const defaultAzimuth = 0;

  // Camera state: radius (zoom), fixed polar, free azimuth (yaw rotation),
  // and an XZ pan offset.
  const currentSpherical = useRef(new THREE.Spherical(defaultDistance, LOCKED_POLAR, defaultAzimuth));
  const targetSpherical = useRef(new THREE.Spherical(defaultDistance, LOCKED_POLAR, defaultAzimuth));
  const panOffset = useRef(new THREE.Vector2(0, 0));
  const targetPan = useRef(new THREE.Vector2(0, 0));
  const isResetting = useRef(false);

  // Reset view to default top-down, centered, default zoom
  const triggerReset = useCallback(() => {
    targetSpherical.current.radius = computeFitDistance();
    targetSpherical.current.phi = LOCKED_POLAR;
    targetSpherical.current.theta = defaultAzimuth;
    targetPan.current.set(0, 0);
    isResetting.current = true;
  }, [computeFitDistance]);

  useEffect(() => {
    if (resetViewTrigger > 0) {
      triggerReset();
    }
  }, [resetViewTrigger, triggerReset]);

  // Adjust zoom on canvas resize
  useEffect(() => {
    const onResize = () => {
      if (!isShaking) {
        targetSpherical.current.radius = computeFitDistance();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computeFitDistance, isShaking]);

  // Gesture bindings: 1-finger rotate / pan, scroll-wheel zoom, 2-finger pinch-zoom + rotate
  useEffect(() => {
    const dom = gl.domElement;
    if (!dom) return;

    let gestureType: 'none' | 'rotate' | 'pan' = 'none';
    let lastX = 0;
    let lastY = 0;
    let initialPinchDist = 0;
    let initialPinchAngle = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (isShaking) return;
      const isSecondary = e.button === 2 || e.button === 1 || e.shiftKey || e.altKey;

      // If the user tapped a die (R3F handler fires first and sets the ref),
      // don't start camera gesture — word tracing takes priority.
      const hitDie = !readOnly && isDraggingWordRef?.current;
      if (hitDie && !isSecondary) return;

      // Secondary buttons (right/middle) or shift/alt = pan; primary on
      // empty space = rotate.
      gestureType = isSecondary ? 'pan' : 'rotate';
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (gestureType === 'none') return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (gestureType === 'rotate') {
        // Horizontal drag rotates the board around Y (theta only)
        targetSpherical.current.theta -= dx * 0.007;
        // phi stays locked — no vertical tilt changes
      } else {
        // Pan: shift the lookAt target on the XZ plane
        const theta = currentSpherical.current.theta;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const panSpeed = 0.006 * (currentSpherical.current.radius / defaultDistance);
        targetPan.current.x += (-dx * cosT - dy * sinT) * panSpeed;
        targetPan.current.y += (dx * sinT - dy * cosT) * panSpeed;
      }
      isResetting.current = false;
    };

    const onPointerUp = () => {
      gestureType = 'none';
    };

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

    // Mobile 2-finger: pinch-zoom + rotation
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialPinchDist = Math.max(10, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
        initialPinchAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
        lastX = (t1.clientX + t2.clientX) / 2;
        lastY = (t1.clientY + t2.clientY) / 2;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.max(10, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

        // Pinch zoom
        if (initialPinchDist > 0) {
          const factor = initialPinchDist / dist;
          const fitD = computeFitDistance();
          targetSpherical.current.radius = THREE.MathUtils.clamp(
            targetSpherical.current.radius * factor,
            fitD * 0.45,
            fitD * 2.4
          );
        }

        // Two-finger twist → board rotation (theta only)
        if (initialPinchAngle !== 0) {
          const dAngle = angle - initialPinchAngle;
          targetSpherical.current.theta -= dAngle;
        }

        initialPinchDist = dist;
        initialPinchAngle = angle;

        // Two-finger pan
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        if (lastX !== 0 && lastY !== 0) {
          const dx = midX - lastX;
          const dy = midY - lastY;
          const theta = currentSpherical.current.theta;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const panSpeed = 0.006 * (currentSpherical.current.radius / defaultDistance);
          targetPan.current.x += (-dx * cosT - dy * sinT) * panSpeed;
          targetPan.current.y += (dx * sinT - dy * cosT) * panSpeed;
        }
        lastX = midX;
        lastY = midY;
        isResetting.current = false;
      }
    };

    const onTouchEnd = () => {
      initialPinchDist = 0;
      initialPinchAngle = 0;
      lastX = 0;
      lastY = 0;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    dom.addEventListener('touchmove', onTouchMove, { passive: false });
    dom.addEventListener('touchend', onTouchEnd);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
    };
  }, [computeFitDistance, defaultDistance, gl.domElement, isShaking, readOnly, isDraggingWordRef]);

  useFrame((_, delta) => {
    const lerpSpeed = isResetting.current ? 12 : 9;

    // Smoothly interpolate spherical coordinates
    currentSpherical.current.radius = THREE.MathUtils.damp(
      currentSpherical.current.radius,
      targetSpherical.current.radius,
      lerpSpeed,
      delta
    );
    // Phi is always locked to top-down
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

    // Smooth pan offset
    panOffset.current.x = THREE.MathUtils.damp(panOffset.current.x, targetPan.current.x, lerpSpeed, delta);
    panOffset.current.y = THREE.MathUtils.damp(panOffset.current.y, targetPan.current.y, lerpSpeed, delta);

    // Apply camera position from spherical + pan
    camera.position.setFromSpherical(currentSpherical.current);
    camera.position.x += panOffset.current.x;
    camera.position.z += panOffset.current.y;

    const lookTarget = new THREE.Vector3(panOffset.current.x, 0.2, panOffset.current.y);
    camera.lookAt(lookTarget);
  });

  return null;
};
