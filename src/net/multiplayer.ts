import type { GameState } from '../types';

export type MultiplayerMessage =
  | {
      type: 'join-room';
      roomCode: string;
      playerId: string;
      playerName: string;
    }
  | {
      type: 'state-sync';
      roomCode: string;
      senderId: string;
      state: GameState;
      sentAt: number;
    }
  | {
      type: 'player-left';
      roomCode: string;
      playerId: string;
    };

interface MultiplayerClientOptions {
  serverUrl: string;
  roomCode: string;
  playerId: string;
  playerName: string;
  onOpen: () => void;
  onClose: () => void;
  onError: (message: string) => void;
  onStateSync: (state: GameState) => void;
}

export class MultiplayerClient {
  private socket: WebSocket | null = null;
  private readonly options: MultiplayerClientOptions;

  constructor(options: MultiplayerClientOptions) {
    this.options = options;
  }

  connect() {
    this.disconnect();

    const socket = new WebSocket(this.options.serverUrl);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.options.onOpen();
      this.send({
        type: 'join-room',
        roomCode: this.options.roomCode,
        playerId: this.options.playerId,
        playerName: this.options.playerName,
      });
    });

    socket.addEventListener('close', () => {
      this.options.onClose();
    });

    socket.addEventListener('error', () => {
      this.options.onError('WebSocket connection failed.');
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as MultiplayerMessage;
        if (message.type !== 'state-sync') return;
        if (message.roomCode !== this.options.roomCode) return;
        if (message.senderId === this.options.playerId) return;
        this.options.onStateSync(message.state);
      } catch {
        this.options.onError('Received an invalid multiplayer message.');
      }
    });
  }

  syncState(state: GameState) {
    this.send({
      type: 'state-sync',
      roomCode: this.options.roomCode,
      senderId: this.options.playerId,
      state,
      sentAt: Date.now(),
    });
  }

  disconnect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({
        type: 'player-left',
        roomCode: this.options.roomCode,
        playerId: this.options.playerId,
      });
    }

    this.socket?.close();
    this.socket = null;
  }

  private send(message: MultiplayerMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }
}
