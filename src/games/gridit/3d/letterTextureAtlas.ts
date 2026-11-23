import * as THREE from 'three';

const textureCache = new Map<string, THREE.CanvasTexture>();

const AMBIGUOUS_ORIENTATION_LETTERS = new Set([
  'M',
  'W',
  'N',
  'Z',
  'U',
  'H',
  'I',
  'O',
  'S',
  'X',
]);

/**
 * Creates or retrieves a cached high-resolution canvas texture for a die face.
 * - Bold rounded sans-serif letter in deep midnight indigo
 * - Cream/ivory background with subtle bevel and soft shadow
 * - Subtle orientation dot under ambiguous letters
 */
export function getLetterTexture(
  letter: string,
  options: {
    isRainbow?: boolean;
    isGolden?: boolean;
    isPaused?: boolean;
    isEmptySlot?: boolean;
  } = {}
): THREE.CanvasTexture {
  const upper = (letter || '').trim().toUpperCase() || '·';
  const key = `${upper}_rb:${Boolean(options.isRainbow)}_gd:${Boolean(
    options.isGolden
  )}_ps:${Boolean(options.isPaused)}_em:${Boolean(options.isEmptySlot)}`;

  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    textureCache.set(key, fallback);
    return fallback;
  }

  const w = 256;
  const h = 256;
  const r = 36; // rounded corner radius on face

  // Background gradient / base
  ctx.clearRect(0, 0, w, h);

  // Rounded face base
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  if (options.isGolden) {
    const goldGrad = ctx.createLinearGradient(0, 0, w, h);
    goldGrad.addColorStop(0, '#fef08a');
    goldGrad.addColorStop(0.3, '#facc15');
    goldGrad.addColorStop(0.7, '#eab308');
    goldGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = goldGrad;
  } else if (options.isRainbow) {
    const rbGrad = ctx.createLinearGradient(0, 0, w, h);
    rbGrad.addColorStop(0, '#f472b6');
    rbGrad.addColorStop(0.25, '#c084fc');
    rbGrad.addColorStop(0.5, '#60a5fa');
    rbGrad.addColorStop(0.75, '#34d399');
    rbGrad.addColorStop(1, '#fde047');
    ctx.fillStyle = rbGrad;
  } else {
    // Creamy ivory base
    const ivoryGrad = ctx.createRadialGradient(w / 2, h / 2 - 20, 10, w / 2, h / 2, w * 0.7);
    ivoryGrad.addColorStop(0, '#ffffff');
    ivoryGrad.addColorStop(0.8, '#f7f4ec');
    ivoryGrad.addColorStop(1, '#ebe5d8');
    ctx.fillStyle = ivoryGrad;
  }
  ctx.fill();

  // Subtle inner face border
  ctx.strokeStyle = options.isGolden
    ? 'rgba(254, 240, 138, 0.6)'
    : options.isRainbow
    ? 'rgba(255, 255, 255, 0.7)'
    : 'rgba(215, 205, 190, 0.45)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Face Content / Letter
  if (options.isPaused) {
    // Hidden question mark
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 120px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', w / 2, h / 2 + 6);
  } else if (options.isEmptySlot) {
    // Dot slot
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 14, 0, Math.PI * 2);
    ctx.fill();
  } else if (options.isRainbow) {
    // Holographic Star Icon
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 16;
    drawStar(ctx, w / 2, h / 2, 5, 54, 26);
    ctx.fill();
    ctx.restore();

    // Small "WILD" label at bottom
    ctx.font = '800 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WILD', w / 2, h - 36);
  } else {
    // Standard or Golden Letter
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = w / 2;
    const textY = h / 2 + 4;

    if (options.isGolden) {
      // 24k Gold Letter with Crown hint
      ctx.shadowColor = 'rgba(161, 98, 7, 0.6)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#451a03';
      ctx.font = '900 128px "Arial Rounded MT Bold", system-ui, -apple-system, sans-serif';
      ctx.fillText(upper, textX, textY);

      // Crown badge text
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#78350f';
      ctx.fillText('👑 2×', textX, h - 32);
    } else {
      // Deep midnight indigo lettering (matching reference)
      ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 3;

      ctx.fillStyle = '#1e1b4b'; // Deep navy/purple as in reference
      ctx.font = '900 134px "Arial Rounded MT Bold", system-ui, -apple-system, sans-serif';
      ctx.fillText(upper, textX, textY);
    }
    ctx.restore();

    // Orientation dot for ambiguous letters
    if (!options.isGolden && AMBIGUOUS_ORIENTATION_LETTERS.has(upper)) {
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(w / 2, h - 30, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  textureCache.set(key, texture);
  return texture;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/**
 * Standard English Boggle letter distribution faces for random tumbling dice
 */
export const BOGGLE_DIE_FACES = [
  ['A', 'A', 'E', 'E', 'G', 'N'],
  ['A', 'B', 'B', 'J', 'O', 'O'],
  ['A', 'C', 'H', 'O', 'P', 'S'],
  ['A', 'F', 'F', 'K', 'P', 'S'],
  ['A', 'O', 'O', 'T', 'T', 'W'],
  ['C', 'I', 'M', 'O', 'T', 'U'],
  ['D', 'E', 'I', 'L', 'R', 'X'],
  ['D', 'E', 'L', 'R', 'V', 'Y'],
  ['D', 'I', 'S', 'T', 'T', 'Y'],
  ['E', 'E', 'G', 'H', 'N', 'W'],
  ['E', 'E', 'I', 'N', 'S', 'U'],
  ['E', 'H', 'R', 'T', 'V', 'W'],
  ['E', 'I', 'O', 'S', 'S', 'T'],
  ['E', 'L', 'R', 'T', 'T', 'Y'],
  ['H', 'I', 'M', 'N', 'Q', 'U'],
  ['H', 'L', 'N', 'N', 'R', 'Z'],
];
