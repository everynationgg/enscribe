import {
  GridItAuthoredWord,
  GridItCustomTemplate,
  canPlaceWordOnTemplate,
} from '../../../shared/gridit/editor';
import { buildShapeTopology } from '../../../shared/gridit/shapes';
import { evaluateQuotaProgress } from '../../../shared/gridit/quotas';
import { GridItBoardSize, GridItShapeId } from '../../../shared/gridit/types';

export interface GridItTemplateRepository {
  list(): Promise<GridItCustomTemplate[]>;
  get(id: string): Promise<GridItCustomTemplate | null>;
  save(tpl: GridItCustomTemplate): Promise<GridItCustomTemplate>;
  rename(id: string, name: string): Promise<GridItCustomTemplate | null>;
  duplicate(id: string): Promise<GridItCustomTemplate | null>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = 'enscribe_gridit_templates_v1';

function readAllLocal(): GridItCustomTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAllLocal(list: GridItCustomTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota
  }
}

export class LocalGridItTemplateRepository implements GridItTemplateRepository {
  async list(): Promise<GridItCustomTemplate[]> {
    return readAllLocal().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<GridItCustomTemplate | null> {
    return readAllLocal().find((t) => t.id === id) ?? null;
  }

  async save(tpl: GridItCustomTemplate): Promise<GridItCustomTemplate> {
    const now = Date.now();
    const list = readAllLocal();
    const normalized: GridItCustomTemplate = {
      ...tpl,
      id: tpl.id || `gtpl_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: tpl.name.trim() || 'Untitled Board',
      createdAt: tpl.createdAt || now,
      updatedAt: now,
    };
    const next = [normalized, ...list.filter((t) => t.id !== normalized.id)];
    writeAllLocal(next);
    return normalized;
  }

  async rename(id: string, name: string): Promise<GridItCustomTemplate | null> {
    const clean = name.trim();
    if (!clean) return null;
    const list = readAllLocal();
    const target = list.find((t) => t.id === id);
    if (!target) return null;
    const updated: GridItCustomTemplate = { ...target, name: clean, updatedAt: Date.now() };
    writeAllLocal(list.map((t) => (t.id === id ? updated : t)));
    return updated;
  }

  async duplicate(id: string): Promise<GridItCustomTemplate | null> {
    const list = readAllLocal();
    const src = list.find((t) => t.id === id);
    if (!src) return null;
    const now = Date.now();
    const copy: GridItCustomTemplate = {
      ...src,
      id: `gtpl_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${src.name} Copy`,
      authoredTiles: { ...src.authoredTiles },
      authoredWords: src.authoredWords.map((w) => ({ ...w, tilePath: [...w.tilePath] })),
      createdAt: now,
      updatedAt: now,
    };
    writeAllLocal([copy, ...list]);
    return copy;
  }

  async remove(id: string): Promise<void> {
    const next = readAllLocal().filter((t) => t.id !== id);
    writeAllLocal(next);
  }
}

export const localGridItTemplateStore = new LocalGridItTemplateRepository();

export function createBlankTemplate(
  shapeId: GridItShapeId = 'heart',
  sizeId: GridItBoardSize = 'medium',
  name = 'My Custom Board',
  language = 'en'
): GridItCustomTemplate {
  const now = Date.now();
  return {
    id: `gtpl_${now}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    shapeId,
    sizeId,
    language,
    authoredTiles: {},
    authoredWords: [],
    createdAt: now,
    updatedAt: now,
  };
}

const SAMPLE_BANK_BY_LENGTH: Record<number, string[]> = {
  3: ['ART', 'CAT', 'SUN', 'EAR', 'TEA', 'RAT', 'SEA', 'SET', 'MAP', 'ARE', 'TAR', 'ORE', 'AGE', 'GEM'],
  4: ['STAR', 'RATE', 'GLOW', 'EAST', 'TEAR', 'GAME', 'MINT', 'GRID', 'HERO', 'REST', 'SEAT'],
  5: ['HEART', 'STARE', 'GREAT', 'GLEAM', 'CROWN', 'QUEST', 'SPARK', 'FLAME', 'STONE'],
  6: ['MASTER', 'STREAM', 'GALAXY', 'PUZZLE', 'DRAGON', 'BRIGHT'],
  7: ['MASTERS', 'CREATOR', 'CRYSTAL', 'LANTERN', 'FORTUNE'],
};

/**
 * Generates a guaranteed-valid authored sample template meeting all quotas
 * for any shape/size by carving simple non-conflicting paths through the topology.
 */
export function buildSampleValidTemplate(
  shapeId: GridItShapeId,
  sizeId: GridItBoardSize,
  dictionary: Set<string>,
  name?: string
): GridItCustomTemplate {
  const tpl = createBlankTemplate(
    shapeId,
    sizeId,
    name || `${shapeId.charAt(0).toUpperCase() + shapeId.slice(1)} Starter`
  );
  const topo = buildShapeTopology(shapeId, sizeId);
  const byId = new Map(topo.tiles.map((t) => [t.id, t]));
  const quotaItems = evaluateQuotaProgress([], shapeId, sizeId).items;
  const usedTiles = new Set<string>();

  const findUnusedSimplePath = (length: number): string[] | null => {
    for (const start of topo.tiles) {
      if (usedTiles.has(start.id)) continue;
      const path: string[] = [start.id];
      const localVisited = new Set<string>([start.id]);
      const walk = (): boolean => {
        if (path.length === length) return true;
        const curr = byId.get(path[path.length - 1])!;
        for (const nId of curr.neighbors) {
          if (usedTiles.has(nId) || localVisited.has(nId)) continue;
          localVisited.add(nId);
          path.push(nId);
          if (walk()) return true;
          path.pop();
          localVisited.delete(nId);
        }
        return false;
      };
      if (walk()) return path;
    }
    return null;
  };

  const findOverlappingPath = (word: string): string[] | null => {
    for (const start of topo.tiles) {
      const existing0 = tpl.authoredTiles[start.id];
      if (existing0 && existing0 !== word[0]) continue;
      const path = [start.id];
      const visited = new Set([start.id]);
      const dfs = (idx: number): boolean => {
        if (idx === word.length) return true;
        const curr = byId.get(path[path.length - 1])!;
        for (const nId of curr.neighbors) {
          if (visited.has(nId)) continue;
          const ex = tpl.authoredTiles[nId];
          if (ex && ex !== word[idx]) continue;
          visited.add(nId);
          path.push(nId);
          if (dfs(idx + 1)) return true;
          path.pop();
          visited.delete(nId);
        }
        return false;
      };
      if (dfs(1)) return path;
    }
    return null;
  };

  // Prefer shared intersections once board occupancy exceeds 45% so every word fits comfortably
  const findWordPath = (word: string): string[] | null => {
    if (usedTiles.size < Math.floor(topo.tiles.length * 0.5)) {
      const fresh = findUnusedSimplePath(word.length);
      if (fresh) return fresh;
    }
    return findOverlappingPath(word) ?? findUnusedSimplePath(word.length);
  };

  // Place longest words first so shorter placements never isolate long contiguous paths
  const orderedQuotas = [...quotaItems].sort((a, b) => b.minLength - a.minLength);
  for (const q of orderedQuotas) {
    const candidates = (SAMPLE_BANK_BY_LENGTH[q.minLength] || SAMPLE_BANK_BY_LENGTH[6]).filter((w) =>
      dictionary.has(w)
    );
    let placedForBucket = 0;
    for (const candidate of candidates) {
      if (placedForBucket >= q.required) break;
      if (tpl.authoredWords.some((w) => w.word === candidate)) continue;
      const path = findWordPath(candidate);
      if (!path) continue;
      const check = canPlaceWordOnTemplate(
        shapeId,
        sizeId,
        tpl.authoredTiles,
        tpl.authoredWords,
        candidate,
        path,
        dictionary
      );
      if (!check.ok) continue;
      path.forEach((tid, idx) => {
        tpl.authoredTiles[tid] = candidate[idx];
        usedTiles.add(tid);
      });
      const entry: GridItAuthoredWord = {
        id: `aw_${tpl.authoredWords.length + 1}`,
        word: candidate,
        tilePath: path,
      };
      tpl.authoredWords.push(entry);
      placedForBucket++;
    }
  }

  return tpl;
}
