/** Tipos do controle de atualizações pontuais (ntiapi/docs/controle-atualizacoes.md). Espelham os DTOs do backend. */

export type MetodoArtefato = 'ARQUIVO' | 'DDL_ORACLE' | 'SCRIPT_RETORNO';
export type Ambiente = 'HOMOLOGACAO' | 'PRODUCAO' | 'TREINAMENTO';
export type SituacaoAtualizacao =
  | 'RASCUNHO'
  | 'EM_HOMOLOGACAO'
  | 'AGUARDANDO_CORRECAO'
  | 'VALIDADA'
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADA'
  | 'PARCIAL'
  | 'EM_PRODUCAO'
  | 'CONCLUIDA'
  | 'CANCELADA';
export type SituacaoVersao = 'VIGENTE' | 'REPROVADA' | 'SUBSTITUIDA';
export type MomentoBackup = 'ANTES_HOMOLOGACAO' | 'VALIDACAO_PRODUCAO' | 'RENOVADO_JANELA';
export type SituacaoBackup = 'VALIDO' | 'SUBSTITUIDO';
export type ResultadoAplicacao = 'SUCESSO' | 'FALHA';
export type ResultadoValidacao = 'APROVADA' | 'REPROVADA';
export type TipoEvento =
  | 'CRIADA'
  | 'DADOS_ALTERADOS'
  | 'ARTEFATO_INCLUIDO'
  | 'ARTEFATO_REMOVIDO'
  | 'DESTINO_ALTERADO'
  | 'VERSAO_CORRIGIDA'
  | 'BACKUP_REGISTRADO'
  | 'APLICACAO_REGISTRADA'
  | 'VALIDACAO_APROVADA'
  | 'VALIDACAO_REPROVADA'
  | 'VALIDACAO_CANCELADA'
  | 'BACKUP_PRODUCAO_CONCLUIDO'
  | 'APROVACAO_SOLICITADA'
  | 'APROVADA'
  | 'RECUSADA'
  | 'DIVERGENCIA'
  | 'SITUACAO_ALTERADA'
  | 'CONCLUIDA'
  | 'CANCELADA'
  | 'COMPLEMENTO_CRIADO'
  | 'DOWNLOAD'
  | 'JAR_GERADO'
  | 'EXECUCAO_AUTOMATICA'
  | 'PACOTE_FORA_MAPEAMENTO';
export type TipoChoque = 'MESMA_TELA' | 'MESMO_JAR' | 'JAR_INTEIRO' | 'MESMO_ARTEFATO' | 'APLICADA_DEPOIS';
export type Gravidade = 'CRITICO' | 'ALERTA' | 'INFO';

// ------------------------------------------------------------------ configuração

export interface TipoArtefato {
  codTipoArtefato: number | null;
  nome: string;
  extensoes: string | null;
  metodo: MetodoArtefato;
  verificacao: string | null;
  ativo: boolean;
}

export interface Aplicacao {
  codProcesso: number;
  nmProcesso: string | null;
  dsProcesso: string | null;
  caminho: string | null;
  codServidor: number | null;
  dsServidor: string | null;
  tpSo: string | null;
  tipoProcesso: string | null;
  porta: string | null;
  urlMonitoramento: string | null;
  descricao: string;
}

export interface SistemaProcesso {
  codProcesso: number;
  aplicacao?: string;
  porta?: string | null;
  ordem?: number;
}

export interface SistemaTipo {
  codTipoArtefato: number | null;
  tipo?: string;
  diretorio: string;
  exigeReinicio: boolean;
  comandoReinicio: string | null;
}

/** Sistema instalado em um ambiente: de onde saem os destinos dos artefatos. */
export interface SistemaAmbiente {
  codSistemaAmbiente: number | null;
  codSistema: number | null;
  sistema?: string | null;
  ambiente: Ambiente;
  /** Versão instalada; entra no lugar de <versao> no diretório dos tipos. */
  versao: string | null;
  banco: string | null;
  passoManual: string | null;
  processos: SistemaProcesso[];
  tipos: SistemaTipo[];
}

/** Pasta do pacote do fabricante → JAR (com <versao>) → caminho dentro do JAR. */
export interface MapeamentoJar {
  codMapeamento: number | null;
  codSistema: number | null;
  sistema?: string | null;
  codTipoArtefato: number | null;
  tipo?: string;
  pasta: string;
  jarPadrao: string;
  caminhoInterno: string;
  ativo: boolean;
}

/** Módulo do sistema (ex.: MV Soul › Faturamento SUS); usado em roteiro ou homologação não se exclui, só inativa. */
export interface ModuloSistema {
  codModulo: number | null;
  nome: string;
  ativo: boolean;
  usos: number;
}

export interface SistemaResumo {
  codSistema: number;
  nome: string;
  ativo: boolean;
  /** Trabalha com módulos: nos roteiros de homologação, os agrupamentos pertencem a um módulo. */
  trabalhaModulo: boolean;
  modulos: ModuloSistema[];
}

export interface UsuarioResumo {
  codUsuario: number;
  nome: string;
  login: string;
}

export interface RegrasAtualizacao {
  validadorDiferente: boolean;
  diasObservacao: number;
  toleranciaJanelaMinutos: number;
  tamanhoMaximoMb: number;
  repositorioConfigurado: boolean;
}

export interface Catalogo {
  tipos: TipoArtefato[];
  aplicacoes: Aplicacao[];
  sistemas: SistemaResumo[];
  ambientes: SistemaAmbiente[];
  mapeamentos: MapeamentoJar[];
  usuarios: UsuarioResumo[];
  regras: RegrasAtualizacao;
}

// ------------------------------------------------------------------ atualização

export interface Arquivo {
  codArquivo: number;
  nome: string;
  tamanho: number;
  sha256: string;
  dataEnvio: string;
  nomeEnvio: string | null;
  caminhoRelativo: string | null;
}

export interface Destino {
  tipo: 'PROCESSOS' | 'BANCO' | null;
  descricao: string;
  passoManual: string | null;
}

export interface DestinoRemovido {
  codDestino: number;
  ambiente: Ambiente;
  alvo: string;
  justificativa: string | null;
  nomeUsuario: string | null;
  data: string | null;
}

export interface Entrada {
  caminhoInterno: string;
  sha256: string;
  tamanho: number;
  codArquivo: number;
}

export interface Versao {
  codVersao: number;
  numero: number;
  situacao: SituacaoVersao;
  vigente: boolean;
  arquivo: Arquivo;
  arquivoRetorno: Arquivo | null;
  descricaoCorrecao: string | null;
  descricaoErro: string | null;
  codValidacaoErro: number | null;
  nomeEnvio: string | null;
  dataEnvio: string;
  entradas: Entrada[];
}

export interface Backup {
  codBackup: number;
  momento: MomentoBackup;
  ambiente: Ambiente;
  numeroVersao: number;
  arquivo: Arquivo | null;
  semArquivo: boolean;
  observacao: string | null;
  situacao: SituacaoBackup;
  nomeUsuario: string | null;
  data: string;
}

export interface AplicacaoRegistro {
  codAplicacao: number;
  numeroVersao: number;
  sha256Versao: string;
  resultado: ResultadoAplicacao;
  log: string | null;
  backupConferido: boolean;
  justificativa: string | null;
  evidencia: Arquivo | null;
  arquivoAplicado: Arquivo | null;
  nomeUsuario: string | null;
  data: string;
  ip: string | null;
}

/** JAR montado pelo sistema para um destino (backup + conteúdo). */
export interface JarGerado {
  codJarGerado: number;
  arquivo: Arquivo;
  codBackup: number;
  /** Gerado a partir do backup que vale hoje; senão precisa gerar de novo. */
  baseAtual: boolean;
  substituidas: number;
  incluidas: number;
  iguais: number;
  assinado: boolean;
  resumo: string | null;
  nomeUsuario: string | null;
  data: string;
}

export interface Alvo {
  codDestino: number;
  chave: string;
  codProcesso: number | null;
  alvo: string;
  ordem: number;
  diretorio: string | null;
  exigeReinicio: boolean | null;
  comandoReinicio: string | null;
  passoManual: string | null;
  urlMonitoramento: string | null;
  backup: Backup | null;
  backupRenovado: Backup | null;
  ultimaAplicacao: AplicacaoRegistro | null;
  aplicacoes: AplicacaoRegistro[];
  backupDivergente: boolean;
  jarGerado: JarGerado | null;
}

export interface ConteudoJar {
  codMapeamento: number;
  pasta: string;
  jarPadrao: string;
  caminhoInterno: string;
}

export interface Artefato {
  codArtefato: number;
  nome: string;
  codTipoArtefato: number;
  tipo: string;
  metodo: MetodoArtefato;
  ordem: number;
  observacao: string | null;
  nomeInclusao: string | null;
  dataInclusao: string;
  destinoHml: Destino;
  destinoPrd: Destino;
  versaoVigente: Versao | null;
  versoes: Versao[];
  homologacao: Alvo[];
  producao: Alvo[];
  removidos: DestinoRemovido[];
  removivel: boolean;
  recalculavel: boolean;
  /** O diretório do cadastro mudou depois da inclusão (ex.: nova versão instalada no caminho). */
  destinoDesatualizado: boolean;
  /** Preenchido quando o artefato é conteúdo para dentro de um JAR. */
  conteudoJar: ConteudoJar | null;
  /** A versão vigente traz arquivos para dentro do JAR (o sistema monta). Falso quando veio o JAR pronto. */
  montaJar: boolean;
}

export interface ValidacaoVersao {
  codVersao: number;
  artefato: string;
  numeroVersao: number;
  sha256: string;
  erro: boolean;
  descricaoErro: string | null;
}

export interface Validacao {
  codValidacao: number;
  resultado: ResultadoValidacao;
  roteiro: string;
  observacao: string | null;
  evidencia: Arquivo | null;
  nomeUsuario: string | null;
  data: string;
  cancelada: boolean;
  motivoCancelamento: string | null;
  dataCancelamento: string | null;
  backupProducaoConcluido: boolean;
  dataBackupProducaoConcluido: string | null;
  ativa: boolean;
  versoes: ValidacaoVersao[];
}

export interface Evento {
  codEvento: number;
  tipo: TipoEvento;
  descricao: string;
  nomeUsuario: string | null;
  data: string;
  ip: string | null;
}

export interface Acoes {
  editar: boolean;
  incluirArtefato: boolean;
  alterarArtefato: boolean;
  registrarHomologacao: boolean;
  validar: boolean;
  registrarBackupProducao: boolean;
  solicitarAprovacao: boolean;
  aprovar: boolean;
  registrarProducao: boolean;
  concluir: boolean;
  cancelar: boolean;
  criarComplemento: boolean;
}

export interface Referencia {
  codAtualizacao: number;
  numero: string;
  titulo: string;
  situacao: SituacaoAtualizacao;
  janela: string | null;
}

/** Choque com outra atualização aberta do mesmo sistema. */
export interface Choque {
  tipo: TipoChoque;
  gravidade: Gravidade;
  codAtualizacao: number;
  numero: string;
  titulo: string;
  situacao: SituacaoAtualizacao;
  responsavel: string | null;
  artefato: string | null;
  artefatoOutro: string | null;
  telas: string[];
  mensagem: string;
}

export interface AtualizacaoDetalhe {
  codAtualizacao: number;
  numero: string;
  titulo: string;
  codSistema: number | null;
  sistema: string | null;
  versaoFabricante: string | null;
  motivo: string | null;
  ticketMv: string | null;
  tituloTicketMv: string | null;
  chamadoGlpi: number | null;
  situacao: SituacaoAtualizacao;
  emergencial: boolean;
  justificativaEmergencial: string | null;
  /** Onde esta atualização é homologada: HOMOLOGACAO (SML) ou TREINAMENTO (TRN). */
  ambienteHomologacao: Ambiente;
  origem: Referencia | null;
  complementos: Referencia[];
  codResponsavel: number | null;
  nomeResponsavel: string | null;
  janela: string | null;
  nomeAprovador: string | null;
  dataAprovacao: string | null;
  comentarioAprovacao: string | null;
  nomeCadastro: string | null;
  dataCadastro: string;
  dataUltimaAlteracao: string;
  dataProducao: string | null;
  dataConclusao: string | null;
  homologacaoCompleta: boolean;
  homologada: boolean;
  backupProducaoCompleto: boolean;
  pendencias: string[];
  conflitos: Referencia[];
  choques: Choque[];
  artefatos: Artefato[];
  validacoes: Validacao[];
  eventos: Evento[];
  acoes: Acoes;
}

export interface AtualizacaoResumo {
  codAtualizacao: number;
  numero: string;
  titulo: string;
  codSistema: number | null;
  sistema: string | null;
  ticketMv: string | null;
  situacao: SituacaoAtualizacao;
  emergencial: boolean;
  ambienteAtual: string | null;
  qtdArtefatos: number;
  qtdVersoesCorrigidas: number;
  janela: string | null;
  codResponsavel: number | null;
  nomeResponsavel: string | null;
  dataCadastro: string;
  dataUltimaAlteracao: string;
  proximoPasso: string | null;
  homologacaoCompleta: boolean;
  backupProducaoPendente: boolean;
  homologada: boolean;
  qtdChoques: number;
}

export interface PainelResumo {
  aguardandoValidacao: number;
  aguardandoCorrecao: number;
  backupProducaoPendente: number;
  aguardandoAprovacao: number;
  producaoNaSemana: number;
  emergenciaisSemHomologacao: number;
  parciais: number;
  comChoques: number;
}

export interface Painel {
  resumo: PainelResumo;
  atualizacoes: AtualizacaoResumo[];
}

export interface HistoricoItem {
  tipo: 'APLICACAO' | 'BACKUP';
  data: string;
  codAtualizacao: number;
  numero: string;
  titulo: string;
  motivo: string | null;
  ticketMv: string | null;
  artefato: string;
  numeroVersao: number;
  sha256: string | null;
  ambiente: Ambiente;
  detalhe: string;
  nomeUsuario: string | null;
  arquivo: Arquivo | null;
  alvo: string;
}

export interface GrupoCelula {
  aplicacao: string;
  numero: string | null;
  numeroVersao: number | null;
  sha256: string | null;
  data: string | null;
}

export interface GrupoLinha {
  artefato: string;
  celulas: GrupoCelula[];
  divergente: boolean;
}

export interface Historico {
  destino: string;
  itens: HistoricoItem[];
  comparacao: { aplicacoes: string[]; linhas: GrupoLinha[] } | null;
}

/** Arquivo de um pacote (zip ou pasta) e, se reconhecido, o caminho dentro do JAR. */
export interface ArquivoPacote {
  codArquivo: number;
  nome: string;
  caminhoRelativo: string;
  caminhoInterno: string | null;
  tamanho: number;
  sha256: string;
  /** Como o destino foi identificado (ou por que não foi), quando não veio da pasta cadastrada. */
  motivo: string | null;
}

export interface PacoteGrupo {
  codMapeamento: number;
  codTipoArtefato: number;
  tipo: string;
  pasta: string;
  jarPadrao: string;
  caminhoInterno: string;
  nomeSugerido: string;
  arquivos: ArquivoPacote[];
  choques: Choque[];
  artefatoExistente: string | null;
  /** Veio o JAR pronto (não os arquivos soltos): entra como artefato de arquivo inteiro. */
  jarInteiro: boolean;
  /**
   * Como o destino foi identificado: PASTA (pasta cadastrada) e CLASSE (pacote do bytecode) são certezas;
   * JAR (o caminho existe no JAR do ambiente) é prova prática; HISTORICO é dedução. Fora de PASTA, pede confirmação.
   */
  origem: 'PASTA' | 'CLASSE' | 'JAR' | 'HISTORICO';
  explicacaoOrigem: string | null;
}

export interface PacoteAnalise {
  grupos: PacoteGrupo[];
  naoReconhecidos: ArquivoPacote[];
}

/** Resultado da montagem do JAR. precisaConfirmar: nada foi gravado, há caminhos que não existem no JAR atual. */
export interface GerarJarResultado {
  gerado: boolean;
  precisaConfirmar: boolean;
  substituidas: number;
  incluidas: number;
  iguais: number;
  assinado: boolean;
  caminhosIncluidos: string[];
  /** Arquivos que existem no JAR em outro caminho: dá para ajustar o caminho gravado e gerar. */
  correcoes: { de: string; para: string }[];
  mensagem: string | null;
  detalhe: AtualizacaoDetalhe;
}

/** Uma linha do relatório de uma operação em lote (backups por nome, JARs de todos os destinos). */
export interface LoteItem {
  arquivo: string | null;
  artefato: string | null;
  destinos: string[];
  mensagem: string;
}

export interface LoteResultado {
  aplicados: LoteItem[];
  ignorados: LoteItem[];
  pendentes: string[];
  /** Artefatos que pararam por arquivo no JAR em outro caminho: dá para ajustar todos de uma vez. */
  divergentes: number;
  detalhe: AtualizacaoDetalhe;
}

// ------------------------------------------------------------------ comandos

export interface AtualizacaoDados {
  titulo: string;
  codSistema: number | null;
  versaoFabricante: string | null;
  motivo: string | null;
  ticketMv: string | null;
  chamadoGlpi: number | null;
  codResponsavel: number | null;
  emergencial: boolean;
  justificativaEmergencial: string | null;
  /** Onde será homologada: HOMOLOGACAO (SML) ou TREINAMENTO (TRN). */
  ambienteHomologacao: Ambiente;
}

/** Arquivo inteiro: codTipoArtefato + codArquivo. Conteúdo para JAR: codMapeamentoJar + arquivosConteudo. */
export interface ArtefatoRequest {
  nome: string;
  codTipoArtefato: number | null;
  observacao: string | null;
  codArquivo?: number | null;
  codArquivoRetorno?: number | null;
  codMapeamentoJar?: number | null;
  arquivosConteudo?: number[] | null;
  /** O pacote veio sem a pasta do mapeamento e o técnico confirmou o destino na tela. */
  destinoConfirmado?: boolean;
}

export interface BackupRequest {
  codArtefato: number;
  ambiente: Ambiente;
  chaveAlvo: string;
  codArquivo: number | null;
  semArquivo: boolean;
  observacao: string | null;
  /** Grava o mesmo backup em todos os destinos do ambiente. */
  todosDestinos: boolean;
}

export interface AplicacaoRequest {
  codArtefato: number;
  ambiente: Ambiente;
  chaveAlvo: string;
  /** Nós do cluster em que a aplicação foi feita, na ordem (D-07). */
  chavesAlvos: string[];
  resultado: ResultadoAplicacao;
  log: string | null;
  codArquivoEvidencia: number | null;
  backupConferido: boolean;
  justificativa: string | null;
  cienteAssinatura: boolean;
}

export interface ValidacaoRequest {
  resultado: ResultadoValidacao;
  roteiro: string;
  observacao: string | null;
  codArquivoEvidencia: number | null;
  versoes: { codVersao: number; erro: boolean; descricaoErro: string | null }[];
}

// ------------------------------------------------------------------ rótulos

export type Tom = 'neutro' | 'info' | 'alerta' | 'critico' | 'sucesso';

export const SITUACAO_INFO: Record<SituacaoAtualizacao, { rotulo: string; tom: Tom }> = {
  RASCUNHO: { rotulo: 'Rascunho', tom: 'neutro' },
  EM_HOMOLOGACAO: { rotulo: 'Em homologação', tom: 'info' },
  AGUARDANDO_CORRECAO: { rotulo: 'Aguardando correção', tom: 'alerta' },
  VALIDADA: { rotulo: 'Validada', tom: 'info' },
  AGUARDANDO_APROVACAO: { rotulo: 'Aguardando aprovação', tom: 'alerta' },
  APROVADA: { rotulo: 'Aprovada', tom: 'info' },
  PARCIAL: { rotulo: 'Parcial', tom: 'critico' },
  EM_PRODUCAO: { rotulo: 'Em produção', tom: 'sucesso' },
  CONCLUIDA: { rotulo: 'Concluída', tom: 'sucesso' },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro' },
};

/** Etapas principais do ciclo, na ordem (desvios aparecem só como situação). */
export const ETAPAS: { situacao: SituacaoAtualizacao; rotulo: string }[] = [
  { situacao: 'RASCUNHO', rotulo: 'Rascunho' },
  { situacao: 'EM_HOMOLOGACAO', rotulo: 'Homologação' },
  { situacao: 'VALIDADA', rotulo: 'Validada' },
  { situacao: 'AGUARDANDO_APROVACAO', rotulo: 'Aprovação' },
  { situacao: 'APROVADA', rotulo: 'Aprovada' },
  { situacao: 'EM_PRODUCAO', rotulo: 'Produção' },
  { situacao: 'CONCLUIDA', rotulo: 'Concluída' },
];

export const METODO_ROTULO: Record<MetodoArtefato, string> = {
  ARQUIVO: 'Cópia de arquivo',
  DDL_ORACLE: 'DDL Oracle',
  SCRIPT_RETORNO: 'Script com retorno',
};

export const AMBIENTE_ROTULO: Record<Ambiente, string> = {
  HOMOLOGACAO: 'Homologação',
  PRODUCAO: 'Produção',
  TREINAMENTO: 'Treinamento',
};

export const MOMENTO_ROTULO: Record<MomentoBackup, string> = {
  ANTES_HOMOLOGACAO: 'Antes da homologação',
  VALIDACAO_PRODUCAO: 'Na validação para produção',
  RENOVADO_JANELA: 'Renovado na janela',
};

export const CHOQUE_ROTULO: Record<TipoChoque, string> = {
  MESMA_TELA: 'Mesmas telas',
  MESMO_JAR: 'Mesmo JAR',
  JAR_INTEIRO: 'JAR inteiro × telas',
  MESMO_ARTEFATO: 'Mesmo arquivo',
  APLICADA_DEPOIS: 'Aplicada depois',
};

export const GRAVIDADE_TOM: Record<Gravidade, Tom> = {
  CRITICO: 'critico',
  ALERTA: 'alerta',
  INFO: 'info',
};

export const EVENTO_ROTULO: Record<TipoEvento, string> = {
  CRIADA: 'Criada',
  DADOS_ALTERADOS: 'Dados alterados',
  ARTEFATO_INCLUIDO: 'Artefato incluído',
  ARTEFATO_REMOVIDO: 'Artefato removido',
  DESTINO_ALTERADO: 'Destino alterado',
  VERSAO_CORRIGIDA: 'Versão corrigida',
  BACKUP_REGISTRADO: 'Backup',
  APLICACAO_REGISTRADA: 'Aplicação',
  VALIDACAO_APROVADA: 'Validação aprovada',
  VALIDACAO_REPROVADA: 'Validação reprovada',
  VALIDACAO_CANCELADA: 'Validação cancelada',
  BACKUP_PRODUCAO_CONCLUIDO: 'Backup de produção concluído',
  APROVACAO_SOLICITADA: 'Aprovação solicitada',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  DIVERGENCIA: 'Divergência',
  SITUACAO_ALTERADA: 'Situação',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
  COMPLEMENTO_CRIADO: 'Complemento',
  DOWNLOAD: 'Download',
  JAR_GERADO: 'JAR gerado',
  EXECUCAO_AUTOMATICA: 'Execução automática',
  PACOTE_FORA_MAPEAMENTO: 'Arquivos sem mapeamento de fora',
};

/** Eventos em destaque na linha do tempo (spec T-02). */
export const EVENTOS_DESTAQUE = new Set<TipoEvento>([
  'VALIDACAO_REPROVADA',
  'PACOTE_FORA_MAPEAMENTO',
  'VERSAO_CORRIGIDA',
  'ARTEFATO_INCLUIDO',
  'BACKUP_REGISTRADO',
  'DIVERGENCIA',
  'BACKUP_PRODUCAO_CONCLUIDO',
  'JAR_GERADO',
]);

export function tamanhoLegivel(bytes: number | null | undefined): string {
  if (bytes == null) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function hashCurto(sha: string | null | undefined): string {
  return sha ? sha.substring(0, 12) : '—';
}

/** Minúsculas e sem acentos, para filtros de texto. */
export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** "soul-admpac-forms-<versao>.jar" → "soul-admpac-forms": como se fala do JAR, sem o marcador de versão. */
export function nomeDoJar(jarPadrao: string | null | undefined): string {
  return (jarPadrao ?? '').replace(/[-_.]?<versao>/gi, '').replace(/\.jar$/i, '');
}

/** O nome do JAR precisa casar com o padrão do mapeamento, onde `<versao>` aceita qualquer texto. */
export function jarCombina(nomeArquivo: string, jarPadrao: string): boolean {
  const partes = jarPadrao.split(/<versao>/i).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${partes.join('.+')}$`, 'i').test(nomeArquivo.trim());
}

/** O caminho da aplicação carrega a versão do produto, que muda a cada atualização: `<versao>` vem do cadastro. */
export function usaVersao(diretorio: string | null | undefined): boolean {
  return /<versao>/i.test(diretorio ?? '');
}

export function aplicarVersao(diretorio: string, versao: string | null | undefined): string {
  return versao ? diretorio.replace(/<versao>/gi, versao) : diretorio;
}

/**
 * Destinos que o sistema vai calcular para um tipo (mesma regra do backend), para mostrar antes de incluir.
 * erro: impede incluir (falta o ambiente de homologação). aviso: produção ainda não configurada — só cobrada
 * quando a atualização for para produção.
 */
export function previsaoDestinos(
  catalogo: Catalogo,
  codSistema: number | null,
  codTipo: number | null,
  emergencial: boolean,
  ambienteHomologacao: Ambiente = 'HOMOLOGACAO'
): { texto: string; erro: string | null; aviso: string | null } {
  const tipo = catalogo.tipos.find(t => t.codTipoArtefato === codTipo);
  if (!tipo) {
    return { texto: '', erro: null, aviso: null };
  }
  const partes: string[] = [];
  let erro: string | null = null;
  let aviso: string | null = null;
  // O lado de homologação sai do ambiente escolhido na atualização (SML ou TRN).
  for (const ambiente of [ambienteHomologacao, 'PRODUCAO'] as Ambiente[]) {
    const homologacao = ambiente !== 'PRODUCAO';
    const rotulo = homologacao && ambiente !== 'HOMOLOGACAO' ? `Homologação em ${AMBIENTE_ROTULO[ambiente]}` : AMBIENTE_ROTULO[ambiente];
    const config = catalogo.ambientes.find(a => a.codSistema === codSistema && a.ambiente === ambiente);
    let texto: string | null = null;
    let falta: string | null = null;
    if (!config) {
      falta = `sistema sem configuração de ${rotulo.toLowerCase()}`;
    } else if (tipo.metodo !== 'ARQUIVO') {
      texto = config.banco;
      falta = texto ? null : `sem banco/schema de ${rotulo.toLowerCase()}`;
    } else {
      const configTipo = config.tipos.find(t => t.codTipoArtefato === tipo.codTipoArtefato);
      if (!configTipo) {
        falta = `tipo não configurado em ${rotulo.toLowerCase()}`;
      } else if (!config.processos.length) {
        falta = `sem processos de ${rotulo.toLowerCase()}`;
      } else if (usaVersao(configTipo.diretorio) && !config.versao) {
        falta = `versão instalada de ${rotulo.toLowerCase()} não informada (o diretório usa <versao>)`;
      } else {
        texto = `${config.processos.map(p => p.aplicacao).join(', ')} → ${aplicarVersao(configTipo.diretorio, config.versao)}`;
      }
    }
    if (texto) {
      partes.push(`${rotulo}: ${texto}`);
    } else if (homologacao && emergencial) {
      partes.push(`${rotulo}: —`);
    } else if (homologacao) {
      erro = erro ?? `${tipo.nome}: ${falta} (Configuração › Sistemas por ambiente)`;
    } else {
      // Produção sem cadastro não impede homologar: é cobrada ao solicitar a aprovação.
      aviso = `Produção ainda sem destino (${falta}). Configure antes de enviar para produção e recalcule os destinos.`;
    }
  }
  return { texto: partes.join(' · '), erro, aviso };
}

// ------------------------------------------------------------------ automação por SSH, sem reinício (F-3a)

export type OperacaoAutomatica = 'BACKUP' | 'APLICACAO';
/** AGUARDANDO_REINICIO: arquivos trocados em todos os nós; a aplicação é registrada ao confirmar o reinício (D-15). */
export type SituacaoExecucao = 'EM_ANDAMENTO' | 'AGUARDANDO_REINICIO' | 'CONCLUIDA' | 'FALHA' | 'INTERROMPIDA' | 'RESTAURADA';

export interface NoExecucao {
  chave: string;
  codProcesso: number;
  nome: string;
  diretorio: string;
  exigeReinicio: boolean;
  preparado: boolean;
  trocado: boolean;
}

export interface ExecucaoAutomatica {
  id: string;
  codAtualizacao: number;
  numero: string;
  /** Nulo no backup de todos os artefatos (uma execução para vários). */
  codArtefato: number | null;
  artefato: string;
  ambiente: Ambiente;
  operacao: OperacaoAutomatica;
  situacao: SituacaoExecucao;
  mensagem: string | null;
  usuario: string;
  inicio: string;
  fim: string | null;
  nos: NoExecucao[];
  nomeAntigo: string | null;
  nomeNovo: string | null;
  repositorioServidor: string | null;
  ultimaPulsacao: string | null;
  /** Em andamento, mas sem sinal de vida há mais de 2 min: o servidor da aplicação caiu no meio. */
  abandonada: boolean;
  /** Abandonada ou com o retorno incompleto: os nós podem estar diferentes, e dá para restaurar os backups. */
  restauravel: boolean;
}

/** Linha do console. tipo: FASE, INFO, COMANDO, SAIDA, ERRO, OK, FALHA. */
export interface LinhaConsole {
  seq: number;
  data: string;
  tipo: 'FASE' | 'INFO' | 'COMANDO' | 'SAIDA' | 'ERRO' | 'OK' | 'FALHA';
  no: string | null;
  texto: string;
}

export interface ExecucaoConsole {
  execucao: ExecucaoAutomatica;
  linhas: LinhaConsole[];
}
