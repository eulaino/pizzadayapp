import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, timeout } from 'rxjs';

// Interface para um participante da sala.
export interface Participant {
  author: string;
  pizza: number;
  isHost: boolean;
  roomId: string;
  socketId?: string; // Opcional, usado apenas no backend, mas pode estar aqui para consistência..
}

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  // URL do seu servidor Node.js.
  // Se estiver rodando localmente, pode ser 'http://localhost:3000'.
  // Se estiver usando ngrok, use a URL HTTPS gerada por ele.
  private readonly SOCKET_URL = 'https://28adb769a6d3.ngrok-free.app'; // <-- ATUALIZE ESTA LINHA
  public currentRoomId: string | null = null;
  public currentUsername: string | null = null;

  constructor() {


    this.socket = io(this.SOCKET_URL, {
      transports: ['websocket']
    });
    console.log(this.SOCKET_URL);

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

    /*this.socket.on('connect', () => {
      console.log('Conectado ao servidor Socket.IO!');
      //CRIAR LOG
    });
    
    this.socket.on('connect_error', (err) => {
      console.log('Conectado ao servidor Socket.IO!', err.message);
      //CRIAR LOG
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Desconectado do servidor Socket.IO!', reason);
    });*/

  }


  // --- Métodos para Emitir Eventos (Enviar para o Servidor) ---
  emit(eventName: string, data?: any) {
    console.log(`[SocketService] -> Emitindo '${eventName}' com dados:`, data); // Log detalhado
    this.socket.emit(eventName, data);
  }

  joinRoom(roomId: string, username: string) {
    // Evita entrar novamente se já estiver na sala correta com o mesmo nome
    if (this.currentRoomId === roomId && this.currentUsername === username) {
      console.log(`[SocketService] Já conectado à sala ${roomId} como ${username}, ignorando novo joinRoom.`);
      return;
    }

    this.currentRoomId = roomId;
    this.currentUsername = username;

    console.log(`[SocketService] Enviando joinRoom: Sala=${roomId}, Usuário=${username}`);
    this.emit('joinRoom', { roomId, username });
  }
  sendMessage(author: string, pizza: number, roomId: string) {
    console.log(`[SocketService] Tentando sendMessage: Autor=${author}, Pizza=${pizza}, Sala=${roomId}`); // Mais detalhado
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
      this.socket.on(eventName, (data: any) => {
        subscriber.next(data);
      });
      // Retorna uma função de limpeza para desinscrever o listener
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
}