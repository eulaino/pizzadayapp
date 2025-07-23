import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router'; // Adicione provideRouter
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone'; // Certifique-se que é do '/standalone'

import { routes } from './app/app.routes'; // Importe suas rotas
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { HttpClientModule } from '@angular/common/http'; // Importe HttpClientModule se for usar chamadas HTTP REST no futuro

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes), // Fornece suas rotas
    importProvidersFrom(HttpClientModule) // Importa HttpClientModule
  ],
});