import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Platform } from '@ionic/angular';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})

export class AppComponent {
  constructor(private platform: Platform) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.hideStatusBar();
    });
  }

  async hideStatusBar() {
    try {
      await StatusBar.hide(); // Esconde a StatusBar
    } catch (err) {
      console.error('Erro ao esconder a StatusBar:', err);
    }
  }
}