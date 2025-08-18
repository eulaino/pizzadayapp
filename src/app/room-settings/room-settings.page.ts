import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AlertController, NavController, LoadingController } from '@ionic/angular';
import { ApiService } from '../services/api.service';
import { SocketService } from '../services/socket.service';
import { Subscription } from 'rxjs';

import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  IonContent,
  IonIcon,
  IonButton
} from '@ionic/angular/standalone';

export interface RoomSettings {
  roomId: string;
  totalValue: number;
  divisionType: 'slices' | 'equal';
  totalSlices?: number;
  allowGuestRemoval: boolean;
  showQRCode: boolean;
  autoCalculate: boolean;
  createdBy: string;
  createdAt: number;
}

export interface RoomTemplate {
  name: string;
  settings: Omit<RoomSettings, 'roomId' | 'createdBy' | 'createdAt'>;
}

@Component({
  selector: 'app-room-settings',
  templateUrl: './room-settings.page.html',
  styleUrls: ['./room-settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonIcon,
    IonButton
  ]
})
export class RoomSettingsPage implements OnInit, OnDestroy {
  settingsForm!: FormGroup;
  errorMessage: string = '';
  savedTemplates: RoomTemplate[] = [];
  userCpf: string = '';
  userName: string = '';
  
  private subscriptions: Subscription = new Subscription();
  private currentLoading: HTMLIonLoadingElement | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private alertController: AlertController,
    private navCtrl: NavController,
    private loadingController: LoadingController,
    private api: ApiService,
    private socketService: SocketService
  ) {
    // Pegar dados do usuário vindos da navegação
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.userCpf = navigation.extras.state['cpf'] || '';
      this.userName = navigation.extras.state['nome'] || '';
    }
  }

  ngOnInit() {
    this.initializeForm();
    this.loadSavedTemplates();
    this.generateRoomId();
    
    // Setup listeners do socket
    this.setupSocketListeners();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private initializeForm() {
    this.settingsForm = this.fb.group({
      roomId: ['', [Validators.required, Validators.minLength(8)]],
      totalValue: [150, [Validators.required, Validators.min(1)]],
      divisionType: ['slices', Validators.required],
      totalSlices: [8, [Validators.min(1), Validators.max(50)]],
      allowGuestRemoval: [true],
      showQRCode: [true],
      autoCalculate: [true]
    });

    // Observar mudanças no tipo de divisão
    this.settingsForm.get('divisionType')?.valueChanges.subscribe(value => {
      if (value === 'equal') {
        this.settingsForm.get('totalSlices')?.clearValidators();
      } else {
        this.settingsForm.get('totalSlices')?.setValidators([Validators.min(1), Validators.max(50)]);
      }
      this.settingsForm.get('totalSlices')?.updateValueAndValidity();
    });
  }

  private setupSocketListeners() {
    this.subscriptions.add(
      this.socketService.onJoinError().subscribe(async (message) => {
        await this.dismissLoading();
        this.presentAlert('Erro', message);
      })
    );

    this.subscriptions.add(
      this.socketService.onPreviousMessages().subscribe(async (messages) => {
        await this.dismissLoading();
        const roomId = this.settingsForm.get('roomId')?.value;
        
        this.router.navigateByUrl('/session-room', {
          state: {
            roomId: roomId,
            username: this.userCpf,
            nome: this.userName,
            initialParticipants: messages,
            roomSettings: this.getCurrentSettings()
          },
        });
      })
    );
  }

  generateRoomId() {
    const characters = '1234567890abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    this.settingsForm.get('roomId')?.setValue(`pizza-day-${result}`);
  }

  getPreviewText(): string {
    const formValue = this.settingsForm.value;
    if (!formValue.totalValue) return '';

    const totalValue = parseFloat(formValue.totalValue);
    
    if (formValue.divisionType === 'equal') {
      return `Divisão igual: cada pessoa pagará uma parte igual do total de R$ ${totalValue.toFixed(2)}`;
    } else {
      if (formValue.totalSlices && formValue.totalSlices > 0) {
        const pricePerSlice = totalValue / formValue.totalSlices;
        return `Por fatias: R$ ${pricePerSlice.toFixed(2)} por fatia (${formValue.totalSlices} fatias totais)`;
      } else {
        return `Por fatias: valor será calculado automaticamente baseado no consumo individual`;
      }
    }
  }

  async createRoom() {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      this.presentAlert('Erro', 'Por favor, preencha todos os campos corretamente.');
      return;
    }

    if (!this.userCpf || !this.userName) {
      this.presentAlert('Erro', 'Dados do usuário não encontrados. Volte e faça login novamente.');
      return;
    }

    await this.presentLoading('Criando sala...');

    try {
      // Salvar configurações da sala no Firebase
      const roomSettings: RoomSettings = {
        ...this.settingsForm.value,
        createdBy: this.userCpf,
        createdAt: Date.now()
      };

      // Salvar configurações no Firebase
      await this.saveRoomSettings(roomSettings);

      // Criar/atualizar usuário como host
      this.api.salvarUsuario(this.userCpf, roomSettings.roomId, this.userName).subscribe({
        next: (res) => {
          console.log('Usuário salvo como host:', res);
          // Entrar na sala via socket
          this.socketService.joinRoom(roomSettings.roomId, this.userCpf);
        },
        error: async (err) => {
          console.error('Erro ao salvar usuário:', err);
          await this.dismissLoading();
          this.presentAlert('Erro', 'Não foi possível criar a sala. Tente novamente.');
        }
      });

    } catch (error) {
      console.error('Erro ao criar sala:', error);
      await this.dismissLoading();
      this.presentAlert('Erro', 'Erro ao salvar configurações. Tente novamente.');
    }
  }

  private async saveRoomSettings(settings: RoomSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      // Fazer chamada HTTP para salvar no Firebase
      fetch('https://87138696a2ea.ngrok-free.app/api/room-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
      })
      .then(response => response.json())
      .then(data => {
        console.log('Configurações da sala salvas:', data);
        resolve();
      })
      .catch(error => {
        console.error('Erro ao salvar configurações:', error);
        reject(error);
      });
    });
  }

  private getCurrentSettings(): RoomSettings {
    return {
      ...this.settingsForm.value,
      createdBy: this.userCpf,
      createdAt: Date.now()
    };
  }

  async saveAsTemplate() {
    if (this.settingsForm.invalid) {
      this.presentAlert('Erro', 'Por favor, preencha todos os campos corretamente antes de salvar como template.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Salvar Template',
      message: 'Dê um nome para este template:',
      inputs: [
        {
          name: 'templateName',
          type: 'text',
          placeholder: 'Ex: Pizza Grande Padrão'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Salvar',
          handler: (data) => {
            if (data.templateName && data.templateName.trim()) {
              this.doSaveTemplate(data.templateName.trim());
            } else {
              this.presentAlert('Erro', 'Nome do template é obrigatório.');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private doSaveTemplate(name: string) {
    const template: RoomTemplate = {
      name: name,
      settings: {
        totalValue: this.settingsForm.value.totalValue,
        divisionType: this.settingsForm.value.divisionType,
        totalSlices: this.settingsForm.value.totalSlices,
        allowGuestRemoval: this.settingsForm.value.allowGuestRemoval,
        showQRCode: this.settingsForm.value.showQRCode,
        autoCalculate: this.settingsForm.value.autoCalculate
      }
    };

    this.savedTemplates.push(template);
    this.saveTemplatesToStorage();
    this.presentAlert('Sucesso', `Template "${name}" salvo com sucesso!`);
  }

  loadTemplate(template: RoomTemplate) {
    this.settingsForm.patchValue(template.settings);
    this.generateRoomId(); // Gerar novo ID para a sala
  }

  private loadSavedTemplates() {
    const saved = localStorage.getItem('pizzaday_templates');
    if (saved) {
      try {
        this.savedTemplates = JSON.parse(saved);
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
        this.savedTemplates = [];
      }
    }
  }

  private saveTemplatesToStorage() {
    localStorage.setItem('pizzaday_templates', JSON.stringify(this.savedTemplates));
  }

  goBack() {
    this.navCtrl.back();
  }

  private async presentLoading(message: string = 'Carregando...') {
    this.currentLoading = await this.loadingController.create({
      message: message,
      spinner: 'crescent'
    });
    await this.currentLoading.present();
  }

  private async dismissLoading() {
    if (this.currentLoading) {
      await this.currentLoading.dismiss();
      this.currentLoading = null;
    }
  }

  private async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }
}