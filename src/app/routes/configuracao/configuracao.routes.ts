import { Routes } from '@angular/router';
import { GoogleDriveConfigComponent } from './google-drive-config';
import { NotificacoesConfig } from './notificacoes/notificacoes';
import { ParametrosComponent } from './parametros/parametros';
import { VersaoBancoComponent } from './versao-banco/versao-banco';


export const routes: Routes = [
  { path: 'google-driver', component: GoogleDriveConfigComponent },
  { path: 'notificacoes', component: NotificacoesConfig },
  { path: 'parametros', component: ParametrosComponent },
  { path: 'versao-banco', component: VersaoBancoComponent },
  ];
