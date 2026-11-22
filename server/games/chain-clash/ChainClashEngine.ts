import crypto from 'node:crypto';
import {
  ClientBoardState,
  GuessResult,
  MatchChatMessage,
  MatchStateClient,
  RoomRules,
  SanitizedWordSlot,
} from '../../../shared/types.js';
import {
  StorageRepository,
  StoredMatch,
  StoredMatchBoard,
} from '../../repositories/types.js';
import {
  AssignedPuzzle,
  validateSingleChainWord,
} from './puzzleAssignment.js';

export class ChainClashEngine {
  constructor(
    private repo: StorageRepository,
    private isPlayerOnline: (playerId: string) => boolean
  ) {}

  setOnlineChecker(fn: (playerId: string) => boolean): void {
    this.isPlayerOnline = fn;
  }

  createMatch(params: {
    roomId: string | null;
    mode: 'classic' | 'speed_race' | 'solo' | 'ranked';
    title: string;
    theme?: string;
    rules: RoomRules;
    assignments: AssignedPuzzle[];
  }): StoredMatch {
    const now = Date.now();
    const matchId = `match_${crypto.randomUUID().slice(0, 12)}`;
    const turnOrder = params.assignments.map((a) => a.recipientPlayerId);
    const isSpeedOrSolo = params.mode === 'speed_race' || params.mode === 'solo';
    const boards: Record<string, StoredMatchBoard> = {};
    const speedRaceDeadlines: Record<string, number | null> = {};

    const deadlineMs =
      params.rules.timerEnabled && params.rules.timePerWordSeconds > 0
        ? now + params.rules.timePerWordSeconds * 1000
        : null;

    for (const assignment of params.assignments) {
      const revealedCounts = assignment.words.map((w, idx) => (idx === 0 ? w.length : 1));
      boards[assignment.recipientPlayerId] = {
        matchId,
        playerId: assignment.recipientPlayerId,
        authorPlayerId: assignment.authorPlayerId,
        words: assignment.words,
        currentWordIndex: 1,
        revealedCounts,
        wrongAttemptsCurrentWord: 0,
        passesCurrentWord: 0,
        completedAtMs: null,
        liveInputPreview: '',
        earnedMatchPoints: 0,
      };
      if (params.mode === 'speed_race') {
        speedRaceDeadlines[assignment.recipientPlayerId] = deadlineMs;
      }
    }

    const match: StoredMatch = {
      id: matchId,
      roomId: params.roomId,
      gameType: 'chain_clash',
      mode: params.mode,
      title: params.title,
      theme: params.theme,
      status: isSpeedOrSolo ? 'active_turns' : 'opening',
      activeTurnPlayerId: null,
      turnOrder,
      turnDeadlineMs: isSpeedOrSolo ? null : deadlineMs,
      turnStartedAtMs: isSpeedOrSolo ? null : now,
      turnAwaitingOnline: false,
      speedRaceDeadlines,
      winnerId: null,
      finishOrder: [],
      rules: params.rules,
      isDemoSeed: false,
      createdAt: now,
      updatedAt: now,
      boards,
      messages: [],
    };

    return this.repo.runInTransaction(() => {
      this.repo.saveMatch(match);
      if (params.roomId) {
        this.repo.updateRoomStatus(params.roomId, 'in_progress', matchId);
      }
      return this.repo.getMatch(matchId)!;
    });
  }

  /**
   * Sanitizes the authoritative match state for a specific viewer so unsolved secret words
   * are NEVER sent to any client, and opponent visibility rules are strictly enforced.
   */
  sanitizeForViewer(match: StoredMatch, viewerId: string): MatchStateClient {
    const viewerBoard = match.boards[viewerId];
    const sanitizedBoards: Record<string, ClientBoardState> = {};

    for (const [pid, board] of Object.entries(match.boards)) {
      const profile = this.repo.getProfile(pid);
      const isSelf = pid === viewerId;
      const isFinishedPlayer = board.completedAtMs !== null;

      let statusText = 'Waiting';
      if (match.winnerId === pid) {
        statusText = 'Winner!';
      } else if (isFinishedPlayer) {
        statusText = 'Completed';
      } else if (match.mode === 'speed_race' || match.mode === 'solo') {
        statusText = 'Racing';
      } else if (match.status === 'opening') {
        statusText = 'Opening Race';
      } else if (match.activeTurnPlayerId === pid) {
        statusText = match.turnAwaitingOnline ? 'Turn Ready' : 'Playing';
      }

      const words: SanitizedWordSlot[] = board.words.map((word, idx) => {
        const isCompleted = idx < board.currentWordIndex || isFinishedPlayer;
        const isActive = !isFinishedPlayer && idx === board.currentWordIndex;
        const revealed = Math.min(word.length, Math.max(1, board.revealedCounts[idx] ?? 1));

        // Masking for Speed Race: don't spoil words ahead of the viewer on the same puzzle
        const hideSpeedRaceSpoiler =
          !isSelf &&
          match.mode === 'speed_race' &&
          viewerBoard &&
          idx >= viewerBoard.currentWordIndex &&
          viewerBoard.completedAtMs === null;

        let displayText = '';
        let isUpcomingMasked = false;

        if (isCompleted) {
          if (!isSelf && match.rules.opponentVisibility === 'minimal') {
            displayText = 'SOLVED';
          } else if (hideSpeedRaceSpoiler) {
            displayText = `${'•'.repeat(word.length)}`;
          } else {
            displayText = word;
          }
        } else if (isActive) {
          if (!isSelf && match.rules.opponentVisibility === 'minimal') {
            displayText = match.rules.wordLengthVisible ? '_ '.repeat(word.length).trim() : '••••';
            isUpcomingMasked = true;
          } else {
            const chars = [];
            for (let c = 0; c < word.length; c++) {
              chars.push(c < revealed ? word[c] : '_');
            }
            displayText = match.rules.wordLengthVisible ? chars.join(' ') : `${word[0]} •••`;
          }
        } else {
          // Upcoming word
          if (match.rules.chainVisibility === 'full_chain' && (isSelf || match.rules.opponentVisibility !== 'minimal')) {
            const chars = [];
            for (let c = 0; c < word.length; c++) {
              chars.push(c < revealed ? word[c] : '_');
            }
            displayText = match.rules.wordLengthVisible ? chars.join(' ') : `${word[0]} •••`;
          } else {
            isUpcomingMasked = true;
            displayText = match.rules.wordLengthVisible
              ? Array.from({ length: word.length }, () => '_').join(' ')
              : '•••••';
          }
        }

        return {
          index: idx,
          length: match.rules.wordLengthVisible || isCompleted ? word.length : 0,
          isCompleted,
          isActive,
          isUpcomingMasked,
          displayText,
          revealedLetters: isCompleted ? word.length : revealed,
        };
      });

      const showLivePreview =
        isSelf || match.rules.opponentVisibility === 'full_live';

      sanitizedBoards[pid] = {
        playerId: pid,
        username: profile?.username ?? pid,
        avatarId: profile?.avatarId ?? 'alex',
        isWinner: match.winnerId === pid,
        isOnline: this.isPlayerOnline(pid),
        statusText,
        currentWordIndex: board.currentWordIndex,
        totalWords: board.words.length,
        words,
        liveInputPreview: showLivePreview ? board.liveInputPreview : '',
        completedAtMs: board.completedAtMs,
        wrongAttemptsCurrentWord: board.wrongAttemptsCurrentWord,
        passesCurrentWord: board.passesCurrentWord,
        earnedMatchPoints: board.earnedMatchPoints,
      };
    }

    return {
      id: match.id,
      roomId: match.roomId,
      gameType: match.gameType,
      mode: match.mode,
      title: match.title,
      theme: match.theme,
      status: match.status,
      activeTurnPlayerId: match.activeTurnPlayerId,
      turnOrder: match.turnOrder,
      turnDeadlineMs: match.turnDeadlineMs,
      turnStartedAtMs: match.turnStartedAtMs,
      turnAwaitingOnline: match.turnAwaitingOnline,
      speedRaceDeadlines: match.speedRaceDeadlines,
      winnerId: match.winnerId,
      finishOrder: match.finishOrder,
      rules: match.rules,
      boards: sanitizedBoards,
      messages: match.messages,
      serverNowMs: Date.now(),
      isDemoSeed: match.isDemoSeed,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }

  /**
   * When a player opens or reconnects to a persistent match where it is their turn
   * and the countdown has not started yet (turnAwaitingOnline === true), start their countdown!
   */
  activateAwaitingTurnIfOnline(matchId: string, playerId: string): StoredMatch | null {
    return this.repo.runInTransaction(() => {
      const match = this.repo.getMatch(matchId);
      if (!match) return null;
      if (
        match.status === 'active_turns' &&
        match.activeTurnPlayerId === playerId &&
        match.turnAwaitingOnline
      ) {
        const now = Date.now();
        match.turnAwaitingOnline = false;
        match.turnStartedAtMs = now;
        match.turnDeadlineMs =
          match.rules.timerEnabled && match.rules.timePerWordSeconds > 0
            ? now + match.rules.timePerWordSeconds * 1000
            : null;
        match.updatedAt = now;
        this.repo.saveMatch(match);
      }
      return this.repo.getMatch(matchId);
    });
  }

  updateLiveInputPreview(matchId: string, playerId: string, preview: string): StoredMatch | null {
    return this.repo.runInTransaction(() => {
      const match = this.repo.getMatch(matchId);
      if (!match) return null;
      const board = match.boards[playerId];
      if (!board || board.completedAtMs !== null) return match;
      board.liveInputPreview = preview.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 20);
      this.repo.updateMatchBoard(board);
      return this.repo.getMatch(matchId);
    });
  }

  submitGuess(matchId: string, playerId: string, rawGuess: string): GuessResult {
    const check = validateSingleChainWord(rawGuess);
    if (!check.valid) {
      const current = this.repo.getMatch(matchId);
      if (!current) throw new Error('Match not found.');
      return {
        correct: false,
        wordCompleted: false,
        matchWon: false,
        revealedLetterAdded: false,
        message: check.error ?? 'Invalid word format.',
        match: this.sanitizeForViewer(current, playerId),
      };
    }
    const guess = check.normalized;

    return this.repo.runInTransaction(() => {
      const match = this.repo.getMatch(matchId);
      if (!match) throw new Error('Match not found.');

      const board = match.boards[playerId];
      if (!board) throw new Error('You are not a participant in this match.');
      if (board.completedAtMs !== null) {
        throw new Error('You have already completed your chain.');
      }

      const now = Date.now();

      // Check turn permission for Classic Mode before winner is declared
      if (match.mode === 'classic' || match.mode === 'ranked') {
        if (match.status === 'active_turns' && match.activeTurnPlayerId !== playerId) {
          throw new Error('It is not your turn right now.');
        }
        // If timer already expired right before request arrived in active_turns, handle timeout atomically
        if (
          match.status === 'active_turns' &&
          !match.turnAwaitingOnline &&
          match.turnDeadlineMs !== null &&
          now > match.turnDeadlineMs
        ) {
          this.transferTurnInternal(match, now);
          this.repo.saveMatch(match);
          throw new Error('Your turn timer expired.');
        }
      }

      const targetIndex = board.currentWordIndex;
      const targetWord = board.words[targetIndex];
      if (!targetWord) {
        throw new Error('No remaining unresolved words.');
      }

      if (guess === targetWord) {
        // Correct answer!
        board.revealedCounts[targetIndex] = targetWord.length;
        board.currentWordIndex += 1;
        board.wrongAttemptsCurrentWord = 0;
        board.passesCurrentWord = 0;
        board.liveInputPreview = '';
        board.earnedMatchPoints += 10;
        match.updatedAt = now;

        this.repo.recordPointsEvent({
          id: `pts_${crypto.randomUUID().slice(0, 12)}`,
          playerId,
          matchId: match.id,
          gameType: match.gameType,
          amount: 10,
          reason: `Solved word ${targetWord}`,
          createdAt: now,
        });
        this.repo.updateProfileStats(playerId, { matchPointsDelta: 10 });

        let matchWon = false;
        const finishedAll = board.currentWordIndex >= board.words.length;

        if (finishedAll) {
          board.completedAtMs = now;
          const profile = this.repo.getProfile(playerId);
          match.finishOrder.push({
            playerId,
            username: profile?.username ?? playerId,
            avatarId: profile?.avatarId ?? 'alex',
            completedAtMs: now,
            rank: match.finishOrder.length + 1,
          });

          if (!match.winnerId) {
            match.winnerId = playerId;
            match.status = 'finished';
            match.activeTurnPlayerId = null;
            match.turnDeadlineMs = null;
            match.turnAwaitingOnline = false;
            matchWon = true;

            if (match.mode === 'solo' && match.theme) {
              // Solo stage completion tracked via stage endpoint too
            } else if (match.turnOrder.length > 1) {
              const rpGain = match.mode === 'ranked' ? 28 : 12;
              const rpLoss = match.mode === 'ranked' ? -18 : 0;
              this.repo.updateProfileStats(playerId, { wins: 1, rankPointsDelta: rpGain });
              for (const otherId of match.turnOrder) {
                if (otherId !== playerId) {
                  this.repo.updateProfileStats(otherId, { losses: 1, rankPointsDelta: rpLoss });
                  const winnerName = profile?.username ?? 'Opponent';
                  this.repo.addNotification({
                    id: `notif_${crypto.randomUUID().slice(0, 12)}`,
                    playerId: otherId,
                    type: 'match_finished',
                    title: `${winnerName} completed the chain!`,
                    body: 'You can still finish solving your remaining words.',
                    matchId: match.id,
                    read: false,
                    createdAt: now,
                  });
                }
              }
            }
            if (match.roomId) {
              this.repo.updateRoomStatus(match.roomId, 'completed', match.id);
            }
          }
        } else {
          // More words remain
          if (match.mode === 'classic' || match.mode === 'ranked') {
            if (match.status === 'opening') {
              // First solver claims the active turn!
              match.status = 'active_turns';
              match.activeTurnPlayerId = playerId;
            }
            if (match.status === 'active_turns') {
              match.turnAwaitingOnline = false;
              match.turnStartedAtMs = now;
              match.turnDeadlineMs =
                match.rules.timerEnabled && match.rules.timePerWordSeconds > 0
                  ? now + match.rules.timePerWordSeconds * 1000
                  : null;
            }
          } else if (match.mode === 'speed_race') {
            match.speedRaceDeadlines[playerId] =
              match.rules.timerEnabled && match.rules.timePerWordSeconds > 0
                ? now + match.rules.timePerWordSeconds * 1000
                : null;
          }
        }

        this.repo.updateMatchBoard(board);
        this.repo.saveMatch(match);

        const refreshed = this.repo.getMatch(match.id)!;
        return {
          correct: true,
          wordCompleted: true,
          matchWon,
          revealedLetterAdded: false,
          message: matchWon
            ? 'Chain complete! You win!'
            : finishedAll
              ? 'Chain completed!'
              : `Correct! ${targetWord} solved.`,
          match: this.sanitizeForViewer(refreshed, playerId),
        };
      }

      // Wrong guess: do NOT deduct points, do NOT add cooldown, do NOT end turn
      board.wrongAttemptsCurrentWord += 1;
      let revealedLetterAdded = false;
      const threshold = match.rules.autoRevealAfterAttempts;
      if (
        threshold > 0 &&
        board.wrongAttemptsCurrentWord % threshold === 0 &&
        board.revealedCounts[targetIndex] < targetWord.length - 1
      ) {
        board.revealedCounts[targetIndex] += 1;
        revealedLetterAdded = true;
      }
      match.updatedAt = now;
      this.repo.updateMatchBoard(board);
      this.repo.saveMatch(match);

      const refreshed = this.repo.getMatch(match.id)!;
      return {
        correct: false,
        wordCompleted: false,
        matchWon: false,
        revealedLetterAdded,
        message: revealedLetterAdded
          ? 'Not quite — a bonus letter was revealed!'
          : 'Not a match — try again!',
        match: this.sanitizeForViewer(refreshed, playerId),
      };
    });
  }

  passTurn(matchId: string, playerId: string): StoredMatch {
    return this.repo.runInTransaction(() => {
      const match = this.repo.getMatch(matchId);
      if (!match) throw new Error('Match not found.');
      if (match.mode !== 'classic' && match.mode !== 'ranked') {
        throw new Error('Pass Turn is only available in turn-based Classic matches.');
      }
      if (match.status === 'finished') {
        throw new Error('Match already has a winner; finish your chain freely.');
      }
      if (match.status === 'opening') {
        throw new Error('Wait for the opening word race or solve the opening word first.');
      }
      if (match.activeTurnPlayerId !== playerId) {
        throw new Error('It is not your turn.');
      }

      const now = Date.now();
      const board = match.boards[playerId];
      if (board && board.completedAtMs === null) {
        board.passesCurrentWord += 1;
        board.liveInputPreview = '';
        const targetIndex = board.currentWordIndex;
        const targetWord = board.words[targetIndex];
        if (
          targetWord &&
          match.rules.autoRevealAfterPasses > 0 &&
          board.passesCurrentWord % match.rules.autoRevealAfterPasses === 0 &&
          board.revealedCounts[targetIndex] < targetWord.length - 1
        ) {
          board.revealedCounts[targetIndex] += 1;
        }
        this.repo.updateMatchBoard(board);
      }

      this.transferTurnInternal(match, now);
      this.repo.saveMatch(match);
      return this.repo.getMatch(matchId)!;
    });
  }

  private transferTurnInternal(match: StoredMatch, now: number): void {
    const unfinished = match.turnOrder.filter((pid) => match.boards[pid]?.completedAtMs === null);
    if (unfinished.length === 0) {
      match.status = 'finished';
      match.activeTurnPlayerId = null;
      match.turnDeadlineMs = null;
      match.turnAwaitingOnline = false;
      match.updatedAt = now;
      return;
    }

    const currentIdx = match.activeTurnPlayerId ? unfinished.indexOf(match.activeTurnPlayerId) : -1;
    const nextIdx = (currentIdx + 1) % unfinished.length;
    const nextPlayerId = unfinished[nextIdx];

    match.activeTurnPlayerId = nextPlayerId;
    match.updatedAt = now;

    // Persistent offline turn protection: do not tick timer until player is online
    if (this.isPlayerOnline(nextPlayerId)) {
      match.turnAwaitingOnline = false;
      match.turnStartedAtMs = now;
      match.turnDeadlineMs =
        match.rules.timerEnabled && match.rules.timePerWordSeconds > 0
          ? now + match.rules.timePerWordSeconds * 1000
          : null;
    } else {
      match.turnAwaitingOnline = true;
      match.turnStartedAtMs = null;
      match.turnDeadlineMs = null;
    }

    // Create in-app turn notification for next player
    const prevProfile = this.repo.getProfile(unfinished[Math.max(0, currentIdx)] ?? '');
    this.repo.addNotification({
      id: `notif_${crypto.randomUUID().slice(0, 12)}`,
      playerId: nextPlayerId,
      type: 'your_turn',
      title: "It's Your Turn!",
      body: `${match.title}${prevProfile ? ` • After ${prevProfile.username}` : ''}`,
      matchId: match.id,
      read: false,
      createdAt: now,
    });
  }

  /**
   * Periodic authoritative timer check (run every ~250ms by server).
   * Returns list of matches whose state changed so sockets can broadcast updates.
   */
  processExpiredTimers(): StoredMatch[] {
    const now = Date.now();
    const candidates = this.repo.listActiveTimedMatches();
    const updatedMatches: StoredMatch[] = [];

    for (const candidate of candidates) {
      if (candidate.status === 'finished') continue;

      if (candidate.mode === 'classic' || candidate.mode === 'ranked') {
        // Opening race timeout resets opening timer or assigns turn cleanly if needed;
        // Per-word turn timer expiry in active_turns transfers turn without skipping word!
        if (
          candidate.status === 'active_turns' &&
          !candidate.turnAwaitingOnline &&
          candidate.turnDeadlineMs !== null &&
          now >= candidate.turnDeadlineMs
        ) {
          const updated = this.repo.runInTransaction(() => {
            const fresh = this.repo.getMatch(candidate.id);
            if (
              !fresh ||
              fresh.status !== 'active_turns' ||
              fresh.turnAwaitingOnline ||
              fresh.turnDeadlineMs === null ||
              now < fresh.turnDeadlineMs
            ) {
              return null;
            }
            const activeBoard = fresh.activeTurnPlayerId ? fresh.boards[fresh.activeTurnPlayerId] : null;
            if (activeBoard) {
              activeBoard.liveInputPreview = '';
              this.repo.updateMatchBoard(activeBoard);
            }
            this.transferTurnInternal(fresh, now);
            this.repo.saveMatch(fresh);
            return this.repo.getMatch(candidate.id);
          });
          if (updated) updatedMatches.push(updated);
        } else if (
          candidate.status === 'opening' &&
          candidate.turnDeadlineMs !== null &&
          now >= candidate.turnDeadlineMs
        ) {
          // If nobody solved the opening word within the initial countdown, start a deterministic turn rotation from player 0!
          const updated = this.repo.runInTransaction(() => {
            const fresh = this.repo.getMatch(candidate.id);
            if (!fresh || fresh.status !== 'opening' || fresh.turnDeadlineMs === null || now < fresh.turnDeadlineMs) {
              return null;
            }
            fresh.status = 'active_turns';
            fresh.activeTurnPlayerId = fresh.turnOrder[0] ?? null;
            fresh.turnStartedAtMs = now;
            fresh.turnDeadlineMs =
              fresh.rules.timerEnabled && fresh.rules.timePerWordSeconds > 0
                ? now + fresh.rules.timePerWordSeconds * 1000
                : null;
            fresh.turnAwaitingOnline = fresh.activeTurnPlayerId ? !this.isPlayerOnline(fresh.activeTurnPlayerId) : false;
            if (fresh.turnAwaitingOnline) {
              fresh.turnDeadlineMs = null;
            }
            fresh.updatedAt = now;
            this.repo.saveMatch(fresh);
            return this.repo.getMatch(candidate.id);
          });
          if (updated) updatedMatches.push(updated);
        }
      } else if (candidate.mode === 'speed_race') {
        let changed = false;
        const updated = this.repo.runInTransaction(() => {
          const fresh = this.repo.getMatch(candidate.id);
          if (!fresh || fresh.status === 'finished') return null;
          for (const [pid, dl] of Object.entries(fresh.speedRaceDeadlines)) {
            const b = fresh.boards[pid];
            if (!b || b.completedAtMs !== null) continue;
            if (dl !== null && now >= dl) {
              // Reset word countdown and optionally reveal 1 letter without skipping
              const targetWord = b.words[b.currentWordIndex];
              if (targetWord && b.revealedCounts[b.currentWordIndex] < targetWord.length - 1) {
                b.revealedCounts[b.currentWordIndex] += 1;
                this.repo.updateMatchBoard(b);
              }
              fresh.speedRaceDeadlines[pid] =
                fresh.rules.timerEnabled && fresh.rules.timePerWordSeconds > 0
                  ? now + fresh.rules.timePerWordSeconds * 1000
                  : null;
              changed = true;
            }
          }
          if (changed) {
            fresh.updatedAt = now;
            this.repo.saveMatch(fresh);
            return this.repo.getMatch(candidate.id);
          }
          return null;
        });
        if (updated) updatedMatches.push(updated);
      }
    }

    return updatedMatches;
  }

  addChatMessage(matchId: string, playerId: string, text: string): MatchChatMessage {
    const trimmed = text.trim().slice(0, 240);
    if (!trimmed) throw new Error('Message cannot be empty.');
    const profile = this.repo.getProfile(playerId);
    const msg: MatchChatMessage = {
      id: `mmsg_${crypto.randomUUID().slice(0, 12)}`,
      matchId,
      senderId: playerId,
      senderName: profile?.username ?? playerId,
      senderAvatar: profile?.avatarId ?? 'alex',
      text: trimmed,
      createdAt: Date.now(),
    };
    this.repo.addMatchMessage(msg);
    return msg;
  }
}
