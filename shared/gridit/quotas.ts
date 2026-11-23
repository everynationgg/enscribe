import { getShapeTemplate } from './shapes.js';
import { GridItBoardSize, GridItShapeId } from './types.js';

export interface GridItLengthQuota {
  id: string;
  label: string;
  minLength: number;
  maxLength?: number;
  required: number;
}

export interface GridItQuotaProgressItem extends GridItLengthQuota {
  found: number;
  met: boolean;
}

export interface GridItQuotaEvaluation {
  items: GridItQuotaProgressItem[];
  allMet: boolean;
  totalRequired: number;
  totalFoundQualified: number;
}

/**
 * Data-driven provisional word-length quotas scaled by shape & tile count.
 * Avoids any artificial 7-letter ceiling so larger boards can require 7+ letter words.
 */
export function getBoardQuotas(
  shapeId: GridItShapeId,
  sizeId: GridItBoardSize
): GridItLengthQuota[] {
  const meta = getShapeTemplate(shapeId);
  const tileCount = meta.sizes[sizeId].tileCount;

  // Compact boards (small or <= 22 tiles)
  if (sizeId === 'small' && tileCount <= 25) {
    return [
      { id: 'len_3', label: '3-letter words', minLength: 3, maxLength: 3, required: 3 },
      { id: 'len_4', label: '4-letter words', minLength: 4, maxLength: 4, required: 2 },
      { id: 'len_5plus', label: '5+-letter words', minLength: 5, required: 1 },
    ];
  }

  // Medium boards (e.g., Heart Medium 37 tiles, Square Medium 25 tiles)
  if (sizeId === 'medium' || tileCount <= 40) {
    return [
      { id: 'len_3', label: '3-letter words', minLength: 3, maxLength: 3, required: 4 },
      { id: 'len_4', label: '4-letter words', minLength: 4, maxLength: 4, required: 3 },
      { id: 'len_5', label: '5-letter words', minLength: 5, maxLength: 5, required: 2 },
      { id: 'len_6plus', label: '6+-letter words', minLength: 6, required: 1 },
    ];
  }

  // Large boards (> 40 tiles) — explicitly supports 7+ letter words
  return [
    { id: 'len_3', label: '3-letter words', minLength: 3, maxLength: 3, required: 5 },
    { id: 'len_4', label: '4-letter words', minLength: 4, maxLength: 4, required: 4 },
    { id: 'len_5', label: '5-letter words', minLength: 5, maxLength: 5, required: 3 },
    { id: 'len_6', label: '6-letter words', minLength: 6, maxLength: 6, required: 2 },
    { id: 'len_7plus', label: '7+-letter words', minLength: 7, required: 1 },
  ];
}

export function evaluateQuotaProgress(
  words: string[],
  shapeId: GridItShapeId,
  sizeId: GridItBoardSize
): GridItQuotaEvaluation {
  const uniqueWords = Array.from(
    new Set(
      words
        .map((w) => w.trim().toUpperCase())
        .filter((w) => w.length >= 3)
    )
  );
  const quotas = getBoardQuotas(shapeId, sizeId);

  const items: GridItQuotaProgressItem[] = quotas.map((q) => {
    const matches = uniqueWords.filter((w) => {
      if (w.length < q.minLength) return false;
      if (q.maxLength !== undefined && w.length > q.maxLength) return false;
      return true;
    });
    const found = matches.length;
    return {
      ...q,
      found,
      met: found >= q.required,
    };
  });

  return {
    items,
    allMet: items.every((i) => i.met),
    totalRequired: items.reduce((acc, i) => acc + i.required, 0),
    totalFoundQualified: uniqueWords.length,
  };
}
