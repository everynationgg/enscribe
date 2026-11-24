import { Template } from '../../../shared/types.js';
import { generateLocalWordChainSync } from './clueProvider.js';

const recentAssignedSignatures: string[] = [];
const recentAssignedSigSet = new Set<string>();
const recentAssignedWords: string[] = [];

function recordAssignedChain(words: string[]): void {
  const sig = words.join('>');
  if (!recentAssignedSigSet.has(sig)) {
    recentAssignedSignatures.push(sig);
    recentAssignedSigSet.add(sig);
    while (recentAssignedSignatures.length > 200) {
      const dropped = recentAssignedSignatures.shift()!;
      recentAssignedSigSet.delete(dropped);
    }
  }
  for (const w of words) {
    recentAssignedWords.push(w);
    while (recentAssignedWords.length > 120) {
      recentAssignedWords.shift();
    }
  }
}

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

  const targetLen = desiredLength >= 3 ? Math.min(8, desiredLength) : 5;
  const eligible = officialTemplates.filter((t) => !playerIds.includes(t.ownerId));
  const pool = eligible.length > 0 ? eligible : officialTemplates;

  const trimOrFit = (words: string[]): string[] => {
    if (targetLen >= 3 && words.length > targetLen) {
      return words.slice(0, targetLen);
    }
    return [...words];
  };

  const pickFreshChain = (extraExcludeSigs: Set<string>): { authorPlayerId: string | null; words: string[] } => {
    const unseenTemplates = pool.filter((t) => {
      const fitted = trimOrFit(t.words);
      const sig = fitted.join('>');
      return !recentAssignedSigSet.has(sig) && !extraExcludeSigs.has(sig);
    });

    // Blend unseen curated templates sparingly with dynamically synthesized graph chains
    // (~95% dynamic graph chains from millions of walks) so multiplayer rounds never obviously repeat
    const useDynamic = unseenTemplates.length === 0 || Math.random() < 0.95;
    if (!useDynamic && unseenTemplates.length > 0) {
      const chosen = unseenTemplates[Math.floor(Math.random() * unseenTemplates.length)];
      const words = trimOrFit(chosen.words);
      recordAssignedChain(words);
      extraExcludeSigs.add(words.join('>'));
      return {
        authorPlayerId: chosen.ownerId === 'system' ? null : chosen.ownerId,
        words,
      };
    }

    const gen = generateLocalWordChainSync('Adventure', targetLen, {
      excludeWords: recentAssignedWords.slice(-24),
      excludeChains: [...recentAssignedSignatures, ...extraExcludeSigs],
    });
    recordAssignedChain(gen.words);
    extraExcludeSigs.add(gen.words.join('>'));
    return {
      authorPlayerId: null,
      words: gen.words,
    };
  };

  const sessionSigs = new Set<string>();

  if (sameChainForAll) {
    const picked = pickFreshChain(sessionSigs);
    return playerIds.map((pid) => ({
      recipientPlayerId: pid,
      authorPlayerId: picked.authorPlayerId,
      words: [...picked.words],
    }));
  }

  return playerIds.map((pid) => {
    const picked = pickFreshChain(sessionSigs);
    return {
      recipientPlayerId: pid,
      authorPlayerId: picked.authorPlayerId,
      words: picked.words,
    };
  });
}
