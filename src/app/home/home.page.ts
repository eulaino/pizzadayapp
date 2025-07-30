import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { SocketService } from '../services/socket.service';
import { AlertController, NavController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { QRCodeComponent } from 'angularx-qrcode';
import { BarcodeFormat } from '@zxing/library';


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
    QRCodeComponent,
    ZXingScannerModule,
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
  nome: string = '';
  barcodeFormats = [BarcodeFormat.QR_CODE];
  showScanner = false;
  showRoomEnter = false;
  checkbox1 = false;
  checkbox2 = false;
  errorMessage: string = '';
  pulse = false;
  animatePop = false;

  triggerPulse() {
    this.pulse = false;
    setTimeout(() => {
      this.pulse = true;
    }, 10);
  }
  loading = false; // controla o loading
  private subscriptions: Subscription = new Subscription();

  constructor(
    private socketService: SocketService,
    private router: Router,
    private alertController: AlertController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef,
    private api: ApiService
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
          nome: this.nome,
          initialParticipants: messages,
        },
      });
    }));
  }


  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async joinSession() {
    const cpf = this.username.trim();
    
    
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

    this.api.salvarUsuario(this.username.trim(), this.sessionId.trim(), this.nome.trim()).subscribe({
      next: (res) => {
        console.log('Usuário salvo no Firebase:', res);
      },
      error: (err) => {
        console.warn('Erro ao salvar usuário (Firebase):', err);
      }
    });

    this.socketService.joinRoom(this.sessionId.trim(), this.username.trim());

  }

  generateId() {
    this.animatePop = false;
    // Força o Angular a resetar a classe
    setTimeout(() => {
      this.animatePop = true;

      // Remove novamente depois da animação (~300ms) para permitir reutilização
      setTimeout(() => {
        this.animatePop = false;
      }, 300); // corresponde à duração da animação CSS
    }, 10);
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    this.sessionId = result;
  }

  onCodeResult(result: string) {
    const matched = result.match(/\/join\/([a-zA-Z0-9\-]+)/);
    if (matched && matched[1]) {
      this.sessionId = matched[1];

      // Dê tempo para atualizar o campo, depois tente entrar
      setTimeout(() => {
        this.joinSession();
      }, 300);

    } else {
      this.presentAlert('Erro', 'QR Code inválido.');
    }
  }

  async presentAlert(header: string, message: string) {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = '';
    }, 4000);
  }
}
