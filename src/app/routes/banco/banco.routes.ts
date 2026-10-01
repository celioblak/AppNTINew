import { Routes } from '@angular/router';
import { SessoesComponent } from './sessoes/sessoes';
import { ScriptComponent } from './script/script';
import { ScriptAgendamentoComponent } from './script/agendamento/script-agendamento';
import { UltimasExecucoesComponent } from './script/agendamento/ultimas-execucoes';

export const routes: Routes = [
  { path: 'sessoes', component: SessoesComponent },
  { path: 'script', component: ScriptComponent },
  { path: 'script-agendamento',component: ScriptAgendamentoComponent },
  { path: 'script-agendamento/ultimas-execucoes', component: UltimasExecucoesComponent }
  ];
