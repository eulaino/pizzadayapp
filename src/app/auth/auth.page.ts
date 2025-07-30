import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { SocketService } from '../services/socket.service';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common'; // Para *ngIf, *ngFor
import { FormsModule } from '@angular/forms'; // Para [(ngModel)]


@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
  ],
})
export class AuthPage {
  username: string = '';
  roomId: string = '';
  nome: string = '';

  constructor(
    private authService: AuthService,
    private socketService: SocketService,
    private router: Router
  ) { }

  login() {
    console.log('Iniciando login com:', this.username, this.roomId);
    this.authService.login(this.username.trim(), this.roomId.trim()).subscribe({
      next: (res) => {
        console.log('Login backend OK:', res);
        this.socketService.currentUsername = this.username;
        this.socketService.currentRoomId = this.roomId;
        this.socketService.joinRoom(this.roomId, this.username);
        console.log('Navegando para /home');
        this.router.navigate([`/session-room`], {
          queryParams: { roomId: this.roomId, username: this.username }
        });
      },
      error: (err) => {
        console.error('Erro no login:', err);
        alert(err.error?.message || 'Erro no login');
      }
    });
  }

}
