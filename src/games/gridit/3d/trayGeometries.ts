import * as THREE from 'three';
import { GridItBoardBounds, GridItShapeId } from '../../../../shared/gridit/types';

/**
 * Builds 2D shape contour scaled to 3D unit space (1 unit = 64px)
 */
export function createShapeContour(
  shapeId: GridItShapeId,
  bounds: GridItBoardBounds,
  padding: number = 0.55
): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = bounds.width / (2 * 64) + padding;
  const hh = bounds.height / (2 * 64) + padding;

  switch (shapeId) {
    case 'circle': {
      const r = Math.max(hw, hh);
      shape.absarc(0, 0, r, 0, Math.PI * 2, false);
      break;
    }
    case 'hexagon': {
      const segments = 6;
      const rx = hw * 1.05;
      const ry = hh * 1.05;
      for (let i = 0; i < segments; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const x = Math.cos(a) * rx;
        const y = Math.sin(a) * ry;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      break;
    }
    case 'triangle': {
      shape.moveTo(0, -hh * 1.08);
      shape.lineTo(hw * 1.15, hh * 1.02);
      shape.quadraticCurveTo(0, hh * 1.18, -hw * 1.15, hh * 1.02);
      shape.closePath();
      break;
    }
    case 'heart': {
      shape.moveTo(0, hh * 0.95);
      shape.bezierCurveTo(-hw * 0.9, hh * 0.35, -hw * 1.1, -hh * 0.2, -hw * 0.95, -hh * 0.55);
      shape.bezierCurveTo(-hw * 0.7, -hh * 1.05, -hw * 0.15, -hh * 0.9, 0, -hh * 0.5);
      shape.bezierCurveTo(hw * 0.15, -hh * 0.9, hw * 0.7, -hh * 1.05, hw * 0.95, -hh * 0.55);
      shape.bezierCurveTo(hw * 1.1, -hh * 0.2, hw * 0.9, hh * 0.35, 0, hh * 0.95);
      shape.closePath();
      break;
    }
    case 'star': {
      const points = 10;
      const outerR = Math.max(hw, hh) * 1.15;
      const innerR = outerR * 0.54;
      for (let i = 0; i < points; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      break;
    }
    case 'rectangle':
    case 'square':
    default: {
      const cornerR = Math.min(0.65, Math.min(hw, hh) * 0.35);
      const x0 = -hw;
      const x1 = hw;
      const y0 = -hh;
      const y1 = hh;

      shape.moveTo(x0 + cornerR, y0);
      shape.lineTo(x1 - cornerR, y0);
      shape.quadraticCurveTo(x1, y0, x1, y0 + cornerR);
      shape.lineTo(x1, y1 - cornerR);
      shape.quadraticCurveTo(x1, y1, x1 - cornerR, y1);
      shape.lineTo(x0 + cornerR, y1);
      shape.quadraticCurveTo(x0, y1, x0, y1 - cornerR);
      shape.lineTo(x0, y0 + cornerR);
      shape.quadraticCurveTo(x0, y0, x0 + cornerR, y0);
      shape.closePath();
      break;
    }
  }

  return shape;
}

/**
 * Creates a 2D shape with a hollow center (Rim / Frame)
 */
export function createShapeHollowRim(
  shapeId: GridItShapeId,
  bounds: GridItBoardBounds,
  outerPad: number,
  innerPad: number
): THREE.Shape {
  const outer = createShapeContour(shapeId, bounds, outerPad);
  const inner = createShapeContour(shapeId, bounds, innerPad);
  const holePath = new THREE.Path(inner.getPoints(32));
  outer.holes.push(holePath);
  return outer;
}

/**
 * Creates the outer beveled tray wall geometry (hollow so dice sit inside)
 */
export function createTrayWallsGeometry(
  shapeId: GridItShapeId,
  bounds: GridItBoardBounds
): THREE.BufferGeometry {
  const rimShape = createShapeHollowRim(shapeId, bounds, 0.55, 0.35);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 2,
    depth: 0.65,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.15,
    bevelSegments: 4,
  };
  const geom = new THREE.ExtrudeGeometry(rimShape, extrudeSettings);
  geom.rotateX(Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates the tray bottom floor plate
 */
export function createTrayFloorGeometry(
  shapeId: GridItShapeId,
  bounds: GridItBoardBounds
): THREE.BufferGeometry {
  const floorShape = createShapeContour(shapeId, bounds, 0.52);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 3,
  };
  const geom = new THREE.ExtrudeGeometry(floorShape, extrudeSettings);
  geom.rotateX(Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates the gold metallic rim trim geometry (HOLLOW rim border)
 */
export function createGoldTrimGeometry(
  shapeId: GridItShapeId,
  bounds: GridItBoardBounds
): THREE.BufferGeometry {
  const rimShape = createShapeHollowRim(shapeId, bounds, 0.58, 0.36);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 3,
  };
  const geom = new THREE.ExtrudeGeometry(rimShape, extrudeSettings);
  geom.rotateX(Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates the tall transparent violet-tinted lid walls geometry (HOLLOW)
 * Height ~2.1 allows tumbling dice inside
 */
export function createTallLidWallsGeometry(
  shapeId: GridItShapeId,
  bounds: GridItBoardBounds
): THREE.BufferGeometry {
  const lidRimShape = createShapeHollowRim(shapeId, bounds, 0.52, 0.44);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 2,
    depth: 2.1,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 3,
  };
  const geom = new THREE.ExtrudeGeometry(lidRimShape, extrudeSettings);
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates the tall lid top ceiling transparent plate
 */
export function createTallLidCeilingGeometry(
  shapeId: GridItShapeId,
  bounds: GridItBoardBounds
): THREE.BufferGeometry {
  const capShape = createShapeContour(shapeId, bounds, 0.52);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3,
  };
  const geom = new THREE.ExtrudeGeometry(capShape, extrudeSettings);
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a paw-shaped latch geometry (pad + 4 toes)
 */
export function createPawLatchGeometries(): {
  mainPad: THREE.BufferGeometry;
  toes: THREE.BufferGeometry[];
} {
  const mainPad = new THREE.CylinderGeometry(0.22, 0.18, 0.08, 16);
  mainPad.scale(1.2, 1, 0.9);

  const toeGeom = new THREE.CylinderGeometry(0.065, 0.06, 0.08, 12);
  const toeOffsets = [
    [-0.18, 0, -0.22],
    [-0.06, 0, -0.28],
    [0.06, 0, -0.28],
    [0.18, 0, -0.22],
  ];

  const toes = toeOffsets.map((offset) => {
    const t = toeGeom.clone();
    t.translate(offset[0], offset[1], offset[2]);
    return t;
  });

  return { mainPad, toes };
}

/**
 * Creates a canvas texture for the gold "GRIDIT" embossed nameplate
 */
export function createNameplateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Shiny metallic gold plate
  const grad = ctx.createLinearGradient(0, 0, 512, 128);
  grad.addColorStop(0, '#fef08a');
  grad.addColorStop(0.3, '#f59e0b');
  grad.addColorStop(0.6, '#fbbf24');
  grad.addColorStop(1, '#b45309');

  ctx.fillStyle = grad;
  ctx.roundRect(12, 12, 488, 104, 20);
  ctx.fill();

  // Bevel borders
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fef9c3';
  ctx.stroke();

  // Nameplate text: GRIDIT
  ctx.font = '900 64px "Arial Rounded MT Bold", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#451a03'; // Deep bronze embossed lettering
  ctx.shadowColor = 'rgba(254, 240, 138, 0.8)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText('GRIDIT', 256, 68);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
