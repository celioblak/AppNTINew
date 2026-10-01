import { Routes } from '@angular/router';

import { HomologacaoCadastroComponent } from './cadastro/homologacao-cadastro';
import { HomologacaoDetalheComponent } from './detalhe/homologacao-detalhe';
import { HomologacoesPainelComponent } from './painel/homologacoes-painel';
import { HomologacaoRoteirosComponent } from './roteiros/homologacao-roteiros';

/**
 * Atualizações › Homologações de versão (submenu TB_MENU "homologacao-versao"). O guard libera pela última parte
 * da URL: detalhe e cadastro são rotas ocultas (tipo R) ligadas às telas de participante e de gestão.
 */
export const routes: Routes = [
  { path: 'homologacoes', component: HomologacoesPainelComponent },
  { path: 'homologacoes-gestao', component: HomologacoesPainelComponent, data: { gestao: true } },
  { path: 'homologacoes-detalhe', component: HomologacaoDetalheComponent },
  { path: 'homologacoes-cadastro', component: HomologacaoCadastroComponent },
  { path: 'homologacoes-roteiros', component: HomologacaoRoteirosComponent },
];
