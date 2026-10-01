import { Routes } from '@angular/router';
import { GoogleDriveConfigComponent } from './google-drive-config';
import { NotificacoesConfig } from './notificacoes/notificacoes';


export const routes: Routes = [
  { path: 'google-driver', component: GoogleDriveConfigComponent },
  { path: 'notificacoes', component: NotificacoesConfig },
  ];
