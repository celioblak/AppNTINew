import { Routes } from '@angular/router';
import { CriarSprintComponent } from './sprint/criar/criarSprint';
import { SlaCriticoComponent } from './sla/sla-critico';
import { ClassificacaoTicketComponent } from './classificacao/classificacao-ticket';
import { DashboardPrincipalComponent } from './sprint/dashboard/dashboard-principal';
import { SlaConfigComponent } from './sla/sla-config';
import { EditarSprintComponent } from './sprint/editar/editarSprint';
import { GerenciamentoSprint } from './sprint/gerenciar/sprint-management';
import { SugestaoTicketSprintComponent } from './sprint/sugestao/sugestao-ticket-sprint.component';



export const routes: Routes = [
  //{ path: 'sprint/sprint-dashboard', component: SprintDashboardComponent },
  { path: 'sprint/sprint-dashboard', component: DashboardPrincipalComponent },
  { path: 'sprint/sprint-criar', component: CriarSprintComponent },
  { path: 'sprint/sprint-editar', component: EditarSprintComponent },
  { path: 'sprint/sprint-gerenciar', component: GerenciamentoSprint },
  { path: 'sprint/sugestao-sprint', component: SugestaoTicketSprintComponent },
  { path: 'sla-critico', component: SlaCriticoComponent },
  { path: 'classificacao', component: ClassificacaoTicketComponent },
  { path: 'sla', component: SlaConfigComponent },
  { path: '', redirectTo: '/dashboard-principal', pathMatch: 'full' }
  ];
