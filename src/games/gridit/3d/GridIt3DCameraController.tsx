import React, { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { GridItBoard } from '../../../../shared/gridit/types';

interface GridIt3DCameraControllerProps {
  board: GridItBoard;
  rotateMode: boolean;
  isShaking: boolean;
  resetViewTrigger: number;
}

export const GridIt3DCameraController: React.FC<GridIt3DCameraControllerProps> = ({
  board,
  rotateMode,
  isShaking,
  resetViewTrigger,
}) => {
  const { camera, gl } = useThree();

  const hw = board.bounds.width / (2 * 64);
  const hh = board.bounds.height / (2 * 64);
  const boardRadius = Math.hypot(hw, hh);

  // Compute optimal default distance based on aspect ratio
  const computeFitDistance = useCallback(() => {
    const size = gl.domElement.getBoundingClientRect();
    const aspect = size.width / Math.max(1, size.height);
    const baseDist = Math.max(5.8, boardRadius * 1.55);
    return aspect < 1.0 ? baseDist / Math.max(0.58, aspect * 0.92) : baseDist;
  }, [boardRadius, gl.domElement]);

  const defaultDistance = computeFitDistance();
  const defaultPolar = 0.76; // ~43.5 degrees overhead angle (clear board readability with 3D depth)
  const defaultAzimuth = 0;

  // Spherical coordinates
  const currentSpherical = useRef(new THREE.Spherical(defaultDistance, defaultPolar, defaultAzimuth));
  const targetSpherical = useRef(new THREE.Spherical(defaultDistance, defaultPolar, defaultAzimuth));
  const isResetting = useRef(false);

  // Reset view to default overhead perspective
  const triggerReset = useCallback(() => {
    targetSpherical.current.radius = computeFitDistance();
    targetSpherical.current.phi = defaultPolar;
    targetSpherical.current.theta = defaultAzimuth;
    isResetting.current = true;
  }, [computeFitDistance]);

  useEffect(() => {
    if (resetViewTrigger > 0) {
      triggerReset();
    }
  }, [resetViewTrigger, triggerReset]);

  // Adjust on canvas resize
  useEffect(() => {
    const onResize = () => {
      if (!isShaking) {
        targetSpherical.current.radius = computeFitDistance();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computeFitDistance, isShaking]);

  // Touch and Mouse gesture bindings for camera orbit & zoom
  useEffect(() => {
    const dom = gl.domElement;
    if (!dom) return;

    let isOrbiting = false;
    let lastX = 0;
    let lastY = 0;
    let initialPinchDist = 0;

    const onPointerDown = (e: PointerEvent) => {
      // Right button, middle button, or Rotate Mode initiates camera orbit
      const isRightOrMiddle = e.button === 2 || e.button === 1 || e.shiftKey || e.altKey;
      if (rotateMode || isRightOrMiddle) {
        isOrbiting = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isOrbiting) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      targetSpherical.current.theta -= dx * 0.007;
      targetSpherical.current.phi = THREE.MathUtils.clamp(
        targetSpherical.current.phi + dy * 0.007,
        0.22, // near top-down
        1.52  // near horizontal side view
      );
      isResetting.current = false;
    };

    const onPointerUp = () => {
      isOrbiting = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      const fitD = computeFitDistance();
      targetSpherical.current.radius = THREE.MathUtils.clamp(
        targetSpherical.current.radius * zoomFactor,
        fitD * 0.6,
        fitD * 2.2
      );
      isResetting.current = false;
    };

    // Mobile 2-finger pinch zoom and rotate
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        if (initialPinchDist > 0) {
          const factor = initialPinchDist / dist;
          const fitD = computeFitDistance();
          targetSpherical.current.radius = THREE.MathUtils.clamp(
            targetSpherical.current.radius * factor,
            fitD * 0.6,
            fitD * 2.2
          );
        }
        initialPinchDist = dist;

        // 2-finger pan/orbit
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        if (lastX !== 0 && lastY !== 0) {
          const dx = midX - lastX;
          const dy = midY - lastY;
          targetSpherical.current.theta -= dx * 0.008;
          targetSpherical.current.phi = THREE.MathUtils.clamp(
            targetSpherical.current.phi + dy * 0.008,
            0.22,
            1.52
          );
        }
        lastX = midX;
        lastY = midY;
        isResetting.current = false;
      }
    };

    const onTouchEnd = () => {
      initialPinchDist = 0;
      lastX = 0;
      lastY = 0;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('touchmove', onTouchMove, { passive: false });
    dom.addEventListener('touchend', onTouchEnd);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
    };
  }, [computeFitDistance, gl.domElement, rotateMode]);

  useFrame((_, delta) => {
    const lerpSpeed = isResetting.current ? 12 : 9;

    // Smoothly interpolate spherical coordinates
    currentSpherical.current.radius = THREE.MathUtils.damp(
      currentSpherical.current.radius,
      targetSpherical.current.radius,
      lerpSpeed,
      delta
    );
    currentSpherical.current.phi = THREE.MathUtils.damp(
      currentSpherical.current.phi,
      targetSpherical.current.phi,
      lerpSpeed,
      delta
    );
    currentSpherical.current.theta = THREE.MathUtils.damp(
      currentSpherical.current.theta,
      targetSpherical.current.theta,
      lerpSpeed,
      delta
    );

    // Apply to Three.js camera
    camera.position.setFromSpherical(currentSpherical.current);
    camera.lookAt(0, 0.2, 0);
  });

  return null;
};
