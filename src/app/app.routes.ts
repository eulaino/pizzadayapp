import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'session-room',
    loadComponent: () => import('./session-room/session-room.page').then((m) => m.SessionRoomPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];