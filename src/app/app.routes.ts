import { Routes } from '@angular/router';
import { authGuard } from '@core';
import { AdminLayout } from '@theme/admin-layout/admin-layout';
import { AuthLayout } from '@theme/auth-layout/auth-layout';
import { Dashboard } from './routes/dashboard/dashboard';
import { Error403 } from './routes/sessions/error-403';
import { Error404 } from './routes/sessions/error-404';
import { Error500 } from './routes/sessions/error-500';
import { Login } from './routes/sessions/login/login';
import { Register } from './routes/sessions/register/register';
import { resourceAuthGuard } from '@core/authentication/resourceAuthGuard';

export const routes: Routes = [
  // Painel de TV: fica numa televisão sem ninguém logado, por isso vem antes de
  // tudo, fora do AdminLayout e sem guard. Os endpoints /api/painel são públicos.
  {
    path: 'painel',
    loadChildren: () => import('./routes/painel/painel.routes').then(m => m.routes),
  },

  {
    path: '',
    component: AdminLayout,
    canActivateChild: [resourceAuthGuard],   // ← só isso aqui já protege tudo abaixo
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },          // ← tire o canActivate daqui
      { path: '403', component: Error403 },
      { path: '404', component: Error404 },
      { path: '500', component: Error500 },

      // tire canActivate de TODOS esses também
      { path: 'design',     loadChildren: () => import('./routes/design/design.routes').then(m => m.routes) },
      { path: 'ger-escala', loadChildren: () => import('./routes/escala/escala.routes').then(m => m.routes) },
      { path: 'material',   loadChildren: () => import('./routes/material/material.routes').then(m => m.routes) },
      { path: 'utilities',  loadChildren: () => import('./routes/utilities/utilities.routes').then(m => m.routes)},
      { path: 'banco',      loadChildren: () => import('./routes/banco/banco.routes').then(m => m.routes),},
      { path: 'dispositivo',loadChildren: () => import('./routes/dispositivo/dispositivo.routes').then(m => m.routes),},
      { path: 'infraestrutura', loadChildren: () => import('./routes/infraestrutura/infraestrutura.routes').then(m => m.routes) },
      { path: 'ticket',     loadChildren: () => import('./routes/ticket/ticket.routes').then(m => m.routes),},
      { path: 'ger-contato',     loadChildren: () => import('./routes/contrato/nota/nota-fiscal.routes').then(m => m.routes),},
      { path: 'usuario',    loadChildren: () => import('./routes/usuario/usuario.routes').then(m => m.routes),},
      { path: 'configuracao',    loadChildren: () => import('./routes/configuracao/configuracao.routes').then(m => m.routes),},
      { path: 'atualizacao',     loadChildren: () => import('./routes/atualizacao/atualizacao.routes').then(m => m.routes),},

    ],
  },

  {
    path: 'auth',
    component: AuthLayout,
    children: [
      { path: 'login',    component: Login },
      { path: 'register', component: Register },
    ],
  },

//Telas que não tem controle de liberação
  {
    path: '',
    component: AdminLayout,
    children: [
     { path: 'profile',    loadChildren: () => import('./routes/profile/profile.routes').then(m => m.routes),},
    ],
  },


  // Mantenha 403/404/500 acessíveis também fora do admin (opcional)
  { path: '403', component: Error403 },
  { path: '404', component: Error404 },
  { path: '500', component: Error500 },

  //{ path: '**', redirectTo: '/403' },   // ou '/auth/login' dependendo do caso
  { path: '**',    component: Login },

];
