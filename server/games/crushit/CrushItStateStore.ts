import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CRUSHIT_TOTAL_STAGES } from '../../../shared/crushit/stagesCatalog.js';
import {
  CrushItProgressionState,
  CrushItStageResultPayload,
  StageProgressRecord,
} from '../../../shared/crushit/types.js';

export function createEmptyCrushItProgression(playerId: string): CrushItProgressionState {
  return {
    playerId,
    highestUnlockedStage: 1,
    totalScore: 0,
    totalWordsFormed: 0,
    totalPowerUpsUsed: 0,
    completedStagesCount: 0,
    stages: {},
    updatedAtMs: Date.now(),
  };
}

function clampStage(n: number): number {
  return Math.max(1, Math.min(CRUSHIT_TOTAL_STAGES, Math.floor(Number(n) || 1)));
}

export class CrushItStateStore {
  private supabase: SupabaseClient | null = null;
  private migrationPending = false;
  private loggedWarning = false;
  private memProgress = new Map<string, CrushItProgressionState>();
  private opLocks = new Map<string, Promise<void>>();

  constructor(options: { forceLocalMemory?: boolean } = {}) {
    if (!options.forceLocalMemory) {
      const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
        /\/+$/,
        ''
      );
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (url && serviceKey) {
        this.supabase = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      }
    }
  }

  private usePostgres(): boolean {
    return Boolean(this.supabase && !this.migrationPending);
  }

  private isMissingTableOrRpc(error: any): boolean {
    const code = String(error?.code || '');
    const msg = String(error?.message || '').toLowerCase();
    return (
      code === '42P01' ||
      code === '42883' ||
      code === 'PGRST205' ||
      code === 'PGRST202' ||
      msg.includes('does not exist') ||
      msg.includes('could not find the table') ||
      msg.includes('could not find the function')
    );
  }

  private handleDbError(error: any, context: string): void {
    if (this.isMissingTableOrRpc(error)) {
      this.migrationPending = true;
      if (!this.loggedWarning) {
        this.loggedWarning = true;
        console.warn(
          '[CrushItStateStore] Migration 006 not applied yet; continuing cleanly with in-memory store.'
        );
      }
      return;
    }
    console.warn(`[CrushItStateStore] Supabase warning (${context}):`, error?.message || error);
  }

  private async withPlayerLock<T>(playerId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.opLocks.get(playerId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.opLocks.set(playerId, next);
    await prev.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      if (this.opLocks.get(playerId) === next) {
        this.opLocks.delete(playerId);
      }
    }
  }

  private updateMemProgress(
    playerId: string,
    payload: CrushItStageResultPayload
  ): CrushItProgressionState {
    const current = this.memProgress.get(playerId) ?? createEmptyCrushItProgression(playerId);
    const stageNumber = clampStage(payload.stageNumber);
    const prev = current.stages[stageNumber];
    const score = Math.max(0, Math.floor(Number(payload.score) || 0));
    const completed = Boolean(payload.completed);
    const stars = completed ? Math.max(1, Math.min(3, Math.floor(Number(payload.stars) || 1))) : 0;
    const movesRemaining = Math.max(0, Math.floor(Number(payload.movesRemaining) || 0));
    const longestWord = Math.max(0, Math.floor(Number(payload.longestWordLength) || 0));
    const wordsFormed = Math.max(0, Math.floor(Number(payload.wordsFormed) || 0));
    const powerUpsUsed = Math.max(0, Math.floor(Number(payload.powerUpsUsed) || 0));
    const now = Date.now();

    const mergedStage: StageProgressRecord = {
      stageNumber,
      completed: Boolean(prev?.completed || completed),
      bestScore: Math.max(prev?.bestScore ?? 0, score),
      bestStars: Math.max(prev?.bestStars ?? 0, stars),
      bestMovesRemaining: completed
        ? Math.max(prev?.bestMovesRemaining ?? 0, movesRemaining)
        : prev?.bestMovesRemaining ?? 0,
      bestLongestWord: Math.max(prev?.bestLongestWord ?? 0, longestWord),
      attempts: (prev?.attempts ?? 0) + 1,
      completedAtMs: prev?.completedAtMs ?? (completed ? now : null),
    };

    const nextStages: Record<number, StageProgressRecord> = {
      ...current.stages,
      [stageNumber]: mergedStage,
    };

    let highestCompleted = 0;
    let completedCount = 0;
    let totalBestScore = 0;
    for (const rec of Object.values(nextStages)) {
      totalBestScore += rec.bestScore;
      if (rec.completed) {
        completedCount++;
        if (rec.stageNumber > highestCompleted) highestCompleted = rec.stageNumber;
      }
    }

    const updated: CrushItProgressionState = {
      playerId,
      highestUnlockedStage: Math.max(
        current.highestUnlockedStage,
        Math.min(CRUSHIT_TOTAL_STAGES, highestCompleted + 1)
      ),
      totalScore: Math.max(current.totalScore, totalBestScore),
      totalWordsFormed: current.totalWordsFormed + wordsFormed,
      totalPowerUpsUsed: current.totalPowerUpsUsed + powerUpsUsed,
      completedStagesCount: completedCount,
      stages: nextStages,
      updatedAtMs: now,
    };

    this.memProgress.set(playerId, updated);
    return updated;
  }

  async getProgress(playerId: string): Promise<CrushItProgressionState> {
    const pid = playerId.trim();
    if (!pid) return createEmptyCrushItProgression('');

    if (this.usePostgres()) {
      try {
        const [{ data: summary, error: sumErr }, { data: rows, error: rowErr }] = await Promise.all(
          [
            this.supabase!
              .from('crushit_player_summary')
              .select('*')
              .eq('player_id', pid)
              .maybeSingle(),
            this.supabase!
              .from('crushit_stage_progress')
              .select('*')
              .eq('player_id', pid)
              .order('stage_number', { ascending: true }),
          ]
        );

        if (sumErr) throw sumErr;
        if (rowErr) throw rowErr;

        const stages: Record<number, StageProgressRecord> = {};
        let highestCompleted = 0;
        let completedCount = 0;
        let totalBestScore = 0;

        for (const r of rows ?? []) {
          const sn = clampStage(r.stage_number);
          const rec: StageProgressRecord = {
            stageNumber: sn,
            completed: Boolean(r.completed),
            bestScore: Number(r.best_score) || 0,
            bestStars: Number(r.best_stars) || 0,
            bestMovesRemaining: Number(r.best_moves_remaining) || 0,
            bestLongestWord: Number(r.best_longest_word) || 0,
            attempts: Number(r.attempts) || 0,
            completedAtMs: r.completed_at ? new Date(r.completed_at).getTime() : null,
          };
          stages[sn] = rec;
          totalBestScore += rec.bestScore;
          if (rec.completed) {
            completedCount++;
            if (sn > highestCompleted) highestCompleted = sn;
          }
        }

        const prog: CrushItProgressionState = {
          playerId: pid,
          highestUnlockedStage: Math.max(
            Number(summary?.highest_unlocked_stage) || 1,
            Math.min(CRUSHIT_TOTAL_STAGES, highestCompleted + 1)
          ),
          totalScore: Math.max(Number(summary?.total_score) || 0, totalBestScore),
          totalWordsFormed: Number(summary?.total_words_formed) || 0,
          totalPowerUpsUsed: Number(summary?.total_powerups_used) || 0,
          completedStagesCount: completedCount,
          stages,
          updatedAtMs: summary?.updated_at ? new Date(summary.updated_at).getTime() : Date.now(),
        };

        this.memProgress.set(pid, prog);
        return prog;
      } catch (err) {
        this.handleDbError(err, 'getProgress');
      }
    }

    return this.memProgress.get(pid) ?? createEmptyCrushItProgression(pid);
  }

  async recordStageResult(
    playerId: string,
    payload: CrushItStageResultPayload
  ): Promise<CrushItProgressionState> {
    const pid = playerId.trim();
    if (!pid) return createEmptyCrushItProgression('');

    return this.withPlayerLock(pid, async () => {
      if (this.usePostgres()) {
        try {
          const { error } = await this.supabase!.rpc('record_crushit_stage_result', {
            p_player_id: pid,
            p_stage_number: clampStage(payload.stageNumber),
            p_completed: Boolean(payload.completed),
            p_score: Math.max(0, Math.floor(Number(payload.score) || 0)),
            p_stars: Math.max(0, Math.min(3, Math.floor(Number(payload.stars) || 0))),
            p_moves_remaining: Math.max(0, Math.floor(Number(payload.movesRemaining) || 0)),
            p_words_formed: Math.max(0, Math.floor(Number(payload.wordsFormed) || 0)),
            p_longest_word: Math.max(0, Math.floor(Number(payload.longestWordLength) || 0)),
            p_powerups_used: Math.max(0, Math.floor(Number(payload.powerUpsUsed) || 0)),
          });
          if (error) throw error;
          return await this.getProgress(pid);
        } catch (err) {
          this.handleDbError(err, 'recordStageResult');
        }
      }

      return this.updateMemProgress(pid, payload);
    });
  }
}
