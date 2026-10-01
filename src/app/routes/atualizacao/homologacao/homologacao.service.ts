import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';

import {
  ArquivoHom,
  CancelarRequest,
  CatalogoHom,
  EditarItemRequest,
  HistoricoItem,
  HomologacaoDetalhe,
  HomologacaoRequest,
  ImportacaoRoteiro,
  ItemPadraoRequest,
  ItemRequest,
  PainelHom,
  Participacao,
  RegrasHomologacao,
  ResolucaoDivergencia,
  ResultadoRequest,
  RoteiroPadrao,
  RoteiroResumo,
} from './homologacao.models';

@Injectable({ providedIn: 'root' })
export class HomologacaoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.ApiBaseUrl}homologacao`;

  // ------------------------------------------------------------------ consultas

  painel(dias = 365) {
    return this.http.get<PainelHom>(`${this.api}/painel`, { params: { dias } });
  }

  catalogo() {
    return this.http.get<CatalogoHom>(`${this.api}/catalogo`);
  }

  detalhe(cod: number) {
    return this.http.get<HomologacaoDetalhe>(`${this.api}/${cod}`);
  }

  historico(codItem: number) {
    return this.http.get<HistoricoItem>(`${this.api}/itens/${codItem}/historico`);
  }

  baixar(codArquivo: number) {
    return this.http.get(`${this.api}/arquivos/${codArquivo}/download`, { responseType: 'blob' });
  }

  /** Relatório final em PDF (F-2); em andamento sai parcial. */
  relatorio(cod: number) {
    return this.http.get(`${this.api}/${cod}/relatorio`, { responseType: 'blob' });
  }

  // ------------------------------------------------------------------ cadastro e ciclo de vida

  criar(dados: HomologacaoRequest) {
    return this.http.post<HomologacaoDetalhe>(this.api, dados);
  }

  alterar(cod: number, dados: HomologacaoRequest) {
    return this.http.put<HomologacaoDetalhe>(`${this.api}/${cod}`, dados);
  }

  alterarPrevisao(cod: number, previsaoInicio: string, previsaoFim: string, motivo: string | null) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/previsao`, { previsaoInicio, previsaoFim, motivo });
  }

  alterarParticipantes(cod: number, participacao: Participacao, designados: number[]) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/participantes`, { participacao, designados });
  }

  iniciar(cod: number) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/iniciar`, { instalacaoConfirmada: true });
  }

  cancelar(cod: number, dados: CancelarRequest) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/cancelar`, dados);
  }

  encerrar(cod: number, motivo: string) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/encerrar`, { motivo });
  }

  reabrir(cod: number, motivo: string) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/reabrir`, { motivo });
  }

  observarParecer(codHomologacaoSistema: number, observacao: string | null) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/sistemas/${codHomologacaoSistema}/observacao`, { observacao });
  }

  trazerNovos(codHomologacaoSistema: number) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/sistemas/${codHomologacaoSistema}/trazer-novos`, {});
  }

  // ------------------------------------------------------------------ distribuição

  /** Itens escolhidos, um agrupamento ou um módulo inteiro (D-13). */
  reservar(cod: number, codItens: number[] | null, codAgrupamento: number | null = null, codModulo: number | null = null) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/reservar`, { codItens, codAgrupamento, codModulo });
  }

  liberar(cod: number, codItens: number[] | null, codAgrupamento: number | null = null, codModulo: number | null = null) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/liberar`, { codItens, codAgrupamento, codModulo });
  }

  atribuir(cod: number, codUsuario: number, codItens: number[] | null, codAgrupamento: number | null, codModulo: number | null = null) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/atribuir`, { codUsuario, codItens, codAgrupamento, codModulo });
  }

  removerReservas(
    cod: number,
    dados: { codUsuario: number | null; codItens: number[] | null; codAgrupamento: number | null; somentePendentes: boolean; motivo: string }
  ) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/reservas/remover`, dados);
  }

  optarGeral(cod: number) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/geral`, {});
  }

  desistirGeral(cod: number) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/geral/desistir`, {});
  }

  // ------------------------------------------------------------------ resultados

  registrarResultado(codItem: number, dados: ResultadoRequest) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/itens/${codItem}/resultados`, dados);
  }

  informarTicket(codResultado: number, ticketFabricante: string | null, chamadoGlpi: number | null) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/resultados/${codResultado}/ticket`, { ticketFabricante, chamadoGlpi });
  }

  trocarImpeditivo(codResultado: number, impeditivo: boolean, motivo: string) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/resultados/${codResultado}/impeditivo`, { impeditivo, motivo });
  }

  registrarEntrega(
    cod: number,
    dados: { codHomologacaoSistema: number | null; versao: string; observacao: string | null; retestarReprovados: boolean; retestarBloqueados: boolean }
  ) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/entregas`, dados);
  }

  pedirReteste(codItem: number, motivo: string) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/itens/${codItem}/reteste`, { motivo });
  }

  resolverDivergencia(codDivergencia: number, forma: ResolucaoDivergencia, comentario: string) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/divergencias/${codDivergencia}/resolver`, { forma, comentario });
  }

  incluirItem(cod: number, dados: ItemRequest) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/itens`, dados);
  }

  alterarEscopo(codItem: number, foraEscopo: boolean, motivo: string | null) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/itens/${codItem}/escopo`, { foraEscopo, motivo });
  }

  /** Reorganizar: itens para outro agrupamento do mesmo sistema. */
  moverItens(cod: number, codItens: number[], codAgrupamento: number) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/${cod}/itens/mover`, { codItens, codAgrupamento });
  }

  /** Excluir item incluído na homologação, mesmo com histórico (exclusão lógica quando há resultados). */
  excluirItem(codItem: number, motivo: string) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/itens/${codItem}/excluir`, { motivo });
  }

  excluirAgrupamentoHomologacao(codAgrupamento: number, motivo: string) {
    return this.http.post<HomologacaoDetalhe>(`${this.api}/agrupamentos/${codAgrupamento}/excluir`, { motivo });
  }

  editarItem(codItem: number, dados: EditarItemRequest) {
    return this.http.put<HomologacaoDetalhe>(`${this.api}/itens/${codItem}`, dados);
  }

  editarAgrupamentoHomologacao(codAgrupamento: number, nome: string, tela: string | null, codModulo: number | null) {
    return this.http.put<HomologacaoDetalhe>(`${this.api}/agrupamentos/${codAgrupamento}`, { nome, tela, codModulo });
  }

  /** Evidência pelo corpo bruto, como os arquivos das Atualizações (vídeo passa do limite de multipart). */
  enviarEvidencia(cod: number, arquivo: File) {
    return this.http.post<ArquivoHom>(`${this.api}/${cod}/arquivos`, arquivo, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Nome-Arquivo': encodeURIComponent(arquivo.name),
        'X-Tipo-Arquivo': arquivo.type || 'application/octet-stream',
      },
    });
  }

  // ------------------------------------------------------------------ regras

  regras() {
    return this.http.get<RegrasHomologacao>(`${this.api}/regras`);
  }

  salvarRegras(regras: RegrasHomologacao) {
    return this.http.put<RegrasHomologacao>(`${this.api}/regras`, regras);
  }

  // ------------------------------------------------------------------ roteiros padrão

  roteiros() {
    return this.http.get<RoteiroResumo[]>(`${this.api}/roteiros`);
  }

  roteiro(codRoteiro: number) {
    return this.http.get<RoteiroPadrao>(`${this.api}/roteiros/${codRoteiro}`);
  }

  criarRoteiro(codSistema: number, nome: string, descricao: string | null) {
    return this.http.post<RoteiroPadrao>(`${this.api}/roteiros`, { codSistema, nome, descricao });
  }

  alterarRoteiro(codRoteiro: number, nome: string, descricao: string | null) {
    return this.http.put<RoteiroPadrao>(`${this.api}/roteiros/${codRoteiro}`, { nome, descricao });
  }

  ativarRoteiro(codRoteiro: number, ativo: boolean) {
    return this.http.post<RoteiroPadrao>(`${this.api}/roteiros/${codRoteiro}/ativo`, { ativo });
  }

  excluirRoteiro(codRoteiro: number) {
    return this.http.delete<void>(`${this.api}/roteiros/${codRoteiro}`);
  }

  criarAgrupamento(codRoteiro: number, nome: string, tela: string | null, codModulo: number | null) {
    return this.http.post<RoteiroPadrao>(`${this.api}/roteiros/${codRoteiro}/agrupamentos`, { nome, tela, codModulo });
  }

  /** Classificar agrupamentos do roteiro num módulo, em lote (D-16). */
  classificarAgrupamentos(codRoteiro: number, codAgrupamentos: number[], codModulo: number) {
    return this.http.post<RoteiroPadrao>(`${this.api}/roteiros/${codRoteiro}/agrupamentos/modulo`, { codAgrupamentos, codModulo });
  }

  alterarAgrupamento(codAgrupamento: number, nome: string, tela: string | null, codModulo: number | null) {
    return this.http.put<RoteiroPadrao>(`${this.api}/roteiros/agrupamentos/${codAgrupamento}`, { nome, tela, codModulo });
  }

  ativarAgrupamento(codAgrupamento: number, ativo: boolean) {
    return this.http.post<RoteiroPadrao>(`${this.api}/roteiros/agrupamentos/${codAgrupamento}/ativo`, { ativo });
  }

  excluirAgrupamento(codAgrupamento: number) {
    return this.http.delete<RoteiroPadrao>(`${this.api}/roteiros/agrupamentos/${codAgrupamento}`);
  }

  reordenarAgrupamentos(codRoteiro: number, codigos: number[]) {
    return this.http.post<RoteiroPadrao>(`${this.api}/roteiros/${codRoteiro}/agrupamentos/ordem`, { codigos });
  }

  criarItemPadrao(dados: ItemPadraoRequest) {
    return this.http.post<RoteiroPadrao>(`${this.api}/roteiros/itens`, dados);
  }

  alterarItemPadrao(codRoteiroItem: number, dados: ItemPadraoRequest) {
    return this.http.put<RoteiroPadrao>(`${this.api}/roteiros/itens/${codRoteiroItem}`, dados);
  }

  ativarItemPadrao(codRoteiroItem: number, ativo: boolean) {
    return this.http.post<RoteiroPadrao>(`${this.api}/roteiros/itens/${codRoteiroItem}/ativo`, { ativo });
  }

  excluirItemPadrao(codRoteiroItem: number) {
    return this.http.delete<RoteiroPadrao>(`${this.api}/roteiros/itens/${codRoteiroItem}`);
  }

  reordenarItensPadrao(codAgrupamento: number, codigos: number[]) {
    return this.http.post<RoteiroPadrao>(`${this.api}/roteiros/agrupamentos/${codAgrupamento}/itens/ordem`, { codigos });
  }

  /** Importa planilha (.xlsx ou .csv com ;) no roteiro; com simular=true só conta o que entraria. */
  importarRoteiro(codRoteiro: number, arquivo: File, simular: boolean) {
    return this.http.post<ImportacaoRoteiro>(`${this.api}/roteiros/${codRoteiro}/importar`, arquivo, {
      params: { simular },
      headers: { 'Content-Type': 'application/octet-stream', 'X-Nome-Arquivo': encodeURIComponent(arquivo.name) },
    });
  }

  modeloRoteiro() {
    return this.http.get(`${this.api}/roteiros/modelo`, { responseType: 'blob' });
  }

  copiarRoteiro(codRoteiro: number, codRoteiroOrigem: number, codAgrupamentos: number[] | null) {
    return this.http.post<ImportacaoRoteiro>(`${this.api}/roteiros/${codRoteiro}/copiar`, { codRoteiroOrigem, codAgrupamentos });
  }
}
