import {
  GridItCustomTemplate,
  completeBoardFromTemplate,
} from '../../../shared/gridit/editor';
import {
  DiscoveredBoardWord,
  findBoardWords,
  generatePlayableBoard,
} from '../../../shared/gridit/engine';
import { BoardFairnessReport, analyzeBoardFairness } from '../../../shared/gridit/fairness';
import { GridItBoard, GridItBoardSize, GridItShapeId } from '../../../shared/gridit/types';
import { loadGridItDictionary } from './dictionary';

let workerInstance: Worker | null = null;
let workerFailed = false;
let nextReqId = 1;
const pendingById = new Map<
  number,
  { resolve: (val: any) => void; reject: (err: any) => void }
>();

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (workerInstance) return workerInstance;
  try {
    const w = new Worker(new URL('./griditWorker.ts', import.meta.url), {
      type: 'module',
    });
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: any; error?: string }>) => {
      const data = e.data;
      if (!data || typeof data.id !== 'number') return;
      const pending = pendingById.get(data.id);
      if (!pending) return;
      pendingById.delete(data.id);
      if (data.ok) {
        pending.resolve(data.result);
      } else {
        pending.reject(new Error(data.error || 'Worker task failed'));
      }
    };
    w.onerror = () => {
      workerFailed = true;
      for (const [, p] of pendingById) {
        p.reject(new Error('Worker crashed'));
      }
      pendingById.clear();
    };
    workerInstance = w;
    return w;
  } catch {
    workerFailed = true;
    return null;
  }
}

function callWorker<T>(payload: Record<string, any>): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.reject(new Error('Worker unavailable'));
  const id = nextReqId++;
  return new Promise<T>((resolve, reject) => {
    pendingById.set(id, { resolve, reject });
    w.postMessage({ ...payload, id });
  });
}

export async function generatePlayableBoardInWorker(params: {
  shapeId: GridItShapeId;
  sizeId: GridItBoardSize;
  language: string;
  seed?: number;
}): Promise<{ board: GridItBoard; isFallback: boolean }> {
  try {
    return await callWorker<{ board: GridItBoard; isFallback: boolean }>({
      type: 'generatePlayableBoard',
      ...params,
    });
  } catch {
    const dict = await loadGridItDictionary(params.language);
    const board = generatePlayableBoard(params.shapeId, params.sizeId, {
      language: params.language,
      seed: params.seed,
      dictionary: dict.words,
      prefixSet: dict.prefixes,
    });
    return { board, isFallback: dict.isFallback };
  }
}

export async function completeTemplateInWorker(params: {
  template: GridItCustomTemplate;
  seed?: number;
  stripAuthoredFlag?: boolean;
}): Promise<{ board: GridItBoard; fairness: BoardFairnessReport; isFallback: boolean }> {
  try {
    return await callWorker<{
      board: GridItBoard;
      fairness: BoardFairnessReport;
      isFallback: boolean;
    }>({
      type: 'completeTemplate',
      ...params,
    });
  } catch {
    const dict = await loadGridItDictionary(params.template.language || 'en');
    const res = completeBoardFromTemplate(params.template, {
      seed: params.seed,
      dictionary: dict.words,
      prefixSet: dict.prefixes,
      stripAuthoredFlag: params.stripAuthoredFlag,
    });
    return { board: res.board, fairness: res.fairness, isFallback: dict.isFallback };
  }
}

export async function analyzeTemplateFairnessInWorker(params: {
  template: GridItCustomTemplate;
  seed?: number;
}): Promise<{ fairness: BoardFairnessReport }> {
  try {
    return await callWorker<{ fairness: BoardFairnessReport }>({
      type: 'analyzeTemplateFairness',
      ...params,
    });
  } catch {
    const dict = await loadGridItDictionary(params.template.language || 'en');
    const completed = completeBoardFromTemplate(params.template, {
      seed: params.seed ?? 1337,
      dictionary: dict.words,
      prefixSet: dict.prefixes,
    });
    const fairness = analyzeBoardFairness(completed.board, dict.words, dict.prefixes);
    return { fairness };
  }
}

export async function findHintWordsInWorker(params: {
  board: GridItBoard;
  language: string;
  excludeWords: string[];
  maxWords?: number;
}): Promise<{ candidates: DiscoveredBoardWord[] }> {
  try {
    return await callWorker<{ candidates: DiscoveredBoardWord[] }>({
      type: 'findHintWords',
      ...params,
    });
  } catch {
    const dict = await loadGridItDictionary(params.language);
    const candidates = findBoardWords(params.board, dict.words, dict.prefixes, {
      maxWords: params.maxWords ?? 20,
      maxVisits: 4000,
      excludeWords: new Set(params.excludeWords),
    });
    return { candidates };
  }
}
