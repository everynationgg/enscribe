import { BoardCoord, CrushItBoardGrid } from './types.js';

const ALPHABET_SIZE = 26;
const CHAR_A = 65;

const DIRS_8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export interface FoundBoardWord {
  word: string;
  path: BoardCoord[];
}

/**
 * Memory-efficient flat TypedArray Trie for fast prefix-pruned board playability
 * solving on 8x8 CrushIt grids.
 *
 * Indexing words of length 3..8 (default) covers all realistic short/medium
 * playable words on an 8x8 board while keeping build time & memory ultra-low on mobile.
 * Full-length word validation (3..15+ letters) still uses the complete dictionary Set.
 */
export class CrushItWordTrie {
  private children: Int32Array;
  private isWord: Uint8Array;
  private nodeCount = 1; // 0 = root
  private capacity: number;
  public readonly maxIndexedLength: number;

  constructor(initialCapacity = 16384, maxIndexedLength = 7) {
    this.capacity = Math.max(256, initialCapacity);
    this.maxIndexedLength = maxIndexedLength;
    this.children = new Int32Array(this.capacity * ALPHABET_SIZE);
    this.isWord = new Uint8Array(this.capacity);
  }

  private ensureCapacity(requiredNodes: number): void {
    if (requiredNodes <= this.capacity) return;
    let nextCap = this.capacity;
    while (nextCap < requiredNodes) {
      nextCap = Math.floor(nextCap * 1.65) + 1024;
    }
    const nextChildren = new Int32Array(nextCap * ALPHABET_SIZE);
    nextChildren.set(this.children);
    const nextIsWord = new Uint8Array(nextCap);
    nextIsWord.set(this.isWord);
    this.children = nextChildren;
    this.isWord = nextIsWord;
    this.capacity = nextCap;
  }

  insert(word: string): void {
    const len = word.length;
    if (len < 3 || len > this.maxIndexedLength) return;

    let node = 0;
    for (let i = 0; i < len; i++) {
      const code = word.charCodeAt(i) - CHAR_A;
      if (code < 0 || code >= ALPHABET_SIZE) return;
      const idx = node * ALPHABET_SIZE + code;
      let next = this.children[idx];
      if (next === 0) {
        this.ensureCapacity(this.nodeCount + 1);
        next = this.nodeCount++;
        this.children[idx] = next;
      }
      node = next;
    }
    this.isWord[node] = 1;
  }

  hasWord(word: string): boolean {
    const len = word.length;
    if (len < 3 || len > this.maxIndexedLength) return false;
    let node = 0;
    for (let i = 0; i < len; i++) {
      const code = word.charCodeAt(i) - CHAR_A;
      if (code < 0 || code >= ALPHABET_SIZE) return false;
      const next = this.children[node * ALPHABET_SIZE + code];
      if (next === 0) return false;
      node = next;
    }
    return this.isWord[node] === 1;
  }

  /**
   * Returns true as soon as ANY valid word (>= minLength) exists on the board.
   * Typically completes in < 0.5ms on playable boards and < 3ms on dead boards.
   */
  hasPlayableWord(board: CrushItBoardGrid, minLength = 3): boolean {
    const rows = board.length;
    if (rows === 0) return false;
    const cols = board[0].length;
    if (cols === 0) return false;

    const codes = new Int8Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      const rowArr = board[r];
      for (let c = 0; c < cols; c++) {
        const ch = rowArr[c]?.letter?.charCodeAt(0) ?? 0;
        const idx = ch - CHAR_A;
        codes[r * cols + c] = idx >= 0 && idx < ALPHABET_SIZE ? idx : -1;
      }
    }

    const visited = new Uint8Array(rows * cols);
    const children = this.children;
    const isWord = this.isWord;
    const maxLen = this.maxIndexedLength;

    const dfs = (r: number, c: number, node: number, depth: number): boolean => {
      if (depth >= minLength && isWord[node] === 1) {
        return true;
      }
      if (depth >= maxLen) return false;

      const cellIdx = r * cols + c;
      visited[cellIdx] = 1;

      for (let d = 0; d < 8; d++) {
        const nr = r + DIRS_8[d][0];
        const nc = c + DIRS_8[d][1];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nIdx = nr * cols + nc;
        if (visited[nIdx]) continue;
        const letterCode = codes[nIdx];
        if (letterCode < 0) continue;
        const nextNode = children[node * ALPHABET_SIZE + letterCode];
        if (nextNode === 0) continue;
        if (dfs(nr, nc, nextNode, depth + 1)) {
          visited[cellIdx] = 0;
          return true;
        }
      }

      visited[cellIdx] = 0;
      return false;
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const letterCode = codes[r * cols + c];
        if (letterCode < 0) continue;
        const firstNode = children[letterCode];
        if (firstNode === 0) continue;
        if (dfs(r, c, firstNode, 1)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Finds up to `limit` valid playable words on the board (useful for testing & verification).
   */
  findPlayableWords(
    board: CrushItBoardGrid,
    limit = 10,
    minLength = 3
  ): FoundBoardWord[] {
    const rows = board.length;
    if (rows === 0) return [];
    const cols = board[0].length;
    if (cols === 0) return [];

    const codes = new Int8Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = board[r][c]?.letter?.charCodeAt(0) ?? 0;
        const idx = ch - CHAR_A;
        codes[r * cols + c] = idx >= 0 && idx < ALPHABET_SIZE ? idx : -1;
      }
    }

    const visited = new Uint8Array(rows * cols);
    const children = this.children;
    const isWord = this.isWord;
    const maxLen = this.maxIndexedLength;
    const found: FoundBoardWord[] = [];
    const seenWords = new Set<string>();
    const path: BoardCoord[] = [];
    const chars: string[] = [];

    const dfs = (r: number, c: number, node: number, depth: number): void => {
      if (found.length >= limit) return;
      if (depth >= minLength && isWord[node] === 1) {
        const word = chars.join('');
        if (!seenWords.has(word)) {
          seenWords.add(word);
          found.push({ word, path: path.map((p) => ({ row: p.row, col: p.col })) });
          if (found.length >= limit) return;
        }
      }
      if (depth >= maxLen) return;

      const cellIdx = r * cols + c;
      visited[cellIdx] = 1;

      for (let d = 0; d < 8; d++) {
        const nr = r + DIRS_8[d][0];
        const nc = c + DIRS_8[d][1];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nIdx = nr * cols + nc;
        if (visited[nIdx]) continue;
        const letterCode = codes[nIdx];
        if (letterCode < 0) continue;
        const nextNode = children[node * ALPHABET_SIZE + letterCode];
        if (nextNode === 0) continue;

        path.push({ row: nr, col: nc });
        chars.push(String.fromCharCode(CHAR_A + letterCode));
        dfs(nr, nc, nextNode, depth + 1);
        chars.pop();
        path.pop();
        if (found.length >= limit) break;
      }

      visited[cellIdx] = 0;
    };

    for (let r = 0; r < rows && found.length < limit; r++) {
      for (let c = 0; c < cols && found.length < limit; c++) {
        const letterCode = codes[r * cols + c];
        if (letterCode < 0) continue;
        const firstNode = children[letterCode];
        if (firstNode === 0) continue;

        path.push({ row: r, col: c });
        chars.push(String.fromCharCode(CHAR_A + letterCode));
        dfs(r, c, firstNode, 1);
        chars.pop();
        path.pop();
      }
    }

    return found;
  }

  getNodeCount(): number {
    return this.nodeCount;
  }
}

export function buildCrushItTrieFromWords(
  words: Iterable<string>,
  maxIndexedLength = 7
): CrushItWordTrie {
  const trie = new CrushItWordTrie(32768, maxIndexedLength);
  for (const raw of words) {
    const clean = raw.trim().toUpperCase();
    if (clean.length >= 3 && clean.length <= maxIndexedLength) {
      trie.insert(clean);
    }
  }
  return trie;
}
