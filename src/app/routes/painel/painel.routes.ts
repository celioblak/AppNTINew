import { Routes } from '@angular/router';

import { PainelIncidenteClassico } from './classico/painel-incidente-classico';
import { PainelRequisicaoClassico } from './classico/painel-requisicao-classico';
import { PainelEscolha } from './painel-escolha';
import { PainelIncidente } from './painel-incidente';
import { PainelLayout } from './painel-layout';
import { PainelRequisicao } from './painel-requisicao';

/**
 * Rotas do painel de TV. Nenhuma tem guard: a tela fica ligada numa TV sem login,
 * e os endpoints /api/painel são liberados no backend (SecurityConfiguration).
 *
 * As rotas /classico/* mantêm o visual anterior no ar enquanto a equipe se
 * acostuma com o novo — apague-as junto com a pasta classico/ quando o novo for
 * aceito (ver README.md).
 */
export const routes: Routes = [
  {
    path: '',
    component: PainelLayout,
    children: [
      { path: '', component: PainelEscolha, data: { titulo: 'Painel NTI' } },
      { path: 'incidente', component: PainelIncidente, data: { titulo: 'Incidentes' } },
      { path: 'requisicao', component: PainelRequisicao, data: { titulo: 'Requisições' } },

      {
        path: 'classico/incidente',
        component: PainelIncidenteClassico,
        data: { titulo: 'Incidentes', visual: 'classico' },
      },
      {
        path: 'classico/requisicao',
        component: PainelRequisicaoClassico,
        data: { titulo: 'Requisições', visual: 'classico' },
      },

      { path: '**', redirectTo: '' },
    ],
  },
];
