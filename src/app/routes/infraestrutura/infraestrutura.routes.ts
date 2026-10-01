import { Routes } from '@angular/router';

import { AmbientesComponent } from './ambientes/ambientes';
import { ServidoresServicosComponent } from './servidores-servicos/servidores-servicos';
import { SistemasServicosComponent } from './sistemas-servicos/sistemas-servicos';

/** Infraestrutura: cadastro único que Atualizações, Mapa e Painel leem. */
export const routes: Routes = [
  { path: 'ambientes', component: AmbientesComponent },
  { path: 'servidores-servicos', component: ServidoresServicosComponent },
  { path: 'sistemas-servicos', component: SistemasServicosComponent },
];
