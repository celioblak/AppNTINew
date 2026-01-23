import { Routes } from '@angular/router';
import { SessoesComponent } from './sessoes/sessoes.component';
import { ScriptComponent } from './script/script.component';

export const routes: Routes = [
  { path: 'sessoes', component: SessoesComponent },
  { path: 'script', component: ScriptComponent },
  ];
