import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

// Interface para um participante da sala.
export interface Participant {
  author: string;
  pizza: number;
  isHost: boolean;
  roomId: string;
  socketId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private readonly SOCKET_URL = 'https://87138696a2ea.ngrok-free.app';
  public currentRoomId: string | null = null;
  public currentUsername: string | null = null;
  
  public getSocket(): Socket {
    return this.socket;
  }

  constructor() {
    this.socket = io(this.SOCKET_URL, {
      transports: ['websocket']
    });
    
    console.log('Tentando conectar ao socket em:', this.SOCKET_URL);

    this.socket.on('connect', () => {
      console.log('Conectado ao servidor Socket.IO com ID:', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('Erro ao conectar:', err.message);
      console.error('Detalhes:', err);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Desconectado:', reason);
    });
  }

  // --- Métodos para Emitir Eventos (Enviar para o Servidor) ---
  emit(eventName: string, data?: any) {
    console.log(`[SocketService] -> Emitindo '${eventName}' com dados:`, data);
    this.socket.emit(eventName, data);
  }

  // Método para verificar status de host
  requestHostStatus(roomId: string, username?: string) {
    const usernameToCheck = username || this.currentUsername;
    if (usernameToCheck) {
      console.log(`[SocketService] Solicitando verificação de host: Sala=${roomId}, Nome=${usernameToCheck}`);
      this.emit('checkIfHost', { roomId, username: usernameToCheck });
    } else {
      console.warn('[SocketService] Username não disponível para verificação de host');
    }
  }

  // Método para solicitar status da sala
  requestRoomStatus(roomId: string) {
    console.log(`[SocketService] Solicitando status da sala: ${roomId}`);
    this.emit('requestRoomStatus', { roomId });
  }

  // Método para verificar se o usuário atual é host
  checkCurrentUserHost(roomId: string) {
    if (this.currentUsername) {
      console.log(`[SocketService] Verificando se ${this.currentUsername} é host da sala ${roomId}`);
      this.emit('checkCurrentUserHost', { roomId, username: this.currentUsername });
    }
  }

  joinRoom(roomId: string, cpf: string) {
    if (this.currentRoomId === roomId && this.currentUsername === cpf) {
      console.log(`[SocketService] Já conectado à sala ${roomId} como ${cpf}, verificando status...`);
      this.checkCurrentUserHost(roomId);
      return;
    }

    this.currentRoomId = roomId;
    this.currentUsername = cpf;

    console.log(`[SocketService] Enviando joinRoom: Sala=${roomId}, CPF=${cpf}`);
    this.emit('joinRoom', { roomId, username: cpf });
  }
  
  sendMessage(author: string, pizza: number, roomId: string) {
    console.log(`[SocketService] Tentando sendMessage: Autor=${author}, Pizza=${pizza}, Sala=${roomId}`);
    this.emit('sendMessage', { author, pizza, roomId });
  }

  removeSliceRequest(roomId: string, authorToChange: string) {
    console.log(`[SocketService] Tentando removeSliceRequest: Sala=${roomId}, Alterar=${authorToChange}`);
    this.emit('removeSliceRequest', { roomId, authorToChange });
  }

  leaveRoom(roomId: string) {
    console.log(`[SocketService] Tentando leaveRoom: Sala=${roomId}`);
    this.emit('leaveRoom', roomId);
  }

  resetSessionState(roomId: string) {
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
      this.currentUsername = null;
    }
  }

  // --- Métodos para Ouvir Eventos (Receber do Servidor) ---
  listen(eventName: string): Observable<any> {
    return new Observable((subscriber) => {
      this.socket.on(eventName, (data?: any) => {
        console.log(`[SocketService] <- Recebido '${eventName}':`, data);
        subscriber.next(data);
      });
      return () => {
        this.socket.off(eventName);
      };
    });
  }

  onPreviousMessages(): Observable<Participant[]> {
    return this.listen('previousMessages');
  }

  onReceivedMessage(): Observable<Participant> {
    return this.listen('receivedMessage');
  }

  onJoinError(): Observable<string> {
    return this.listen('joinError');
  }

  onYouAreHost(): Observable<{ isHost: boolean }> {
    return this.listen('youAreHost');
  }

  onHostTransferred(): Observable<{ newHost: string }> {
    return this.listen('hostTransferred');
  }

  onUserLeft(): Observable<{ author: string; roomId: string }> {
    return this.listen('userLeft');
  }

  onError(): Observable<string> {
    return this.listen('error');
  }

  // Novos listeners para resolver o problema do host
  onRoomJoined(): Observable<{ roomId: string; participants: Participant[]; isHost?: boolean }> {
    return this.listen('roomJoined');
  }

  onRoomStatusResponse(): Observable<{ roomId: string; participants: Participant[]; userIsHost: boolean }> {
    return this.listen('roomStatusResponse');
  }

  onUserHostStatus(): Observable<{ roomId: string; username: string; isHost: boolean }> {
    return this.listen('userHostStatus');
  }

  // Métodos utilitários
  isConnected(): boolean {
    return this.socket.connected;
  }

  reconnect() {
    if (!this.socket.connected) {
      console.log('[SocketService] Tentando reconectar...');
      this.socket.connect();
    }
  }

  getConnectionInfo() {
    return {
      connected: this.socket.connected,
      currentRoomId: this.currentRoomId,
      currentUsername: this.currentUsername,
      socketId: this.socket.id
    };
  }
}