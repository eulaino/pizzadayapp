import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/auth.page').then(m => m.AuthPage)
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
  {
    path: 'auth',
    loadComponent: () => import('./auth/auth.page').then(m => m.AuthPage)
  },
];