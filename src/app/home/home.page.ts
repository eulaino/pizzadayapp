import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { SocketService } from '../services/socket.service';
import { AlertController, NavController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { QRCodeComponent } from 'angularx-qrcode';
import { BarcodeFormat } from '@zxing/library';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, Validators, FormBuilder, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

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
  IonButton
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
    IonButton
  ]
})
export class HomePage implements OnInit, OnDestroy {
  barcodeFormats = [BarcodeFormat.QR_CODE];
  showScanner = false;
  anfitriaoBox = false;
  usuarioBox = false;
  errorMessage: string = '';
  pulse = false;
  animatePop = false;

  private subscriptions: Subscription = new Subscription();
  private currentLoading: HTMLIonLoadingElement | null = null;

  loginForm!: FormGroup;
  nomeCarregado: boolean = false;

  constructor(
    private socketService: SocketService,
    private router: Router,
    private alertController: AlertController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef,
    private api: ApiService,
    private fb: FormBuilder,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.loginForm = this.fb.group({
      cpf: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      nome: ['', Validators.required],
      sessionId: ['', [Validators.required, Validators.minLength(8)]]
    });

    // Observa as mudanças no campo CPF para buscar o nome
    this.loginForm.get('cpf')?.valueChanges
      .pipe(
        debounceTime(700),
        distinctUntilChanged()
      )
      .subscribe(cpf => {
        if (cpf && cpf.length === 11) {
          this.buscarNomePorCpf(cpf);
        } else {
          this.loginForm.get('nome')?.setValue('');
          this.loginForm.get('nome')?.enable();
          this.nomeCarregado = false;
          this.errorMessage = '';
        }
      });

    this.subscriptions.add(this.socketService.onJoinError().subscribe(async (message) => {
      await this.dismissLoading();
      const alert = await this.alertController.create({
        header: 'Erro ao Entrar',
        message: message,
        buttons: ['OK'],
      });
      await alert.present();
    }));

    this.subscriptions.add(this.socketService.onPreviousMessages().subscribe(async (messages) => {
      await this.dismissLoading();
      const { sessionId, cpf, nome } = this.loginForm.getRawValue();

      this.router.navigateByUrl('/session-room', {
        state: {
          roomId: sessionId,
          username: cpf,
          nome: nome,
          initialParticipants: messages,
        },
      });
    }));
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async buscarNomePorCpf(cpf: string) {
    this.nomeCarregado = false;
    this.errorMessage = '';

    try {
      const response = await this.api.buscarUsuarioPorCpf(cpf).toPromise();

      if (response && response.nome) {
        this.loginForm.get('nome')?.setValue(response.nome);
        this.loginForm.get('nome')?.disable();
        this.nomeCarregado = true;
        console.log('Nome carregado do Firebase:', response.nome);
      } else {
        this.loginForm.get('nome')?.setValue('');
        this.loginForm.get('nome')?.enable();
        this.nomeCarregado = false;
        this.errorMessage = 'CPF não encontrado ou sem nome associado. Por favor, preencha seu nome.';
        console.log('CPF não encontrado no Firebase ou sem nome associado.');
      }
    } catch (error: any) {
      console.error('Erro ao buscar CPF no Firebase:', error);
      this.loginForm.get('nome')?.setValue('');
      this.loginForm.get('nome')?.enable();
      this.nomeCarregado = false;
      if (error.status === 404) {
        this.errorMessage = 'CPF não encontrado. Preencha seu nome para criar um novo registro.';
      } else {
        this.errorMessage = 'Erro ao buscar dados. Tente novamente mais tarde.';
      }
    }
  }

  async joinSession() {
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.presentAlert('Erro', 'Por favor, preencha todos os campos corretamente.');
      return;
    }

    await this.presentLoading();

    const { cpf, nome, sessionId } = this.loginForm.getRawValue();

    this.api.salvarUsuario(cpf, sessionId, nome).subscribe({
      next: (res) => {
        console.log('Usuário salvo/atualizado no Firebase:', res);
        this.socketService.joinRoom(sessionId, cpf);
      },
      error: async (err) => {
        console.warn('Erro ao salvar/atualizar usuário (Firebase):', err);
        await this.dismissLoading();
        await this.presentAlert('Erro', 'Não foi possível salvar seus dados. Tente novamente.');
      }
    });
  }

  async presentLoading() {
    this.currentLoading = await this.loadingController.create({
      message: 'Entrando...',
      spinner: 'crescent'
    });
    await this.currentLoading.present();
  }

  async dismissLoading() {
    if (this.currentLoading) {
      await this.currentLoading.dismiss();
      this.currentLoading = null;
    }
  }

  triggerPulse() {
    this.pulse = false;
    setTimeout(() => {
      this.pulse = true;
    }, 10);
  }

  generateId() {
    this.animatePop = false;
    setTimeout(() => {
      this.animatePop = true;
      setTimeout(() => {
        this.animatePop = false;
      }, 300);
    }, 10);
    
    // Gerar ID mais único e amigável
    const characters = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    this.loginForm.get('sessionId')?.setValue(`pizza-day-${result}`);
  }

  anfitriaoToggle() {
    if (this.anfitriaoBox) {
      this.usuarioBox = false;
    }
  }

  usuarioToggle() {
    if (this.usuarioBox) {
      this.anfitriaoBox = false;
    }
  }

  onCodeResult(result: string) {
    const matched = result.match(/\/join\/([a-zA-Z0-9\-]+)/);
    if (matched && matched[1]) {
      this.loginForm.get('sessionId')?.setValue(matched[1]);

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