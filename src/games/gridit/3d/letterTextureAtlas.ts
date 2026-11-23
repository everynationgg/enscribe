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
 * - Bold rounded sans-serif letter in deep midnight indigo (#110e2e)
 * - Clean ivory/white face base so cube material colors/shaders (Rainbow/Gold)
 *   tint the die without ever obscuring the letter
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
  const key = `${upper}_ps:${Boolean(options.isPaused)}_em:${Boolean(options.isEmptySlot)}`;

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
  const r = 36;

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

  // Clean luminous ivory-white base so 3D cube materials (standard, metallic gold,
  // animated rainbow iridescent) modulate cleanly while keeping high letter contrast
  const ivoryGrad = ctx.createRadialGradient(w / 2, h / 2 - 20, 10, w / 2, h / 2, w * 0.7);
  ivoryGrad.addColorStop(0, '#ffffff');
  ivoryGrad.addColorStop(0.8, '#f8f6f0');
  ivoryGrad.addColorStop(1, '#efeae0');
  ctx.fillStyle = ivoryGrad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(205, 195, 180, 0.45)';
  ctx.lineWidth = 4;
  ctx.stroke();

  if (options.isPaused) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 120px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', w / 2, h / 2 + 6);
  } else if (options.isEmptySlot) {
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 14, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Bold, crisp, unmistakable letter for normal, Rainbow Wildcard, and Golden dice alike
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = w / 2;
    const textY = h / 2 + 4;

    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = '#110e2e';
    ctx.font = '900 138px "Arial Rounded MT Bold", system-ui, -apple-system, sans-serif';
    ctx.fillText(upper, textX, textY);
    ctx.restore();

    if (AMBIGUOUS_ORIENTATION_LETTERS.has(upper)) {
      ctx.fillStyle = '#110e2e';
      ctx.beginPath();
      ctx.arc(w / 2, h - 28, 7, 0, Math.PI * 2);
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
