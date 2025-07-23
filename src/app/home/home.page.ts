import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../services/socket.service';
import { AlertController, NavController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';


// Importe os componentes Ionic e módulos Angular que você usa nesta página
import { CommonModule } from '@angular/common'; // Para *ngIf, *ngFor
import { FormsModule } from '@angular/forms'; // Para [(ngModel)]
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonFooter,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonLoading // <--- Importar IonLoading para o template
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonIcon,
    IonTitle,
    IonContent,
    IonFooter,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonInput,
    IonButton,
    IonLoading  // <-- Importa IonLoading
  ]
})
export class HomePage implements OnInit, OnDestroy {
  sessionId: string = '';
  username: string = '';
  errorMessage: string = '';
  loading = false; // controla o loading
  private subscriptions: Subscription = new Subscription();

  constructor(
    private socketService: SocketService,
    private router: Router,
    private alertController: AlertController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.sessionId = '';
    this.username = '';

    this.subscriptions.add(this.socketService.onJoinError().subscribe(async (message) => {
      this.loading = false;  // desliga o loading em caso de erro //
      const alert = await this.alertController.create({
        header: 'Erro ao Entrar',
        message: message,
        buttons: ['OK'],
      });
      await alert.present();
    }));

    this.subscriptions.add(this.socketService.onPreviousMessages().subscribe(async (messages) => {
      this.loading = false;  // desliga o loading ao receber resposta
      this.router.navigateByUrl('/session-room', {
        state: {
          roomId: this.sessionId,
          username: this.username,
          initialParticipants: messages,
        },
      });
    }));
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async joinSession() {
    if (!this.sessionId.trim()) {
      await this.presentAlert('Erro', 'A ID da sessão não pode estar vazia.');
      this.errorMessage = 'A ID da sessão não pode estar vazia.';
      return;
    }
    if (this.sessionId.trim().length < 8) {
      await this.presentAlert('Erro', 'A ID da sessão deve ter no mínimo 8 caracteres.');
      return;
    }
    if (!this.username.trim()) {
      await this.presentAlert('Erro', 'Seu nome não pode estar vazio.');
      return;
    }
    if (this.username.trim().length < 3) {
      await this.presentAlert('Erro', 'Seu nome deve conter mais que 3 caracteres.');
      return;
    }

    this.loading = true;  // liga o loading

    this.socketService.joinRoom(this.sessionId.trim(), this.username.trim());
  }

  generateId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    this.sessionId = result;
  }

  async presentAlert(header: string, message: string) {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = '';
    }, 4000);
  }
}
