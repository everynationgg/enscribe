import {
  GridItCustomTemplate,
  completeBoardFromTemplate,
} from '../../../shared/gridit/editor';
import {
  findBoardWords,
  generatePlayableBoard,
} from '../../../shared/gridit/engine';
import { analyzeBoardFairness } from '../../../shared/gridit/fairness';
import { GridItBoard, GridItBoardSize, GridItShapeId } from '../../../shared/gridit/types';
import { loadGridItDictionary } from './dictionary';

export type GridItWorkerRequest =
  | {
      id: number;
      type: 'generatePlayableBoard';
      shapeId: GridItShapeId;
      sizeId: GridItBoardSize;
      language: string;
      seed?: number;
    }
  | {
      id: number;
      type: 'completeTemplate';
      template: GridItCustomTemplate;
      seed?: number;
      stripAuthoredFlag?: boolean;
    }
  | {
      id: number;
      type: 'analyzeTemplateFairness';
      template: GridItCustomTemplate;
      seed?: number;
    }
  | {
      id: number;
      type: 'findHintWords';
      board: GridItBoard;
      language: string;
      excludeWords: string[];
      maxWords?: number;
    };

const ctx: any = self;

ctx.onmessage = async (event: MessageEvent<GridItWorkerRequest>) => {
  const msg = event.data;
  if (!msg || typeof msg.id !== 'number') return;

  try {
    switch (msg.type) {
      case 'generatePlayableBoard': {
        const dict = await loadGridItDictionary(msg.language || 'en');
        const board = generatePlayableBoard(msg.shapeId, msg.sizeId, {
          language: msg.language || 'en',
          seed: msg.seed,
          dictionary: dict.words,
          prefixSet: dict.prefixes,
        });
        ctx.postMessage({
          id: msg.id,
          ok: true,
          result: { board, isFallback: dict.isFallback },
        });
        break;
      }

      case 'completeTemplate': {
        const lang = msg.template.language || 'en';
        const dict = await loadGridItDictionary(lang);
        const completed = completeBoardFromTemplate(msg.template, {
          seed: msg.seed,
          dictionary: dict.words,
          prefixSet: dict.prefixes,
          stripAuthoredFlag: msg.stripAuthoredFlag,
        });
        ctx.postMessage({
          id: msg.id,
          ok: true,
          result: {
            board: completed.board,
            fairness: completed.fairness,
            isFallback: dict.isFallback,
          },
        });
        break;
      }

      case 'analyzeTemplateFairness': {
        const lang = msg.template.language || 'en';
        const dict = await loadGridItDictionary(lang);
        const completed = completeBoardFromTemplate(msg.template, {
          seed: msg.seed ?? 1337,
          dictionary: dict.words,
          prefixSet: dict.prefixes,
        });
        const fairness = analyzeBoardFairness(completed.board, dict.words, dict.prefixes);
        ctx.postMessage({
          id: msg.id,
          ok: true,
          result: { fairness },
        });
        break;
      }

      case 'findHintWords': {
        const dict = await loadGridItDictionary(msg.language || 'en');
        const candidates = findBoardWords(msg.board, dict.words, dict.prefixes, {
          maxWords: msg.maxWords ?? 20,
          maxVisits: 4000,
          excludeWords: new Set(msg.excludeWords),
        });
        ctx.postMessage({
          id: msg.id,
          ok: true,
          result: { candidates },
        });
        break;
      }
    }
  } catch (err: any) {
    ctx.postMessage({
      id: msg.id,
      ok: false,
      error: err?.message || 'GridIt worker error',
    });
  }
};
