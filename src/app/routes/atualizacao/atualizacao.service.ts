import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';

import {
  Ambiente,
  ExecucaoAutomatica,
  ExecucaoConsole,
  AplicacaoRequest,
  Arquivo,
  ArtefatoRequest,
  AtualizacaoDados,
  AtualizacaoDetalhe,
  BackupRequest,
  Catalogo,
  GerarJarResultado,
  Historico,
  LoteResultado,
  MapeamentoJar,
  PacoteAnalise,
  Painel,
  RegrasAtualizacao,
  SistemaAmbiente,
  SistemaResumo,
  TipoArtefato,
  ValidacaoRequest,
} from './atualizacao.models';

@Injectable({ providedIn: 'root' })
export class AtualizacaoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.ApiBaseUrl}atualizacao`;

  // ------------------------------------------------------------------ consultas

  painel(dias = 365) {
    return this.http.get<Painel>(`${this.api}/painel`, { params: { dias } });
  }

  catalogo() {
    return this.http.get<Catalogo>(`${this.api}/catalogo`);
  }

  detalhe(codAtualizacao: number) {
    return this.http.get<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}`);
  }

  aprovacoes() {
    return this.http.get<AtualizacaoDetalhe[]>(`${this.api}/aprovacoes`);
  }

  historico(filtro: { codProcesso?: number | null; codSistema?: number | null; ambiente?: Ambiente | null; banco?: string | null }) {
    const params: Record<string, string> = {};
    if (filtro.codProcesso) params['codProcesso'] = String(filtro.codProcesso);
    if (filtro.codSistema) params['codSistema'] = String(filtro.codSistema);
    if (filtro.ambiente) params['ambiente'] = filtro.ambiente;
    if (filtro.banco) params['banco'] = filtro.banco;
    return this.http.get<Historico>(`${this.api}/historico`, { params });
  }

  baixar(codArquivo: number) {
    return this.http.get(`${this.api}/arquivos/${codArquivo}/download`, { responseType: 'blob', observe: 'response' });
  }

  /** Zip com os JARs gerados do ambiente que falta aplicar (cada JAR uma vez só) e um LEIA-ME com os destinos. */
  // ------------------------------------------------------------------ automação por SSH, sem reinício (F-3a)

  execucoes(codAtualizacao: number) {
    return this.http.get<ExecucaoAutomatica[]>(`${this.api}/${codAtualizacao}/automacao`);
  }

  backupAutomatico(codAtualizacao: number, codArtefato: number) {
    return this.http.post<ExecucaoAutomatica>(`${this.api}/${codAtualizacao}/automacao/artefatos/${codArtefato}/backup`, {});
  }

  /** Backup automático de todos os artefatos (arquivos) sem backup, numa execução só. */
  backupAutomaticoDeTodos(codAtualizacao: number) {
    return this.http.post<ExecucaoAutomatica>(`${this.api}/${codAtualizacao}/automacao/backup-todos`, {});
  }

  aplicacaoAutomatica(codAtualizacao: number, codArtefato: number) {
    return this.http.post<ExecucaoAutomatica>(`${this.api}/${codAtualizacao}/automacao/artefatos/${codArtefato}/aplicacao`, {});
  }

  /** Situação da execução e as linhas do console depois de "desde". */
  console(codAtualizacao: number, id: string, desde: number) {
    return this.http.get<ExecucaoConsole>(`${this.api}/${codAtualizacao}/automacao/${id}`, { params: { desde } });
  }

  interromperExecucao(codAtualizacao: number, id: string) {
    return this.http.post<ExecucaoAutomatica>(`${this.api}/${codAtualizacao}/automacao/${id}/interromper`, {});
  }

  /** Execução que parou no meio (ou com retorno incompleto): devolve os nós ao backup, conferindo o hash de cada um. */
  restaurarExecucao(codAtualizacao: number, id: string) {
    return this.http.post<ExecucaoAutomatica>(`${this.api}/${codAtualizacao}/automacao/${id}/restaurar`, {});
  }

  confirmarReinicio(codAtualizacao: number, id: string) {
    return this.http.post<ExecucaoAutomatica>(`${this.api}/${codAtualizacao}/automacao/${id}/reinicio-confirmado`, {});
  }

  baixarJars(codAtualizacao: number, ambiente: Ambiente) {
    return this.http.get(`${this.api}/${codAtualizacao}/jars/zip`, {
      params: { ambiente },
      responseType: 'blob',
      observe: 'response',
    });
  }

  // ------------------------------------------------------------------ atualização

  criar(dados: AtualizacaoDados) {
    return this.http.post<AtualizacaoDetalhe>(this.api, dados);
  }

  alterar(codAtualizacao: number, dados: AtualizacaoDados) {
    return this.http.put<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}`, dados);
  }

  cancelar(codAtualizacao: number, motivo: string) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/cancelar`, { motivo });
  }

  criarComplemento(codAtualizacao: number) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/complemento`, {});
  }

  /**
   * Corpo bruto do arquivo, com progresso: arquivos Java passam do limite de multipart.
   * caminhoRelativo: caminho do arquivo dentro da pasta do pacote do fabricante.
   */
  enviarArquivo(codAtualizacao: number, arquivo: File, caminhoRelativo?: string | null) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'X-Nome-Arquivo': encodeURIComponent(arquivo.name),
      'X-Tipo-Arquivo': arquivo.type || 'application/octet-stream',
    };
    if (caminhoRelativo) {
      headers['X-Caminho-Relativo'] = encodeURIComponent(caminhoRelativo);
    }
    return this.http.post<Arquivo>(`${this.api}/${codAtualizacao}/arquivos`, arquivo, {
      headers,
      reportProgress: true,
      observe: 'events',
    });
  }

  extrairZip(codAtualizacao: number, codArquivo: number) {
    return this.http.post<Arquivo[]>(`${this.api}/${codAtualizacao}/arquivos/${codArquivo}/extrair`, {});
  }

  analisarPacote(codAtualizacao: number, codArquivos: number[]) {
    return this.http.post<PacoteAnalise>(`${this.api}/${codAtualizacao}/pacote/analisar`, { codArquivos });
  }

  /** Vários artefatos de uma vez: o backend grava todos ou nenhum. */
  /** Registra na linha do tempo os arquivos do pacote sem mapeamento que ficaram de fora (decisão de continuar). */
  registrarForaDoMapeamento(codAtualizacao: number, pastas: string[], arquivos: number) {
    return this.http.post<void>(`${this.api}/${codAtualizacao}/pacote/fora-de-mapeamento`, { pastas, arquivos });
  }

  incluirArtefatos(codAtualizacao: number, dados: ArtefatoRequest[]) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/artefatos/lote`, dados);
  }

  alterarArtefato(codArtefato: number, dados: ArtefatoRequest) {
    return this.http.put<AtualizacaoDetalhe>(`${this.api}/artefatos/${codArtefato}`, dados);
  }

  removerArtefato(codArtefato: number) {
    return this.http.delete<AtualizacaoDetalhe>(`${this.api}/artefatos/${codArtefato}`);
  }

  enviarVersaoCorrigida(
    codArtefato: number,
    dados: {
      codArquivo: number | null;
      codArquivoRetorno: number | null;
      descricaoCorrecao: string;
      arquivosConteudo?: number[] | null;
      manterBackups: boolean;
      destinoConfirmado?: boolean;
    }
  ) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/artefatos/${codArtefato}/versoes`, dados);
  }

  recalcularDestinos(codArtefato: number) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/artefatos/${codArtefato}/destinos/recalcular`, {});
  }

  removerDestino(codDestino: number, motivo: string) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/destinos/${codDestino}/remover`, { motivo });
  }

  gerarJar(codAtualizacao: number, dados: { codArtefato: number; ambiente: Ambiente; chaveAlvo: string; cienteInclusoes?: boolean; corrigirCaminhos?: boolean }) {
    return this.http.post<GerarJarResultado>(`${this.api}/${codAtualizacao}/jars`, dados);
  }

  /** Monta o JAR de todos os destinos pendentes do ambiente. */
  /** corrigirCaminhos: ajusta antes, em todos os artefatos, os arquivos que estão no JAR em outro caminho. */
  gerarJars(codAtualizacao: number, ambiente: Ambiente, corrigirCaminhos = false) {
    return this.http.post<LoteResultado>(`${this.api}/${codAtualizacao}/jars/lote`, { ambiente, corrigirCaminhos });
  }

  /** Vários JARs de backup de uma vez: o backend descobre o artefato de cada um pelo nome. */
  registrarBackupsEmLote(codAtualizacao: number, ambiente: Ambiente, codArquivos: number[]) {
    return this.http.post<LoteResultado>(`${this.api}/${codAtualizacao}/backups/lote`, { ambiente, codArquivos });
  }

  registrarBackup(codAtualizacao: number, dados: BackupRequest) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/backups`, dados);
  }

  registrarAplicacao(codAtualizacao: number, dados: AplicacaoRequest) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/aplicacoes`, dados);
  }

  registrarValidacao(codAtualizacao: number, dados: ValidacaoRequest) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/validacoes`, dados);
  }

  solicitarAprovacao(codAtualizacao: number, janela: string, comentario: string | null) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/solicitar-aprovacao`, { janela, comentario });
  }

  aprovar(codAtualizacao: number, janela: string | null, comentario: string | null) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/aprovar`, { janela, comentario });
  }

  recusar(codAtualizacao: number, comentario: string) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/recusar`, { janela: null, comentario });
  }

  concluir(codAtualizacao: number) {
    return this.http.post<AtualizacaoDetalhe>(`${this.api}/${codAtualizacao}/concluir`, {});
  }

  // ------------------------------------------------------------------ configuração

  /** Regras do processo que valem para todas as atualizações (ficam no banco, sem republicar). */
  salvarRegras(dados: { validadorDiferente: boolean; diasObservacao: number; toleranciaJanelaMinutos: number }) {
    return this.http.put<RegrasAtualizacao>(`${this.api}/config/regras`, dados);
  }

  salvarTipo(tipo: TipoArtefato) {
    return tipo.codTipoArtefato
      ? this.http.put<TipoArtefato>(`${this.api}/config/tipos/${tipo.codTipoArtefato}`, tipo)
      : this.http.post<TipoArtefato>(`${this.api}/config/tipos`, tipo);
  }

  excluirTipo(codTipo: number) {
    return this.http.delete<void>(`${this.api}/config/tipos/${codTipo}`);
  }

  /** Cadastro do sistema e módulos: mantido em Infraestrutura › Sistemas e Serviços (docs/infraestrutura.md, R-20). */
  salvarSistema(sistema: {
    codSistema: number | null;
    nome: string;
    ativo: boolean;
    trabalhaModulo: boolean;
    modulos: { codModulo: number | null; nome: string; ativo: boolean }[];
  }) {
    return sistema.codSistema
      ? this.http.put<SistemaResumo>(`${environment.ApiBaseUrl}infraestrutura/sistemas/${sistema.codSistema}`, sistema)
      : this.http.post<SistemaResumo>(`${environment.ApiBaseUrl}infraestrutura/sistemas`, sistema);
  }

  excluirSistema(codSistema: number) {
    return this.http.delete<void>(`${environment.ApiBaseUrl}infraestrutura/sistemas/${codSistema}`);
  }

  salvarAmbiente(config: SistemaAmbiente) {
    return this.http.put<SistemaAmbiente>(`${this.api}/config/sistemas/${config.codSistema}/ambientes/${config.ambiente}`, config);
  }


  salvarMapeamento(mapeamento: MapeamentoJar) {
    return mapeamento.codMapeamento
      ? this.http.put<MapeamentoJar>(`${this.api}/config/mapeamentos/${mapeamento.codMapeamento}`, mapeamento)
      : this.http.post<MapeamentoJar>(`${this.api}/config/mapeamentos`, mapeamento);
  }

  excluirMapeamento(codMapeamento: number) {
    return this.http.delete<void>(`${this.api}/config/mapeamentos/${codMapeamento}`);
  }
}

/** Salva o blob do download com o nome do Content-Disposition. */
export function salvarDownload(resposta: HttpResponse<Blob>, nomePadrao: string) {
  const disposicao = resposta.headers.get('Content-Disposition') ?? '';
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposicao);
  const simples = /filename="?([^";]+)"?/i.exec(disposicao);
  const nome = utf8 ? decodeURIComponent(utf8[1]) : simples ? simples[1] : nomePadrao;
  const url = URL.createObjectURL(resposta.body!);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
