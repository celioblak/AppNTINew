import { Routes } from '@angular/router';

import { AtualizacoesAprovacaoComponent } from './aprovacao/atualizacoes-aprovacao';
import { AtualizacoesConfigComponent } from './config/atualizacoes-config';
import { AtualizacaoDetalheComponent } from './detalhe/atualizacao-detalhe';
import { AtualizacoesHistoricoComponent } from './historico/atualizacoes-historico';
import { AtualizacoesPainelComponent } from './painel/atualizacoes-painel';

/**
 * Atualizações pontuais (TB_MENU rota "atualizacao"). O guard libera pela última parte da URL,
 * por isso o detalhe é uma rota própria ("atualizacoes-detalhe", rota oculta) com ?id=.
 */
export const routes: Routes = [
  { path: 'atualizacoes', component: AtualizacoesPainelComponent },
  { path: 'atualizacoes-detalhe', component: AtualizacaoDetalheComponent },
  { path: 'atualizacoes-aprovacao', component: AtualizacoesAprovacaoComponent },
  { path: 'atualizacoes-historico', component: AtualizacoesHistoricoComponent },
  { path: 'atualizacoes-config', component: AtualizacoesConfigComponent },
  { path: 'homologacao-versao', loadChildren: () => import('./homologacao/homologacao.routes').then(m => m.routes) },
];
