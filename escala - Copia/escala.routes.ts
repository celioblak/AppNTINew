import { Routes } from '@angular/router';
import { EscalaComponent } from './escala.component';
import { PreferenciaFolgaComponent } from './preferencia-folga/preferencia-folga.component';

export const routes: Routes = [
  { path: 'ger-escala', component: EscalaComponent },
  { path: 'escala-preferencia', component: PreferenciaFolgaComponent }
];
