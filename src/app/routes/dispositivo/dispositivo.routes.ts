import { Routes } from '@angular/router';
import { ComandosSshComponent } from './comandos-ssh/comandos-ssh';
import { GrupoServidorComponent } from './grupo-servidor/grupo-servidor';
import { BalanceadoresSistemasComponent } from './mapa-servicos/balanceadores-sistemas';
import { MapaServicosComponent } from './mapa-servicos/mapa-servicos';
import { ServidorComponent } from './servidor/servidor.component';
import { TerminalSshComponent } from './terminal-ssh/terminal-ssh';
import { VncViewComponent } from './vnc-view/vnc-view.component';

export const routes: Routes = [
  { path: 'servidor', component: ServidorComponent },
  { path: 'grupo-servidor', component: GrupoServidorComponent },
  { path: 'terminal-ssh', component: TerminalSshComponent },
  { path: 'comandos-ssh', component: ComandosSshComponent },
  { path: 'viewvnc', component: VncViewComponent },
  { path: 'mapa-servicos', component: MapaServicosComponent },
  { path: 'balanceadores-sistemas', component: BalanceadoresSistemasComponent },
  ];
