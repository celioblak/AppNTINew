import { Routes } from '@angular/router';
import { NotaFiscalComponent } from './nota-fiscal.component';
import { ContratoComponent } from '../contrato/contrato.component';

export const routes: Routes = [
  { path: 'nota', component: NotaFiscalComponent },
  { path: 'contrato', component: ContratoComponent },
];

