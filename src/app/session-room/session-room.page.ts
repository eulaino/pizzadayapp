import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SocketService, Participant } from '../services/socket.service';
import { AlertController, NavController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

import { CommonModule } from '@angular/common'; // Para *ngIf, *ngFor
import { FormsModule } from '@angular/forms'; // Para [(ngModel)]
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
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';

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
    IonSelect,
    IonSelectOption
  ]
})
export class SessionRoomPage implements OnInit, OnDestroy {
  roomId: string = '';
  username: string = '';
  pizzaSlices: number = 0;
  isHost: boolean = false;
  participants: Participant[] = [];
  selectedParticipantToRemove: string = '';

  readonly valorTotalPizza: number = 150;

  private subscriptions: Subscription = new Subscription();

  pulse = false; // flag para controle da animação

  constructor(
    private router: Router,
    private socketService: SocketService,
    private alertController: AlertController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.roomId = navigation.extras.state['roomId'];
      this.username = navigation.extras.state['username'];
      this.participants = navigation.extras.state['initialParticipants'] || [];
      const currentUserData = this.participants.find(p => p.author === this.username);
      if (currentUserData) {
        this.pizzaSlices = currentUserData.pizza;
      }
    }
  }

  ngOnInit() {
    if (!this.roomId || !this.username) {
      this.navCtrl.navigateRoot('/home');
      return;
    }

    this.subscriptions.add(this.socketService.onReceivedMessage().subscribe((message: Participant) => {
      if (message.roomId === this.roomId) {
        this.updateParticipantList(message);
        if (message.author === this.username) {
          this.pizzaSlices = message.pizza;
        }
      }
    }));

    this.subscriptions.add(this.socketService.onYouAreHost().subscribe((data) => {
      this.isHost = data.isHost;
      this.updateHostSelectAndButtons();
    }));

    this.subscriptions.add(this.socketService.onHostTransferred().subscribe(async (data) => {
      await this.presentAlert('Host Transferido!', `O novo host da sessão é: ${data.newHost}!`);
    }));

    this.subscriptions.add(this.socketService.onUserLeft().subscribe((data) => {
      if (data.roomId === this.roomId) {
        this.removeParticipantFromList(data.author);
        this.updateHostSelectAndButtons();
      }
    }));

    this.subscriptions.add(this.socketService.onError().subscribe(async (message) => {
      await this.presentAlert('Erro', message);
    }));

    if (
      this.socketService.currentRoomId !== this.roomId ||
      this.socketService.currentUsername !== this.username
    ) {
      this.socketService.joinRoom(this.roomId, this.username);
    }

    this.updateHostSelectAndButtons();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  updateParticipantList(newMessage: Participant) {
    const index = this.participants.findIndex(p => p.author === newMessage.author);
    if (index > -1) {
      this.participants[index] = { ...newMessage };
    } else {
      this.participants.push({ ...newMessage });
    }

    if (newMessage.author === this.username) {
      this.pizzaSlices = newMessage.pizza;
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
  }

  addSlice() {
    /*setTimeout(() => {
      this.pizzaSlices++;
      this.socketService.sendMessage(this.username, this.pizzaSlices, this.roomId);
    }, 5000);*/
    this.pizzaSlices++;
    this.socketService.sendMessage(this.username, this.pizzaSlices, this.roomId);

    const me = this.participants.find(p => p.author === this.username);
    if (me) {
      me.pizza = this.pizzaSlices;
    }

    this.triggerPulse();
    this.cdr.detectChanges();
  }

  removeMySlice() {
    if (this.pizzaSlices > 0) {
      this.pizzaSlices--;
      this.socketService.sendMessage(this.username, this.pizzaSlices, this.roomId);

      const me = this.participants.find(p => p.author === this.username);
      if (me) {
        me.pizza = this.pizzaSlices;
      }

      this.triggerPulse();
      this.cdr.detectChanges();
    } else {
      this.presentAlert('Ops!', 'Você não tem fatias para remover.');
    }
  }

  triggerPulse() {
    this.pulse = false;
    setTimeout(() => {
      this.pulse = true;
      this.cdr.detectChanges();
    }, 10);
  }

  hostRemoveSlice() {
    if (!this.isHost) {
      this.presentAlert('Permissão Negada', 'Apenas o host pode remover fatias de outros participantes.');
      return;
    }
    if (!this.selectedParticipantToRemove) {
      this.presentAlert('Erro', 'Selecione um participante para remover a fatia.');
      return;
    }

    this.socketService.removeSliceRequest(this.roomId, this.selectedParticipantToRemove);
    this.selectedParticipantToRemove = '';

  }

  leaveSession() {
    this.alertYesNo('Ops!', 'Tem certeza que deseja sair da sessão');
    setTimeout(() => {
      this.socketService.leaveRoom(this.roomId);
      this.socketService.resetSessionState(this.roomId);
      this.navCtrl.navigateRoot('/home');
    }, 2000);
  }

  getTotalSlices(): number {
    const othersSlices = this.participants
      .filter(p => p.author !== this.username)
      .reduce((sum, p) => sum + p.pizza, 0);
    return othersSlices + this.pizzaSlices;
  }

  getSlicePrice(): number {
    let totalSlices = this.getTotalSlices();
    return totalSlices > 0 ? this.valorTotalPizza / totalSlices : 0;
  }


  getFormattedTotal(): string {
    let total = this.getTotalSlices() * 3;
    return total.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  /*getTotalSlices(): number {
    const othersSlices = this.participants
      .filter(p => p.author !== this.username)
      .reduce((sum, p) => sum + p.pizza, 0);
    return othersSlices + this.pizzaSlices;
  }*/




  getMyShare(): number {
    //return this.pizzaSlices * this.getSlicePrice();
    return this.pizzaSlices * 2;
  }

  getFormattedShare(): string {
    const valor = this.getMyShare();
    console.log('Valor a pagar atualizado:', valor);
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  updateHostSelectAndButtons() {
    this.selectedParticipantToRemove = '';
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  async alertYesNo(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['SIM', 'NÃO'],
    });
    await alert.present();
  }
}
