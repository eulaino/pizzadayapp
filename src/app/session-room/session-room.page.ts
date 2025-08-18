import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit, NgZone, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SocketService, Participant } from '../services/socket.service';
import { addIcons } from 'ionicons';

import {
  home, personCircle, settings, close, ellipsisVertical, people, pizza, person, trophy, remove, add, save, exit, refresh, stopCircle
} from 'ionicons/icons';

import { crown, refresh_aws } from './crown';
import { AlertController, NavController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { QRCodeComponent } from 'angularx-qrcode';
import { BarcodeFormat } from '@zxing/library';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

addIcons({
  home,
  personCircle,
  settings,
  close,
  ellipsisVertical,
  people,
  pizza,
  person,
  crown,
  refresh_aws,
  trophy,
  remove,
  add,
  save,
  exit,
  refresh,
  stopCircle
});
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonModal
} from '@ionic/angular/standalone';

interface Pizza {
  sabor: string;
  fatias: number;
  valor: number;
}

interface UserSliceData {
  [pizzaIndex: number]: number;
}

interface GlobalSliceData {
  [pizzaIndex: number]: {
    [username: string]: number;
  };
}

interface LocalBackupData {
  roomId: string;
  nome: string;
  cpf: string;
  isHost: boolean;
  participants: Participant[];
  roomSettings: any;
  pizzasList: Pizza[];
  userSliceData: UserSliceData;
  globalSliceData: GlobalSliceData;
  timestamp: number;
}

@Component({
  selector: 'app-session-room',
  templateUrl: './session-room.page.html',
  styleUrls: ['./session-room.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    QRCodeComponent,
    ZXingScannerModule,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonInput,
    IonCardTitle,
    IonCardContent,
    IonText,
    IonList,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonModal
  ]
})
export class SessionRoomPage implements OnInit, OnDestroy, AfterViewInit {
  // ViewChild para os modals
  @ViewChild('participantsModal', { static: false }) participantsModal!: IonModal;
  @ViewChild('pizzasModal', { static: false }) pizzasModal!: IonModal;
  @ViewChild('billDetailsModal', { static: false }) billDetailsModal!: IonModal;
  @ViewChild('actionsModal', { static: false }) actionsModal!: IonModal;

  roomId: string = '';
  cpf: string = '';
  nome: string = '';
  pizzaSlices: number = 0;
  isHost: boolean = false;
  participants: Participant[] = [];
  barcodeFormats = [BarcodeFormat.QR_CODE];
  selectedParticipantToRemove: string = '';
  pulse = false;

  private isInitialized = false;
  private dataLoaded = false;

  // Sistema de gerenciamento de pizzas
  pizzasList: Pizza[] = [];
  newPizza: Pizza = {
    sabor: '',
    fatias: 8,
    valor: 0
  };
  userSliceData: UserSliceData = {};
  globalSliceData: GlobalSliceData = {};

  // Configurações da sala
  roomSettings: any = {
    divisionType: 'consumption',
    showQRCode: true,
    pizzas: [],
    globalSlices: {}
  };

  // UI Estado
  showPizzaPanel: boolean = false;
  settingsChanged: boolean = false;
  settingsUpdateMessage: string = '';
  isSyncing: boolean = false;
  lastSyncTime: Date = new Date();

  // Intervalos e timeouts
  autoSyncInterval: any;
  reconnectInterval: any;
  heartbeatInterval: any;
  forceRefreshInterval: any;

  private originalSettings: any = {};

  // Estados de conexão
  isConnected: boolean = true;
  isRoomActive: boolean = true;
  connectionAttempts: number = 0;
  maxReconnectAttempts: number = 5;
  isLoading: boolean = true;

  // Backup local
  private localStorageKey: string = '';

  triggerPulse() {
    this.pulse = false;
    setTimeout(() => {
      this.pulse = true;
    }, 10);
  }

  private subscriptions: Subscription = new Subscription();

  constructor(
    private router: Router,
    private socketService: SocketService,
    private alertController: AlertController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.roomId = navigation.extras.state['roomId'];
      this.cpf = navigation.extras.state['username'];
      this.nome = navigation.extras.state['nome'];
      this.participants = navigation.extras.state['initialParticipants'] || [];

      // Configurar chave do localStorage
      this.localStorageKey = `pizzaday_${this.roomId}_${this.cpf}`;

      if (navigation.extras.state['roomSettings']) {
        this.roomSettings = navigation.extras.state['roomSettings'];
        this.originalSettings = { ...this.roomSettings };
        this.pizzasList = this.roomSettings.pizzas || [];
        this.globalSliceData = this.roomSettings.globalSlices || {};
      }

      const currentUserData = this.participants.find(p => p.author === this.nome);
      if (currentUserData) {
        this.pizzaSlices = currentUserData.pizza;
        this.isHost = currentUserData.isHost || false;
      }
    }
  }

  // ============ MÉTODOS DE CÁLCULO MELHORADOS ============

  getParticipantConsumptionValue(participantName: string): number {
    let total = 0;

    for (const pizzaIndex in this.globalSliceData) {
      if (this.globalSliceData[pizzaIndex][participantName]) {
        const pizza = this.pizzasList[parseInt(pizzaIndex)];
        if (pizza) {
          const sliceValue = pizza.valor / pizza.fatias;
          const userSlices = this.globalSliceData[pizzaIndex][participantName];
          total += sliceValue * userSlices;
        }
      }
    }

    return total;
  }

  ngOnInit() {
    console.log('🚀 Inicializando sessão robusta:', {
      roomId: this.roomId,
      nome: this.nome,
      cpf: this.cpf
    });

    if (!this.roomId || !this.cpf || !this.nome) {
      console.error('❌ Dados obrigatórios faltando');
      this.navCtrl.navigateRoot('/home');
      return;
    }

    // Tentar recuperar dados do backup local primeiro
    this.loadLocalBackup();

    this.setupSocketListeners();
    this.initializeSession();
    this.startHeartbeat();
    this.startAutoSync();
    this.startForceRefresh();
    this.setupVisibilityDetection();
  }

  // ============ SISTEMA DE BACKUP LOCAL ============

  private saveLocalBackup() {
    try {
      const backupData: LocalBackupData = {
        roomId: this.roomId,
        nome: this.nome,
        cpf: this.cpf,
        isHost: this.isHost,
        participants: this.participants,
        roomSettings: this.roomSettings,
        pizzasList: this.pizzasList,
        userSliceData: this.userSliceData,
        globalSliceData: this.globalSliceData,
        timestamp: Date.now()
      };

      localStorage.setItem(this.localStorageKey, JSON.stringify(backupData));
      console.log('💾 Backup local salvo');
    } catch (error) {
      console.error('⚠️ Erro ao salvar backup local:', error);
    }
  }

  private loadLocalBackup() {
    try {
      const backupStr = localStorage.getItem(this.localStorageKey);
      if (backupStr) {
        const backup: LocalBackupData = JSON.parse(backupStr);

        // Verificar se backup não é muito antigo (máximo 1 hora)
        const maxAge = 60 * 60 * 1000; // 1 hora
        if (Date.now() - backup.timestamp < maxAge) {
          console.log('📦 Carregando backup local');

          this.participants = backup.participants || [];
          this.roomSettings = backup.roomSettings || this.roomSettings;
          this.pizzasList = backup.pizzasList || [];
          this.userSliceData = backup.userSliceData || {};
          this.globalSliceData = backup.globalSliceData || {};
          this.isHost = backup.isHost || false;

          this.originalSettings = { ...this.roomSettings };
          this.recalculateUserSlices();
          this.dataLoaded = true;

          console.log('✅ Backup local carregado com sucesso');
          this.forceDataRefresh();
        } else {
          console.log('🗑️ Backup local muito antigo, ignorando');
          localStorage.removeItem(this.localStorageKey);
        }
      }
    } catch (error) {
      console.error('⚠️ Erro ao carregar backup local:', error);
    }
  }

  private clearLocalBackup() {
    try {
      localStorage.removeItem(this.localStorageKey);
    } catch (error) {
      console.error('⚠️ Erro ao limpar backup local:', error);
    }
  }

  // ============ INICIALIZAÇÃO ROBUSTA ============

  // ============ INICIALIZAÇÃO OTIMIZADA ============

  private async initializeSession() {
    try {
      console.log('🔄 Inicializando sessão otimizada...');
      this.isLoading = true;

      // 1. Verificar status da sala
      const roomStatus = await this.checkRoomStatus();
      if (!roomStatus.isActive) {
        await this.presentAlert('Sala Encerrada', 'Esta sala foi encerrada.');
        this.clearLocalBackup();
        this.navCtrl.navigateRoot('/home');
        return;
      }

      // 2. Carregar configurações se não temos backup local válido
      if (!this.dataLoaded) {
        await this.loadRoomSettingsFromFirebase();
      }

      // 3. Conectar via socket
      console.log('🚪 Conectando na sala via socket...');
      this.socketService.joinRoom(this.roomId, this.cpf);

      // 4. Forçar carregamento de dados após conexão
      setTimeout(() => {
        this.forceDataRefresh();
      }, 1000);

      // 5. Timeout de segurança
      setTimeout(() => {
        this.isLoading = false;
        this.isInitialized = true;

        // Salvar backup inicial
        this.saveLocalBackup();

        this.cdr.detectChanges();
        console.log('✅ Inicialização concluída');
      }, 2000); // Reduzido para 2 segundos para melhor UX

    } catch (error) {
      console.error('❌ Erro ao inicializar sessão:', error);
      this.isLoading = false;
      this.handleConnectionError();
    }
  }

  // ============ MÉTODOS DE MODAL ============

  async openParticipantsModal() {
    await this.participantsModal.present();
  }

  async openPizzasModal() {
    await this.pizzasModal.present();
  }

  async openBillDetailsModal() {
    await this.billDetailsModal.present();
  }

  async openActionsModal() {
    await this.actionsModal.present();
  }


  // Forçar atualização de dados (anti-bug) - método público
  async forceDataRefresh() {
    try {
      console.log('🔄 Forçando refresh de dados...');

      // Solicitar status atual
      this.socketService.requestRoomStatus(this.roomId);
      this.socketService.checkCurrentUserHost(this.roomId);

      // Solicitar configurações via socket
      this.socketService.emit('getRoomSettings', { roomId: this.roomId });

      // Recarregar configurações via HTTP como backup
      await this.loadRoomSettingsFromFirebase();

      // Forçar detecção de mudanças
      this.cdr.detectChanges();

      console.log('✅ Refresh de dados concluído');
    } catch (error) {
      console.error('⚠️ Erro no refresh de dados:', error);
    }
  }

  // Verificar status da sala
  private async checkRoomStatus(): Promise<{ isActive: boolean, settings?: any }> {
    try {
      // MUDE ESTA URL para sua URL real do servidor
      const response = await fetch(`http://localhost:3000/api/room-status/${this.roomId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.log('📊 Status da sala:', data);
          return data;
        } else {
          console.error('❌ Resposta não é JSON');
          return { isActive: true };
        }
      }
      console.log('ℹ️ Assumindo sala ativa');
      return { isActive: true };
    } catch (error) {
      console.error('⚠️ Erro ao verificar status:', error);
      return { isActive: true };
    }
  }

  // Carregar configurações
  private async loadRoomSettingsFromFirebase() {
    console.log('⚙️ Carregando configurações...');
    try {
      // MUDE ESTA URL para sua URL real do servidor
      const response = await fetch(`http://localhost:3000/api/room-settings/${this.roomId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const settings = await response.json();
          this.applyRoomSettings(settings);
          this.dataLoaded = true;
          console.log('✅ Configurações carregadas via HTTP');
        } else {
          console.error('❌ Resposta não é JSON:', await response.text());
          throw new Error('Resposta inválida do servidor');
        }
      } else {
        console.log('ℹ️ Usando configurações padrão');
        this.applyRoomSettings({
          divisionType: 'consumption',
          showQRCode: true,
          pizzas: [],
          globalSlices: {}
        });
      }
    } catch (error) {
      console.error('⚠️ Erro ao carregar configurações:', error);
      if (!this.dataLoaded) {
        this.applyRoomSettings({
          divisionType: 'consumption',
          showQRCode: true,
          pizzas: [],
          globalSlices: {}
        });
      }
    }
  }

  // Aplicar configurações
  private applyRoomSettings(settings: any) {
    this.roomSettings = settings;
    this.originalSettings = { ...settings };
    this.pizzasList = settings.pizzas || [];
    this.globalSliceData = settings.globalSlices || {};

    this.recalculateUserSlices();
    this.settingsChanged = false;

    // Salvar backup após aplicar configurações
    this.saveLocalBackup();

    this.cdr.detectChanges();

    console.log('✅ Configurações aplicadas:', {
      pizzas: this.pizzasList.length,
      fatias: Object.keys(this.globalSliceData).length
    });
  }

  // Recalcular fatias do usuário
  private recalculateUserSlices() {
    this.userSliceData = {};
    let totalSlices = 0;

    for (const pizzaIndex in this.globalSliceData) {
      if (this.globalSliceData[pizzaIndex][this.nome]) {
        const slices = this.globalSliceData[pizzaIndex][this.nome];
        this.userSliceData[parseInt(pizzaIndex)] = slices;
        totalSlices += slices;
      }
    }

    this.pizzaSlices = totalSlices;

    const me = this.participants.find(p => p.author === this.nome);
    if (me) {
      me.pizza = this.pizzaSlices;
    }

    console.log('🔄 Fatias recalculadas:', {
      total: this.pizzaSlices,
      detalhes: this.userSliceData
    });
  }

  // ============ SISTEMAS DE MONITORAMENTO ============

  // Heartbeat para manter conexão
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.roomId && this.nome && this.isRoomActive && this.isConnected) {
        this.socketService.emit('heartbeat', {
          roomId: this.roomId,
          username: this.nome,
          timestamp: Date.now()
        });
      }
    }, 30000);
    console.log('💓 Heartbeat iniciado');
  }

  // Auto-sync melhorado
  private startAutoSync() {
    this.autoSyncInterval = setInterval(() => {
      if (this.roomId && this.nome && this.isConnected && this.isRoomActive && this.isInitialized) {
        // Salvar backup local a cada sync
        this.saveLocalBackup();

        // Sincronizar dados se houver mudanças
        const hasSliceData = Object.keys(this.globalSliceData).length > 0;
        const hasUserData = Object.keys(this.userSliceData).length > 0;

        if (hasSliceData || hasUserData) {
          this.lastSyncTime = new Date();
          this.roomSettings.globalSlices = this.globalSliceData;

          this.socketService.emit('updateGlobalSlices', {
            roomId: this.roomId,
            globalSlices: this.globalSliceData,
            updatedBy: this.nome,
            timestamp: Date.now(),
            autoSync: true
          });
        }
      }
    }, 5000);
    console.log('🔄 Auto-sync iniciado');
  }

  // Refresh forçado para evitar bugs
  private startForceRefresh() {
    this.forceRefreshInterval = setInterval(() => {
      if (this.isInitialized && this.isConnected && this.isRoomActive) {
        console.log('🔄 Refresh automático de dados');
        this.forceDataRefresh();
      }
    }, 30000); // A cada 30 segundos
    console.log('🔄 Force refresh iniciado');
  }

  // ============ LISTENERS DE SOCKET (ROBUSTOS) ============

  private setupSocketListeners() {
    // Listener para mensagens
    this.subscriptions.add(
      this.socketService.onReceivedMessage().subscribe((message: Participant) => {
        this.ngZone.run(() => {
          if (message.roomId === this.roomId) {
            console.log('📡 Mensagem recebida:', message);
            this.updateParticipantList(message);
            this.saveLocalBackup(); // Salvar backup a cada mudança

            if (message.author === this.nome) {
              this.pizzaSlices = message.pizza;
              if (message.isHost !== undefined) {
                this.isHost = message.isHost;
              }
            }
          }
        });
      })
    );

    // Listener para status de host
    this.subscriptions.add(
      this.socketService.onYouAreHost().subscribe((data) => {
        this.ngZone.run(() => {
          console.log('👑 Host status recebido:', data.isHost);
          this.isHost = data.isHost;
          this.isInitialized = true;
          this.isLoading = false;
          this.isConnected = true;
          this.connectionAttempts = 0;

          if (this.isHost) {
            this.showPizzaPanel = true;
          }

          this.saveLocalBackup();
          this.cdr.detectChanges();
        });
      })
    );

    // Listener para entrada na sala
    this.subscriptions.add(
      this.socketService.onRoomJoined().subscribe((data) => {
        this.ngZone.run(() => {
          if (data.roomId === this.roomId) {
            console.log('🏠 Entrada na sala confirmada');
            this.participants = data.participants || [];

            const currentUser = this.participants.find(p => p.author === this.nome);
            if (currentUser) {
              this.isHost = currentUser.isHost || false;
              this.pizzaSlices = currentUser.pizza || 0;
            }

            if (data.isHost !== undefined) {
              this.isHost = data.isHost;
            }

            this.isInitialized = true;
            this.isLoading = false;
            this.isConnected = true;
            this.connectionAttempts = 0;

            if (this.isHost) {
              this.showPizzaPanel = true;
            }

            this.saveLocalBackup();
            this.cdr.detectChanges();

            console.log(`✅ Sessão inicializada. Host: ${this.isHost}, Participantes: ${this.participants.length}`);
          }
        });
      })
    );

    // Listener para configurações atualizadas
    this.subscriptions.add(
      this.socketService.listen('roomSettingsUpdated').subscribe((data: any) => {
        this.ngZone.run(() => {
          if (data.roomId === this.roomId) {
            console.log('⚙️ Configurações atualizadas via socket');
            this.applyRoomSettings(data.settings);
            this.showSettingsUpdateMessage(`Configurações atualizadas por ${data.updatedBy}`);
          }
        });
      })
    );

    // Listener para fatias globais atualizadas
    this.subscriptions.add(
      this.socketService.listen('globalSlicesUpdated').subscribe((data: any) => {
        this.ngZone.run(() => {
          if (data.roomId === this.roomId && data.updatedBy !== this.nome) {
            if (!data.autoSync) {
              console.log('📡 Fatias atualizadas por:', data.updatedBy);
            }

            this.lastSyncTime = new Date();
            this.globalSliceData = data.globalSlices;
            this.roomSettings.globalSlices = data.globalSlices;

            if (!data.slicesOnly && data.settings) {
              this.applyRoomSettings(data.settings);
            } else {
              this.recalculateUserSlices();
            }

            // Atualizar todos os participantes
            this.participants.forEach(participant => {
              participant.pizza = this.getUserTotalSlicesForParticipant(participant.author);
            });

            this.saveLocalBackup();
            this.cdr.detectChanges();
          }
        });
      })
    );

    // Listener para sala encerrada
    this.subscriptions.add(
      this.socketService.listen('roomEnded').subscribe((data: any) => {
        this.ngZone.run(async () => {
          if (data.roomId === this.roomId) {
            this.isRoomActive = false;
            this.clearLocalBackup();
            await this.presentAlert('Sessão Encerrada', `A sessão foi encerrada por ${data.endedBy}.`);
            this.navCtrl.navigateRoot('/home');
          }
        });
      })
    );

    // Listener para resposta de configurações
    this.subscriptions.add(
      this.socketService.listen('roomSettingsResponse').subscribe((data: any) => {
        this.ngZone.run(() => {
          if (data.roomId === this.roomId) {
            console.log('⚙️ Configurações recebidas via socket');
            this.applyRoomSettings(data.settings);
          }
        });
      })
    );

    // Listener para usuário saiu
    this.subscriptions.add(
      this.socketService.onUserLeft().subscribe((data) => {
        this.ngZone.run(() => {
          if (data.roomId === this.roomId) {
            console.log('👋 Usuário saiu:', data.author);
            this.removeParticipantFromList(data.author);
            this.saveLocalBackup();
            this.cdr.detectChanges();
          }
        });
      })
    );

    // Listener para erros
    this.subscriptions.add(
      this.socketService.onError().subscribe(async (message) => {
        this.ngZone.run(async () => {
          console.error('❌ Erro do socket:', message);
          await this.presentAlert('Erro', message);
        });
      })
    );

    // Listener para desconexão
    this.subscriptions.add(
      this.socketService.listen('disconnect').subscribe(() => {
        this.ngZone.run(() => {
          console.log('⚠️ Socket desconectado');
          this.isConnected = false;
          this.handleConnectionError();
        });
      })
    );

    // Listener para erro de entrada
    this.subscriptions.add(
      this.socketService.listen('joinError').subscribe((message: string) => {
        this.ngZone.run(async () => {
          console.error('❌ Erro ao entrar na sala:', message);
          this.isLoading = false;
          await this.presentAlert('Erro', message);
        });
      })
    );
  }

  // ============ CONTROLE DE RECONEXÃO ============

  private handleConnectionError() {
    if (this.connectionAttempts >= this.maxReconnectAttempts) {
      this.presentAlert('Conexão Perdida', 'Não foi possível manter a conexão. Dados locais foram preservados.');
      return;
    }

    this.isConnected = false;
    this.connectionAttempts++;

    console.log(`🔄 Tentativa de reconexão ${this.connectionAttempts}/${this.maxReconnectAttempts}`);

    this.reconnectInterval = setTimeout(() => {
      this.attemptReconnection();
    }, 3000 * this.connectionAttempts);
  }

  private async attemptReconnection() {
    try {
      console.log('🔄 Tentando reconectar...');

      const roomStatus = await this.checkRoomStatus();
      if (!roomStatus.isActive) {
        this.isRoomActive = false;
        this.clearLocalBackup();
        await this.presentAlert('Sala Encerrada', 'Esta sala foi encerrada.');
        this.navCtrl.navigateRoot('/home');
        return;
      }

      this.socketService.joinRoom(this.roomId, this.cpf);
      await this.loadRoomSettingsFromFirebase();

      this.isConnected = true;
      this.connectionAttempts = 0;

      // Forçar refresh após reconexão
      setTimeout(() => {
        this.forceDataRefresh();
      }, 1000);

      console.log('✅ Reconexão bem-sucedida');

    } catch (error) {
      console.error('❌ Falha na reconexão:', error);
      this.handleConnectionError();
    }
  }

  // ============ MÉTODOS EXISTENTES (melhorados) ============

  getAvailableSlices(pizzaIndex: number): number {
    const pizza = this.pizzasList[pizzaIndex];
    if (!pizza) return 0;

    const consumedSlices = this.getConsumedSlices(pizzaIndex);
    return Math.max(0, pizza.fatias - consumedSlices);
  }

  getConsumedSlices(pizzaIndex: number): number {
    if (!this.globalSliceData[pizzaIndex]) return 0;

    return Object.values(this.globalSliceData[pizzaIndex]).reduce((sum, slices) => sum + slices, 0);
  }

  getTotalAvailableSlices(): number {
    return this.pizzasList.reduce((sum, pizza, index) => sum + this.getAvailableSlices(index), 0);
  }

  getUserTotalSlicesForParticipant(username: string): number {
    let total = 0;
    for (const pizzaIndex in this.globalSliceData) {
      if (this.globalSliceData[pizzaIndex][username]) {
        total += this.globalSliceData[pizzaIndex][username];
      }
    }
    return total;
  }

  togglePizzaPanel() {
    this.showPizzaPanel = !this.showPizzaPanel;
    this.saveLocalBackup();
  }

  addPizza() {
    if (!this.newPizza.sabor || !this.newPizza.fatias || !this.newPizza.valor) {
      this.presentAlert('Erro', 'Preencha todos os campos da pizza.');
      return;
    }

    this.pizzasList.push({ ...this.newPizza });

    this.newPizza = {
      sabor: '',
      fatias: 8,
      valor: 0
    };

    this.updateRoomSettings();
    this.onSettingsChange();
    this.syncGlobalSliceData();
    this.saveLocalBackup();

    console.log('🍕 Pizza adicionada:', this.pizzasList.length);
  }

  removePizza(index: number) {
    const pizzaName = this.pizzasList[index]?.sabor || 'Pizza';

    this.pizzasList.splice(index, 1);

    if (this.globalSliceData[index]) {
      delete this.globalSliceData[index];
    }

    if (this.userSliceData[index] !== undefined) {
      delete this.userSliceData[index];
    }

    this.reorganizeSliceData(index);
    this.updateRoomSettings();
    this.onSettingsChange();
    this.updateUserTotalSlices();
    this.syncGlobalSliceData();
    this.saveLocalBackup();

    console.log('🗑️ Pizza removida:', pizzaName);
  }

  private reorganizeSliceData(removedIndex: number) {
    const newGlobalSliceData: GlobalSliceData = {};
    for (const pizzaIndex in this.globalSliceData) {
      const index = parseInt(pizzaIndex);
      if (index < removedIndex) {
        newGlobalSliceData[index] = this.globalSliceData[index];
      } else if (index > removedIndex) {
        newGlobalSliceData[index - 1] = this.globalSliceData[index];
      }
    }
    this.globalSliceData = newGlobalSliceData;

    const newUserSliceData: UserSliceData = {};
    for (const pizzaIndex in this.userSliceData) {
      const index = parseInt(pizzaIndex);
      if (index < removedIndex) {
        newUserSliceData[index] = this.userSliceData[index];
      } else if (index > removedIndex) {
        newUserSliceData[index - 1] = this.userSliceData[index];
      }
    }
    this.userSliceData = newUserSliceData;
  }

  addSliceToPizza(pizzaIndex: number) {
    const pizza = this.pizzasList[pizzaIndex];
    if (!pizza) return;

    const availableSlices = this.getAvailableSlices(pizzaIndex);
    if (availableSlices <= 0) {
      this.presentAlert('Esgotado', `Não há mais fatias disponíveis desta pizza.`);
      return;
    }

    if (!this.userSliceData[pizzaIndex]) {
      this.userSliceData[pizzaIndex] = 0;
    }
    this.userSliceData[pizzaIndex]++;

    if (!this.globalSliceData[pizzaIndex]) {
      this.globalSliceData[pizzaIndex] = {};
    }
    if (!this.globalSliceData[pizzaIndex][this.nome]) {
      this.globalSliceData[pizzaIndex][this.nome] = 0;
    }
    this.globalSliceData[pizzaIndex][this.nome]++;

    this.syncSliceDataOnly();
    this.updateUserTotalSlices();
    this.triggerPulse();
    this.saveLocalBackup();

    
  }

  removeSliceFromPizza(pizzaIndex: number) {
    if (!this.userSliceData[pizzaIndex] || this.userSliceData[pizzaIndex] <= 0) {
      this.presentAlert('Ops!', 'Você não tem fatias desta pizza para remover.');
      return;
    }

    this.userSliceData[pizzaIndex]--;
    if (this.userSliceData[pizzaIndex] <= 0) {
      delete this.userSliceData[pizzaIndex];
    }

    if (this.globalSliceData[pizzaIndex] && this.globalSliceData[pizzaIndex][this.nome]) {
      this.globalSliceData[pizzaIndex][this.nome]--;
      if (this.globalSliceData[pizzaIndex][this.nome] <= 0) {
        delete this.globalSliceData[pizzaIndex][this.nome];
        if (Object.keys(this.globalSliceData[pizzaIndex]).length === 0) {
          delete this.globalSliceData[pizzaIndex];
        }
      }
    }

    this.syncSliceDataOnly();
    this.updateUserTotalSlices();
    this.triggerPulse();
    this.saveLocalBackup();
  }

  private syncGlobalSliceData() {
    this.isSyncing = true;
    this.lastSyncTime = new Date();
    this.roomSettings.globalSlices = this.globalSliceData;

    if (this.isHost) {
      this.saveSettingsToServer().catch(error => {
        console.error('Erro ao salvar configurações:', error);
      }).finally(() => {
        this.isSyncing = false;
        this.cdr.detectChanges();
      });
    } else {
      setTimeout(() => {
        this.isSyncing = false;
        this.cdr.detectChanges();
      }, 500);
    }

    this.socketService.emit('updateGlobalSlices', {
      roomId: this.roomId,
      globalSlices: this.globalSliceData,
      settings: this.roomSettings,
      updatedBy: this.nome,
      timestamp: Date.now()
    });

    if (this.isHost) {
      this.socketService.emit('updateRoomSettings', {
        roomId: this.roomId,
        settings: this.roomSettings,
        updatedBy: this.nome
      });
    }

    this.saveLocalBackup();
  }

  private syncSliceDataOnly() {
    this.isSyncing = true;
    this.lastSyncTime = new Date();
    this.roomSettings.globalSlices = this.globalSliceData;

    this.socketService.emit('updateGlobalSlices', {
      roomId: this.roomId,
      globalSlices: this.globalSliceData,
      updatedBy: this.nome,
      timestamp: Date.now(),
      slicesOnly: true
    });

    setTimeout(() => {
      this.isSyncing = false;
      this.cdr.detectChanges();
    }, 400);

    this.saveLocalBackup();
  }

  getUserSlicesFromPizza(pizzaIndex: number): number {
    return this.userSliceData[pizzaIndex] || 0;
  }

  getTotalUserSlices(): number {
    return Object.values(this.userSliceData).reduce((sum, slices) => sum + slices, 0);
  }

  updateUserTotalSlices() {
    const newTotal = this.getTotalUserSlices();
    this.pizzaSlices = newTotal;

    const me = this.participants.find(p => p.author === this.nome);
    if (me) {
      me.pizza = this.pizzaSlices;
    }

    this.socketService.sendMessage(this.nome, this.pizzaSlices, this.roomId);
    this.saveLocalBackup();
    this.cdr.detectChanges();
  }

  updateRoomSettings() {
    this.roomSettings.pizzas = this.pizzasList;
    this.roomSettings.globalSlices = this.globalSliceData;
    this.saveLocalBackup();
  }

  resetAllSlices() {
    if (!this.isHost) return;

    this.globalSliceData = {};
    this.userSliceData = {};

    this.participants.forEach(p => {
      p.pizza = 0;
    });

    this.pizzaSlices = 0;
    this.updateRoomSettings();
    this.syncGlobalSliceData();
    this.socketService.sendMessage(this.nome, 0, this.roomId);

    this.presentAlert('Reset Completo', 'Todas as fatias foram resetadas.');
  }

  // ============ MÉTODOS DE CÁLCULO ============

  getTotalPizzasValue(): number {
    return this.pizzasList.reduce((sum, pizza) => sum + pizza.valor, 0);
  }

  getTotalSlices(): number {
    return this.pizzasList.reduce((sum, pizza) => sum + pizza.fatias, 0);
  }

  getMyShare(): number {
    if (this.roomSettings.divisionType === 'equal') {
      return this.getEqualShare();
    } else {
      return this.getConsumptionShare();
    }
  }

  getEqualShare(): number {
    const totalValue = this.getTotalPizzasValue();
    return this.participants.length > 0 ? totalValue / this.participants.length : 0;
  }

  getConsumptionShare(): number {
    let total = 0;

    for (const pizzaIndex in this.userSliceData) {
      const pizza = this.pizzasList[parseInt(pizzaIndex)];
      if (pizza) {
        const sliceValue = pizza.valor / pizza.fatias;
        const userSlices = this.userSliceData[parseInt(pizzaIndex)];
        total += sliceValue * userSlices;
      }
    }

    return total;
  }

  getFormattedShare(): string {
    const valor = this.getMyShare();
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  changeDivisionType(type: 'consumption' | 'equal') {
    this.roomSettings.divisionType = type;
    this.onSettingsChange();
    this.saveLocalBackup();
  }

  onSettingsChange() {
    this.settingsChanged = this.hasSettingsChanged();
  }

  private hasSettingsChanged(): boolean {
    return JSON.stringify(this.roomSettings) !== JSON.stringify(this.originalSettings);
  }

  async saveSettings() {
    if (!this.isHost) {
      this.presentAlert('Acesso Restrito', 'Apenas hosts podem alterar configurações da sala.');
      return;
    }

    if (!this.settingsChanged) {
      return;
    }

    try {
      await this.saveSettingsToServer();

      this.socketService.emit('updateRoomSettings', {
        roomId: this.roomId,
        settings: this.roomSettings,
        updatedBy: this.nome
      });

      this.originalSettings = { ...this.roomSettings };
      this.settingsChanged = false;
      this.showSettingsUpdateMessage('Configurações salvas com sucesso!');
      this.saveLocalBackup();

    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      this.presentAlert('Erro', 'Não foi possível salvar as configurações.');
    }
  }

  private async saveSettingsToServer(settings?: any): Promise<void> {
    const settingsToSave = settings || this.roomSettings;

    const response = await fetch('https://87138696a2ea.ngrok-free.app/api/room-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...settingsToSave,
        roomId: this.roomId,
        createdBy: this.cpf,
        createdAt: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error('Erro ao salvar configurações');
    }
  }

  private showSettingsUpdateMessage(message: string) {
    this.settingsUpdateMessage = message;
    setTimeout(() => {
      this.settingsUpdateMessage = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  updateParticipantList(newMessage: Participant) {
    const index = this.participants.findIndex(p => p.author === newMessage.author);
    if (index > -1) {
      this.participants[index] = { ...newMessage };
    } else {
      this.participants.push({ ...newMessage });
    }

    if (newMessage.author === this.nome) {
      this.pizzaSlices = newMessage.pizza;
      if (newMessage.isHost !== undefined) {
        this.isHost = newMessage.isHost;
      }
    }

    this.participants.sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return a.author.localeCompare(b.author);
    });

    this.cdr.detectChanges();
  }

  removeParticipantFromList(author: string) {
    this.participants = this.participants.filter(p => p.author !== author);

    let hasChanges = false;
    for (const pizzaIndex in this.globalSliceData) {
      if (this.globalSliceData[pizzaIndex][author]) {
        delete this.globalSliceData[pizzaIndex][author];
        hasChanges = true;
        if (Object.keys(this.globalSliceData[pizzaIndex]).length === 0) {
          delete this.globalSliceData[pizzaIndex];
        }
      }
    }

    if (hasChanges) {
      if (this.isHost) {
        this.syncGlobalSliceData();
      } else {
        this.syncSliceDataOnly();
      }
    }
  }

  hostRemoveSlice() {
    if (!this.isHost) {
      this.presentAlert('Permissão Negada', 'Apenas o host pode remover fatias de outros participantes.');
      return;
    }
    if (!this.selectedParticipantToRemove) {
      this.presentAlert('Erro', 'Selecione um participante para ajustar fatias.');
      return;
    }

    let removed = false;
    for (const pizzaIndex in this.globalSliceData) {
      if (this.globalSliceData[pizzaIndex][this.selectedParticipantToRemove] > 0) {
        this.globalSliceData[pizzaIndex][this.selectedParticipantToRemove]--;
        if (this.globalSliceData[pizzaIndex][this.selectedParticipantToRemove] <= 0) {
          delete this.globalSliceData[pizzaIndex][this.selectedParticipantToRemove];
          if (Object.keys(this.globalSliceData[pizzaIndex]).length === 0) {
            delete this.globalSliceData[pizzaIndex];
          }
        }
        removed = true;
        break;
      }
    }

    if (removed) {
      this.syncGlobalSliceData();
      this.presentAlert('Fatia Removida', `Uma fatia foi removida de ${this.selectedParticipantToRemove}.`);
    } else {
      this.presentAlert('Erro', `${this.selectedParticipantToRemove} não tem fatias para remover.`);
    }

    this.selectedParticipantToRemove = '';
    this.cdr.detectChanges();
  }

  // ============ CONTROLE DE ENCERRAMENTO ============

  async endSession() {
    if (!this.isHost) {
      await this.presentAlert('Acesso Restrito', 'Apenas o host pode encerrar a sessão.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Encerrar Sessão',
      message: 'Tem certeza que deseja encerrar esta sessão? Todos os participantes serão desconectados.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Encerrar',
          handler: async () => {
            await this.confirmEndSession();
          }
        }
      ]
    });

    await alert.present();
  }

  private async confirmEndSession() {
    try {
      const response = await fetch(`https://87138696a2ea.ngrok-free.app/api/end-room/${this.roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: this.cpf,
          endedBy: this.nome
        })
      });

      if (response.ok) {
        this.socketService.emit('roomEnded', {
          roomId: this.roomId,
          endedBy: this.nome,
          timestamp: Date.now()
        });

        this.clearLocalBackup();
        await this.presentAlert('Sessão Encerrada', 'A sessão foi encerrada com sucesso.');
        this.navCtrl.navigateRoot('/home');
      } else {
        throw new Error('Erro ao encerrar sessão');
      }
    } catch (error) {
      console.error('❌ Erro ao encerrar sessão:', error);
      await this.presentAlert('Erro', 'Não foi possível encerrar a sessão.');
    }
  }

  async toggleHostStatus() {
    if (!this.isHost) {
      const alert = await this.alertController.create({
        header: 'Tornar-se Host',
        message: 'Deseja se tornar host desta sessão?',
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Sim',
            handler: async () => {
              try {
                const response = await fetch('https://87138696a2ea.ngrok-free.app/api/set-host', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    cpf: this.cpf,
                    roomId: this.roomId,
                    nome: this.nome
                  })
                });

                if (response.ok) {
                  this.isHost = true;
                  this.showPizzaPanel = true;
                  this.saveLocalBackup();
                  this.presentAlert('Sucesso', 'Você agora é host desta sessão!');
                  this.forceDataRefresh();
                } else {
                  this.presentAlert('Erro', 'Não foi possível tornar-se host.');
                }
              } catch (error) {
                console.error('Erro ao definir host:', error);
                this.presentAlert('Erro', 'Erro de conexão.');
              }
            }
          }
        ]
      });
      await alert.present();
    }
  }

  async leaveSession() {
    const alert = await this.alertController.create({
      header: 'Ops!',
      message: 'Tem certeza que deseja sair da sessão?',
      buttons: [
        {
          text: 'NÃO',
          role: 'cancel'
        }, {
          text: 'SIM',
          handler: () => {
            this.socketService.leaveRoom(this.roomId);
            this.socketService.resetSessionState(this.roomId);
            this.clearLocalBackup();
            this.navCtrl.navigateRoot('/home');
          }
        }
      ],
    });
    await alert.present();
  }

  updateHostSelectAndButtons() {
    this.selectedParticipantToRemove = '';
    this.cdr.detectChanges();
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  private requestCurrentStatus() {
    this.socketService.requestRoomStatus(this.roomId);
    this.socketService.checkCurrentUserHost(this.roomId);
  }

  private setupVisibilityDetection() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.roomId && this.isRoomActive) {
        console.log('👁️ Usuário voltou, atualizando...');
        this.forceDataRefresh();
        this.saveLocalBackup();
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (!this.isInitialized && !this.isLoading) {
        this.requestCurrentStatus();
      }
    }, 1000);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();

    // Salvar backup final
    this.saveLocalBackup();

    // Limpar intervalos
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
    if (this.forceRefreshInterval) {
      clearInterval(this.forceRefreshInterval);
    }
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
    }

    console.log('🔌 Componente destruído, backup salvo');
  }
}