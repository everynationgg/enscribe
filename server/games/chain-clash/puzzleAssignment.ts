import { Template } from '../../../shared/types.js';

export function normalizeChainWord(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateSingleChainWord(raw: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeChainWord(raw);
  if (!normalized) {
    return { valid: false, normalized: '', error: 'Word cannot be empty.' };
  }
  if (!/^[A-Z]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Each position must be a single alphabetic English word (no spaces, numbers, or hyphens).',
    };
  }
  if (normalized.length < 2 || normalized.length > 20) {
    return { valid: false, normalized, error: 'Word must be between 2 and 20 letters.' };
  }
  return { valid: true, normalized };
}

export function validateChainWords(words: string[]): { valid: boolean; normalized: string[]; error?: string } {
  if (!Array.isArray(words) || words.length < 3) {
    return { valid: false, normalized: [], error: 'A chain must contain at least 3 words.' };
  }
  const normalized: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const check = validateSingleChainWord(words[i]);
    if (!check.valid) {
      return { valid: false, normalized: [], error: `Word ${i + 1}: ${check.error}` };
    }
    normalized.push(check.normalized);
  }
  return { valid: true, normalized };
}

/**
 * Generates a guaranteed derangement (permutation with zero fixed points: result[i] !== i)
 * using Sattolo's algorithm for a random single-cycle permutation when n >= 2.
 */
export function generateDerangementIndices(n: number): number[] {
  if (n < 2) {
    throw new Error('Derangement requires at least 2 participants.');
  }
  if (n === 2) {
    return [1, 0];
  }
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i); // strictly < i ensures a full single cycle (no fixed points)
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  for (let i = 0; i < n; i++) {
    if (indices[i] === i) {
      throw new Error('Invariant violated: fixed point in derangement');
    }
  }
  return indices;
}

export interface PuzzleSubmissionInput {
  playerId: string;
  words: string[];
}

export interface AssignedPuzzle {
  recipientPlayerId: string;
  authorPlayerId: string | null;
  words: string[];
}

/**
 * Assigns submitted player puzzles so NO player ever solves their own puzzle.
 * For 2 players: A -> B, B -> A.
 * For N > 2 players: verified derangement permutation.
 */
export function assignCustomPuzzlesDeranged(submissions: PuzzleSubmissionInput[]): AssignedPuzzle[] {
  if (submissions.length < 2) {
    throw new Error('At least 2 players are required for custom multiplayer puzzle exchange.');
  }
  const perm = generateDerangementIndices(submissions.length);
  return submissions.map((recipient, idx) => {
    const source = submissions[perm[idx]];
    if (source.playerId === recipient.playerId) {
      throw new Error('Safety check failed: player assigned their own puzzle.');
    }
    return {
      recipientPlayerId: recipient.playerId,
      authorPlayerId: source.playerId,
      words: [...source.words],
    };
  });
}

export function pickCuratedChainsForPlayers(
  playerIds: string[],
  officialTemplates: Template[],
  desiredLength: number,
  sameChainForAll: boolean
): AssignedPuzzle[] {
  if (officialTemplates.length === 0) {
    throw new Error('No curated official templates available in database.');
  }

  const eligible = officialTemplates.filter(
    (t) => !playerIds.includes(t.ownerId)
  );
  const pool = eligible.length > 0 ? eligible : officialTemplates;

  const trimOrFit = (words: string[]): string[] => {
    if (desiredLength >= 3 && words.length > desiredLength) {
      return words.slice(0, desiredLength);
    }
    return [...words];
  };

  if (sameChainForAll) {
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const words = trimOrFit(chosen.words);
    return playerIds.map((pid) => ({
      recipientPlayerId: pid,
      authorPlayerId: chosen.ownerId === 'system' ? null : chosen.ownerId,
      words,
    }));
  }

  // Distinct curated chains where possible
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return playerIds.map((pid, idx) => {
    const tpl = shuffled[idx % shuffled.length];
    return {
      recipientPlayerId: pid,
      authorPlayerId: tpl.ownerId === 'system' ? null : tpl.ownerId,
      words: trimOrFit(tpl.words),
    };
  });
}
