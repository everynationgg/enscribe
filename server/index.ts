import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { createEnscribeApp } from './app.js';

const PORT = Number(process.env.PORT || 3001);
const onlineSocketsByPlayer = new Map<string, Set<string>>();

let ioRef: SocketIOServer | null = null;

const runtime = createEnscribeApp({
  isSocketOnline: (playerId) => {
    const set = onlineSocketsByPlayer.get(playerId);
    return Boolean(set && set.size > 0);
  },
  emitGlobal: (event, payload) => {
    ioRef?.emit(event, payload);
  },
  emitRoom: (roomId, event, payload) => {
    ioRef?.to(`room:${roomId}`).emit(event, payload);
  },
  emitPlayer: (playerId, event, payload) => {
    ioRef?.to(`player:${playerId}`).emit(event, payload);
  },
});

const httpServer = http.createServer(runtime.app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
ioRef = io;

// Authoritative 250ms timer loop for localhost
setInterval(() => {
  runtime.processTimersAndFlush().catch((err) => {
    console.error('[TimerLoop] Error processing timers:', err);
  });
}, 250);

io.on('connection', (socket) => {
  let boundPlayerId: string | null = null;

  socket.on('auth:identify', (playerId: string) => {
    if (!playerId || !runtime.repo.getProfile(playerId)) return;
    if (boundPlayerId && onlineSocketsByPlayer.has(boundPlayerId)) {
      onlineSocketsByPlayer.get(boundPlayerId)!.delete(socket.id);
      socket.leave(`player:${boundPlayerId}`);
    }
    boundPlayerId = playerId;
    if (!onlineSocketsByPlayer.has(playerId)) {
      onlineSocketsByPlayer.set(playerId, new Set());
    }
    onlineSocketsByPlayer.get(playerId)!.add(socket.id);
    socket.join(`player:${playerId}`);
  });

  socket.on('room:join_channel', (roomId: string) => {
    socket.join(`room:${roomId}`);
  });

  socket.on('room:leave_channel', (roomId: string) => {
    socket.leave(`room:${roomId}`);
  });

  socket.on('match:join_channel', ({ matchId, playerId }: { matchId: string; playerId: string }) => {
    const match = runtime.repo.getMatch(matchId);
    if (!match || !match.boards[playerId]) {
      socket.emit('match:error', { error: 'Access denied: not a participant in this match.' });
      return;
    }
    socket.join(`match:${matchId}`);
    const activated = runtime.engine.activateAwaitingTurnIfOnline(matchId, playerId) ?? match;
    socket.emit('match:state', runtime.engine.sanitizeForViewer(activated, playerId));
    runtime.broadcastMatchState(activated);
    runtime.flushSideEffects(true).catch(() => undefined);
  });

  socket.on('match:typing', ({ matchId, playerId, preview }: { matchId: string; playerId: string; preview: string }) => {
    const updated = runtime.engine.updateLiveInputPreview(matchId, playerId, preview ?? '');
    if (updated) {
      runtime.broadcastMatchState(updated);
      runtime.flushSideEffects(false).catch(() => undefined);
    }
  });

  socket.on('disconnect', () => {
    if (boundPlayerId && onlineSocketsByPlayer.has(boundPlayerId)) {
      const set = onlineSocketsByPlayer.get(boundPlayerId)!;
      set.delete(socket.id);
      if (set.size === 0) {
        onlineSocketsByPlayer.delete(boundPlayerId);
      }
    }
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(
    `Enscribe authoritative backend listening on http://localhost:${PORT} (cloudSync: ${
      runtime.cloudSync.isConfigured() ? 'Supabase ON' : 'Local Mode'
    })`
  );
});
