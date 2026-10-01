import { Routes } from '@angular/router';
import { EscalaComponent } from './escala.component';
import { PreferenciaFolgaComponent } from './preferencia-folga/preferencia-folga.component';
import { FeriasComponent } from './ferias/ferias';
import { FeriadoComponent } from './feriado/feriado';
import { PagamentoPlantaoComponent } from './pagamento/pagamento-plantao';

export const routes: Routes = [
  { path: 'escala', component: EscalaComponent },
  { path: 'escala-preferencia', component: PreferenciaFolgaComponent },
  { path: 'ferias', component: FeriasComponent },
  { path: 'feriado', component: FeriadoComponent },
  { path: 'pagamento-plantao', component: PagamentoPlantaoComponent }
];
