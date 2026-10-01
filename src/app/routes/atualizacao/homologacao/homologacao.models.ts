// Homologação de versão (ntiapi/docs/homologacao-versao.md). Espelha os DTOs de HomologacaoDTOs.java.
import { Tom } from '../atualizacao.models';

export type SituacaoHomologacao = 'PLANEJADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'ENCERRADA' | 'CANCELADA';
export type Participacao = 'TODOS' | 'DESIGNADOS';
export type MotivoCancelamento = 'PROBLEMA' | 'NOVA_VERSAO';
export type Parecer = 'APROVADA' | 'APROVADA_RESSALVAS' | 'REPROVADA' | 'INCONCLUSIVA';
export type OrigemItem = 'ROTEIRO' | 'INCLUIDO';
export type FormaResponsavel = 'RESERVA' | 'ATRIBUICAO';
export type Resultado = 'APROVADO' | 'REPROVADO' | 'BLOQUEADO' | 'NAO_SE_APLICA' | 'RETESTE';
export type Trilha = 'DISTRIBUICAO' | 'GERAL';
export type ResolucaoDivergencia = 'NOVO_REGISTRO' | 'VALE_DISTRIBUICAO' | 'VALE_GERAL' | 'RETESTE';

// ------------------------------------------------------------------ catálogo e roteiros padrão

export interface UsuarioHom {
  codUsuario: number;
  nome: string;
  login: string;
  temAcesso: boolean;
}

export interface AmbienteHom {
  codigo: string;
  nome: string;
  cor: string | null;
}

export interface VersaoAmbiente {
  codAmbiente: string;
  versao: string | null;
}

export interface RoteiroResumo {
  codRoteiro: number;
  codSistema: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  qtdAgrupamentos: number;
  qtdItens: number;
  usos: number;
}

/** Módulo do sistema (D-11). */
export interface ModuloHom {
  codModulo: number;
  nome: string;
  ativo: boolean;
}

export interface SistemaCatalogo {
  codSistema: number;
  nome: string;
  versoes: VersaoAmbiente[];
  roteiros: RoteiroResumo[];
  trabalhaModulo: boolean;
  modulos: ModuloHom[];
}

export interface RegrasHomologacao {
  participantesIncluemItens: boolean;
}

export interface Permissoes {
  participante: boolean;
  gestao: boolean;
  roteiros: boolean;
  administrador: boolean;
}

export interface CatalogoHom {
  sistemas: SistemaCatalogo[];
  ambientes: AmbienteHom[];
  usuarios: UsuarioHom[];
  regras: RegrasHomologacao;
  permissoes: Permissoes;
}

export interface ItemPadrao {
  codRoteiroItem: number;
  codAgrupamento: number;
  titulo: string;
  passos: string | null;
  resultadoEsperado: string | null;
  critico: boolean;
  ordem: number;
  ativo: boolean;
  usos: number;
  homologacaoOrigem: string | null;
}

export interface AgrupamentoPadrao {
  codAgrupamento: number;
  nome: string;
  ordem: number;
  ativo: boolean;
  usos: number;
  itens: ItemPadrao[];
  /** Tela do sistema testada no agrupamento (ex.: CAD_PAC). */
  tela: string | null;
  /** Módulo (sistema que trabalha com módulos); nulo = "Sem módulo". */
  codModulo: number | null;
}

export interface RoteiroPadrao {
  codRoteiro: number;
  codSistema: number;
  sistema: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  usos: number;
  agrupamentos: AgrupamentoPadrao[];
  trabalhaModulo: boolean;
  modulos: ModuloHom[];
}

/** Resultado de importar planilha ou copiar de outro roteiro; simulado = nada gravado. */
export interface ImportacaoRoteiro {
  simulado: boolean;
  agrupamentosNovos: number;
  itensNovos: number;
  itensRepetidos: number;
  ignoradas: { linha: number; motivo: string }[];
  roteiro: RoteiroPadrao | null;
}

export interface ItemPadraoRequest {
  codAgrupamento: number | null;
  titulo: string;
  passos: string | null;
  resultadoEsperado: string | null;
  critico: boolean;
}

// ------------------------------------------------------------------ painel

export interface Contagem {
  total: number;
  aprovados: number;
  reprovados: number;
  reprovadosImpeditivos: number;
  naoSeAplica: number;
  bloqueados: number;
  reteste: number;
  reservados: number;
  livres: number;
  concluidos: number;
  percentual: number;
  divergencias: number;
  semTicket: number;
}

export interface SistemaResumo {
  codSistema: number;
  nome: string;
  versaoAtual: string | null;
  versaoNova: string | null;
  parecer: Parecer | null;
  parecerPrevisto: Parecer | null;
}

export interface HomologacaoResumo {
  codHomologacao: number;
  numero: string;
  titulo: string;
  situacao: SituacaoHomologacao;
  codAmbiente: string;
  ambiente: string;
  sistemas: SistemaResumo[];
  previsaoInicio: string;
  previsaoFim: string;
  atrasada: boolean;
  abaixoDoRitmo: boolean;
  ritmoEsperado: number;
  contagem: Contagem;
  nomeResponsavel: string;
  participacao: Participacao;
  qtdDesignados: number;
  participo: boolean;
  minhasPendencias: number;
  ticketMv: string | null;
}

export interface PainelHom {
  homologacoes: HomologacaoResumo[];
  resumo: { minhasPendencias: number; emAndamento: number; atrasadasOuAbaixo: number; semTicket: number; divergencias: number };
  permissoes: Permissoes;
}

// ------------------------------------------------------------------ detalhe

export interface SistemaHom {
  codHomologacaoSistema: number;
  codSistema: number;
  nome: string;
  versaoAtual: string | null;
  versaoNova: string | null;
  codRoteiros: number[];
  roteiros: string[];
  parecer: Parecer | null;
  parecerPrevisto: Parecer | null;
  dataConclusao: string | null;
  observacaoParecer: string | null;
  contagem: Contagem;
  falta: string | null;
  novosNoPadrao: number;
  versaoNoAmbiente: string | null;
  trabalhaModulo: boolean;
  /** Módulos com contagem e previsto (informativo, D-14); codModulo nulo = "Sem módulo". */
  modulos: ModuloProgresso[];
  /** Ainda não homologado (sem resultado, entrega nem parecer): pode sair da homologação na edição. */
  removivel: boolean;
}

export interface ModuloProgresso {
  codModulo: number | null;
  nome: string;
  ativo: boolean;
  contagem: Contagem;
  parecerPrevisto: Parecer | null;
}

/**
 * Separa por módulo, na ordem do cadastro (D-13), o que tem codModulo (agrupamentos); o que não casa com nenhum módulo da
 * lista vai para "Sem módulo", no fim. Grupos vazios ficam de fora.
 */
export function porModulo<T extends { codModulo: number | null }>(
  modulos: { codModulo: number | null; nome: string }[],
  lista: T[]
): { codModulo: number | null; nome: string; itens: T[] }[] {
  const conhecidos = new Set(modulos.filter(m => m.codModulo !== null).map(m => m.codModulo));
  const grupos = modulos
    .filter(m => m.codModulo !== null)
    .map(m => ({ codModulo: m.codModulo, nome: m.nome, itens: lista.filter(x => x.codModulo === m.codModulo) }));
  const sem = lista.filter(x => x.codModulo === null || !conhecidos.has(x.codModulo));
  if (sem.length) grupos.push({ codModulo: null, nome: 'Sem módulo', itens: sem });
  return grupos.filter(g => g.itens.length);
}

export interface AgrupamentoHom {
  codAgrupamento: number;
  codHomologacaoSistema: number;
  nome: string;
  ordem: number;
  doPadrao: boolean;
  codRoteiro: number | null;
  codReserva: number | null;
  nomeReserva: string | null;
  contagem: Contagem;
  /** Tela (ex.: CAD_PAC): a do roteiro padrão ou a informada nesta homologação. */
  tela: string | null;
  /** Módulo (sistema que trabalha com módulos): o do padrão ou o informado nesta homologação; nulo = "Sem módulo". */
  codModulo: number | null;
}

export interface ItemHom {
  codItem: number;
  codHomologacaoSistema: number;
  codAgrupamento: number;
  titulo: string;
  passos: string | null;
  resultadoEsperado: string | null;
  critico: boolean;
  ordem: number;
  origem: OrigemItem;
  /** Item do roteiro padrão de onde veio (ou onde também foi gravado); nulo = só nesta. */
  codRoteiroItem: number | null;
  foraEscopo: boolean;
  motivoForaEscopo: string | null;
  codResponsavel: number | null;
  nomeResponsavel: string | null;
  forma: FormaResponsavel | null;
  dataResponsavel: string | null;
  resultado: Resultado | null;
  impeditivo: boolean;
  codResultado: number | null;
  dataResultado: string | null;
  nomeAutor: string | null;
  ticketFabricante: string | null;
  qtdEvidencias: number;
  reprovouAnterior: boolean;
  divergente: boolean;
  meuResultadoGeral: Resultado | null;
  meuImpeditivoGeral: boolean;
  codMeuResultadoGeral: number | null;
  /** Quem registrou o resultado vigente na distribuição. */
  codAutor: number | null;
  /** Quem incluiu o item (edita o item "só nesta"). */
  codUsuarioCadastro: number;
}

export interface ParticipanteHom {
  codUsuario: number;
  nome: string;
  designado: boolean;
  temAcesso: boolean;
  geral: boolean;
  geralDesistiu: boolean;
  sobResponsabilidade: number;
  concluidosResponsabilidade: number;
  reprovados: number;
  bloqueados: number;
  testadosDistribuicao: number;
  testadosGeral: number;
  participacao: number;
  ultimaAtividade: string | null;
  semProgresso: boolean;
}

export interface DivergenciaHom {
  codDivergencia: number;
  codItem: number;
  item: string;
  sistema: string | null;
  codUsuarioGeral: number;
  nomeGeral: string;
  resultadoGeral: Resultado | null;
  impeditivoGeral: boolean;
  codResponsavel: number | null;
  nomeResponsavel: string | null;
  resultadoDistribuicao: Resultado | null;
  impeditivoDistribuicao: boolean;
  dataAbertura: string;
  podeResolver: boolean;
}

export interface EntregaHom {
  codEntrega: number;
  sistema: string;
  versao: string;
  observacao: string | null;
  reprovados: boolean;
  bloqueados: boolean;
  qtdItens: number;
  nomeUsuario: string;
  data: string;
}

export interface EventoHom {
  tipo: string;
  descricao: string;
  codItem: number | null;
  nomeUsuario: string;
  data: string;
}

export interface ArquivoHom {
  codArquivo: number;
  nome: string;
  tamanho: number;
  contentType: string | null;
  dataEnvio: string;
  nomeEnvio: string;
}

export interface FalhaAnterior {
  sistema: string;
  agrupamento: string | null;
  item: string;
  resultado: Resultado;
  impeditivo: boolean;
  observacao: string | null;
  ticketFabricante: string | null;
  nomeAutor: string | null;
  data: string | null;
  evidencias: ArquivoHom[];
}

export interface MinhaSituacao {
  codUsuario: number;
  participa: boolean;
  motivoNaoParticipa: string | null;
  geral: boolean;
  geralDesistiu: boolean;
  gestao: boolean;
  roteiros: boolean;
  podeIncluirSoNesta: boolean;
  /** Administrador ou responsável pela homologação: exclui item e agrupamento incluídos nela, mesmo com histórico. */
  podeExcluir: boolean;
}

export interface HomologacaoDetalhe {
  codHomologacao: number;
  numero: string;
  titulo: string;
  descricao: string | null;
  codAmbiente: string;
  ambiente: string;
  participacao: Participacao;
  participantesIncluemItens: boolean;
  previsaoInicio: string;
  previsaoFim: string;
  dataInicio: string | null;
  dataFim: string | null;
  situacao: SituacaoHomologacao;
  justificativaEncerramento: string | null;
  motivoCancelamento: MotivoCancelamento | null;
  justificativaCancelamento: string | null;
  codSubstitui: number | null;
  numeroSubstitui: string | null;
  codSubstituidaPor: number | null;
  numeroSubstituidaPor: string | null;
  codResponsavel: number;
  nomeResponsavel: string;
  ticketMv: string | null;
  atrasada: boolean;
  ritmoEsperado: number;
  contagem: Contagem;
  sistemas: SistemaHom[];
  agrupamentos: AgrupamentoHom[];
  itens: ItemHom[];
  participantes: ParticipanteHom[];
  divergencias: DivergenciaHom[];
  entregas: EntregaHom[];
  eventos: EventoHom[];
  falhasAnteriores: FalhaAnterior[];
  designados: number[];
  eu: MinhaSituacao;
  /** Último evento da homologação: resposta com revisão menor é mais velha que a tela e é descartada. */
  revisao: number;
}

export interface TrocaImpeditivo {
  antes: boolean;
  depois: boolean;
  motivo: string;
  nomeUsuario: string;
  data: string;
}

export interface ResultadoHom {
  codResultado: number;
  trilha: Trilha;
  codUsuarioTrilha: number | null;
  nomeTrilha: string | null;
  resultado: Resultado;
  impeditivo: boolean;
  observacao: string | null;
  ticketFabricante: string | null;
  chamadoGlpi: number | null;
  codResultadoOrigem: number | null;
  entrega: string | null;
  nomeUsuario: string;
  data: string;
  evidencias: ArquivoHom[];
  trocasImpeditivo: TrocaImpeditivo[];
  vigente: boolean;
  podeInformarTicket: boolean;
  podeTrocarImpeditivo: boolean;
}

export interface HistoricoItem {
  codItem: number;
  titulo: string;
  resultados: ResultadoHom[];
}

// ------------------------------------------------------------------ comandos

export interface SistemaRequest {
  codSistema: number;
  codRoteiros: number[];
  itensForaEscopo: number[];
}

export interface HomologacaoRequest {
  titulo: string;
  descricao: string | null;
  codAmbiente: string;
  previsaoInicio: string;
  previsaoFim: string;
  codResponsavel: number | null;
  ticketMv: string | null;
  participacao: Participacao;
  participantesIncluemItens: boolean;
  sistemas: SistemaRequest[] | null;
  designados: number[] | null;
  confirmarConcorrente: boolean;
}

export interface ResultadoRequest {
  trilha: Trilha;
  resultado: Resultado;
  impeditivo: boolean | null;
  observacao: string | null;
  ticketFabricante: string | null;
  chamadoGlpi: number | null;
  codArquivos: number[];
}

export interface ItemRequest {
  codHomologacaoSistema: number;
  codAgrupamento: number | null;
  novoAgrupamento: string | null;
  titulo: string;
  passos: string | null;
  resultadoEsperado: string | null;
  critico: boolean;
  noPadrao: boolean;
  codRoteiroDestino: number | null;
  novoRoteiro: string | null;
  novoAgrupamentoTela: string | null;
  novoAgrupamentoModulo: number | null;
}

/** Renomear item incluído só nesta homologação. */
export interface EditarItemRequest {
  titulo: string;
  passos: string | null;
  resultadoEsperado: string | null;
}

export interface CancelarRequest {
  motivo: MotivoCancelamento;
  justificativa: string;
  criarSubstituta: boolean;
  previsaoInicio: string | null;
  previsaoFim: string | null;
}

// ------------------------------------------------------------------ rótulos e tons

export const SITUACAO_HOM: Record<SituacaoHomologacao, { rotulo: string; tom: Tom }> = {
  PLANEJADA: { rotulo: 'Planejada', tom: 'neutro' },
  EM_ANDAMENTO: { rotulo: 'Em andamento', tom: 'info' },
  CONCLUIDA: { rotulo: 'Concluída', tom: 'sucesso' },
  ENCERRADA: { rotulo: 'Encerrada antes do fim', tom: 'alerta' },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro' },
};

export const PARECER_INFO: Record<Parecer, { rotulo: string; tom: Tom }> = {
  APROVADA: { rotulo: 'Aprovada', tom: 'sucesso' },
  APROVADA_RESSALVAS: { rotulo: 'Aprovada com ressalvas', tom: 'alerta' },
  REPROVADA: { rotulo: 'Reprovada', tom: 'critico' },
  INCONCLUSIVA: { rotulo: 'Inconclusiva', tom: 'neutro' },
};

export const RESULTADO_INFO: Record<Resultado, { rotulo: string; tom: Tom; icone: string }> = {
  APROVADO: { rotulo: 'Aprovado', tom: 'sucesso', icone: 'check_circle' },
  REPROVADO: { rotulo: 'Reprovado', tom: 'critico', icone: 'cancel' },
  BLOQUEADO: { rotulo: 'Bloqueado', tom: 'alerta', icone: 'block' },
  NAO_SE_APLICA: { rotulo: 'Não se aplica', tom: 'neutro', icone: 'remove_circle_outline' },
  RETESTE: { rotulo: 'Reteste', tom: 'info', icone: 'replay' },
};

/** Situação do item na distribuição, para chip e filtro. */
export type EstadoItem = 'LIVRE' | 'RESERVADO' | Resultado | 'FORA';

export function estadoItem(item: ItemHom): EstadoItem {
  if (item.foraEscopo) return 'FORA';
  if (item.resultado) return item.resultado;
  return item.codResponsavel ? 'RESERVADO' : 'LIVRE';
}

export const ESTADO_ITEM: Record<EstadoItem, { rotulo: string; tom: Tom }> = {
  LIVRE: { rotulo: 'Livre', tom: 'neutro' },
  RESERVADO: { rotulo: 'Reservado', tom: 'info' },
  FORA: { rotulo: 'Fora do escopo', tom: 'neutro' },
  APROVADO: { rotulo: 'Aprovado', tom: 'sucesso' },
  REPROVADO: { rotulo: 'Reprovado', tom: 'critico' },
  BLOQUEADO: { rotulo: 'Bloqueado', tom: 'alerta' },
  NAO_SE_APLICA: { rotulo: 'Não se aplica', tom: 'neutro' },
  RETESTE: { rotulo: 'Reteste', tom: 'info' },
};

export function concluido(resultado: Resultado | null | undefined): boolean {
  return resultado === 'APROVADO' || resultado === 'REPROVADO' || resultado === 'NAO_SE_APLICA';
}

/** "2026-10-12" → "12/10/2026" sem passar por Date (evita fuso). */
export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Rotas do módulo (submenu Atualizações › Homologações de versão). */
export const ROTA_BASE = '/atualizacao/homologacao-versao';
