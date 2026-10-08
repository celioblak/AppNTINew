export interface Usuario {
  [prop: string]: any;
  codUsuario?: number | string | null;
  nome?: string;
  email?: string;
  foto?: string;
  login?: string;
  roles?: any[];
  permissions?: any[];
  snAdmin?: boolean;
  snAtivo?: boolean;
  isAdmin?: boolean;
  snPlantonista?: boolean;
  isPlantonista?: boolean;
  matricula?:number | null;
}

export interface Sessao {
  id?:string;
  instId?:number;
  instanceName?:string;
  sid?:number;
  serial?:number;
  logon_time?:Date;
  logon_date?:Date;
  status?:string;
  client_info?:string;
  last_status_date?:Date;
  last_status_time?:string;
  username?:string;
  program?:string;
  action?:string;
  terminal?:string;
  usuario_terminal?:string;
  lc_status?:string;
  lc_session?:number;
  lc_inst_id?:number;
  lc_user?:string;
  lc_final_inst_id?:number;
  lc_final_session?:number;
  lc_final_user?:string;
  object?:string;
  sql_address?:string;
  sql_child_number?:string;
  sql_hash_value?:number;
  sql_id?:string;
  sql_trace?:string;
  sn_lc_exclusive?:string;
}

/** Sessão Oracle segurando lock em um objeto (GET /api/sessao/locks). Uma linha por sessão + objeto. */
export interface SessaoLock {
  instId: number;
  sid: number;
  serial: number;
  status: string;
  username: string | null;
  osuser: string | null;
  machine: string | null;
  terminal: string | null;
  program: string | null;
  module: string | null;
  action: string | null;
  logonTime: string | null;
  /** Segundos sem atividade (LAST_CALL_ET). */
  segundosOciosa: number;
  prevSqlId: string | null;
  prevHashValue: number | null;
  bloqueadaPorSid: number | null;
  bloqueadaPorInstId: number | null;
  owner: string;
  objectName: string;
  objectType: string;
  lockedMode: number;
  descricaoLock: string;
  explicacaoLock: string;
  segundosLock: number | null;
  inicioTransacao: string | null;
  registrosUndo: number | null;
  /** Quantas outras sessões aguardam esta sessão agora. */
  qtdSessoesBloqueadas: number;
  maiorEsperaSegundos: number | null;
  gravidade: 'CRITICO' | 'ATENCAO' | 'OK';
  situacao: string;
  mensagem: string;
}

export interface Token {
  [prop: string]: any;
  access_token: string;
  token_type?: string;
  expires_in?: number;
  exp?: number;
  refresh_token?: string;
}

export interface hbserviceInfo {
  ip?: string;
  machine?: string;
  memoria_disponivel?: string;
  memoria_total?: string;
  memoria_usada?:  string;
  os?:  string;
  os_arch?: string;
  os_version?:  string;
  status?: hbserviceStatus;
  uptime?:  number;
  user_dir?:  string;
  user_home?:  string;
  user_name?:  string;
}

export interface Script {
  [prop: string]: any;
  codSql?: number | string | null;
  nome?: string;
  funcao?: string;
  sql?: string;
  dtCadastro?:Date;
  snPrivado?: boolean;
  tipoSql?: 'QUERY' | 'PROCEDURE' | 'FUNCTION';
}

export interface Servidor {
  [prop: string]: any;
  codServidor?: number | string | null;
  dsServidor?: string;
  obsServidor?: string;
  dsIP?: string;
  dsUserAdmin?:string;
  dsMaquina?: string;
  snAtivo?: boolean;
  tpAcessoRemoto?: string;
  usuarioAcessoRemoto?: string;
  senhaAcessoRemoto?: string;
  tpSo?: string;
  snControle?: boolean;
  load?: string;
  /** Núcleos de CPU do servidor (nproc); o load é avaliado dividido por ele. */
  qtCpu?: number;
  tempoAtividade?: string;
  dtStatus?: Date;
  snMonitorado?: boolean;
  grupoServidor?: grupoServidor;
}

export interface grupoServidor {
  codGrupoServidor?: number;
  dsGrupo?: string;
}

/** Grupo de servidores com os servidores que o usam (GET /api/servidor/grupo/resumo). */
export interface GrupoServidorResumo {
  codGrupoServidor: number;
  dsGrupo: string;
  qtdServidores: number;
  /** Nomes dos servidores do grupo, em ordem alfabética. */
  servidores: string[];
}

/** Servidor disponível no terminal SSH (GET /api/ssh/servidores), sem senhas. */
export interface ServidorSsh {
  codServidor: number;
  dsServidor: string;
  dsIP: string | null;
  dsMaquina: string | null;
  tpSo: string | null;
  snAtivo: boolean;
  codGrupoServidor: number | null;
  dsGrupo: string | null;
  /** Login usado na conexão (acesso remoto ou, na falta, o administrativo). */
  usuario: string | null;
  possuiCredencial: boolean;
}

/** Categoria dos comandos do terminal SSH (/api/ssh/categorias). */
export interface ComandoCategoria {
  codCategoria: number;
  dsCategoria: string;
  /** Ordem dos grupos no painel do terminal; sem ordem vai para o fim. */
  nrOrdem: number | null;
  qtdComandos: number;
}

/** Comando do cadastro do terminal SSH (/api/ssh/comandos), vinculado a vários servidores. */
export interface ServidorComando {
  codComando?: number;
  dsTitulo: string;
  /** Aceita parâmetros {{nome}}, pedidos ao usuário na execução. */
  dsComando: string;
  dsDescricao?: string | null;
  /** Categoria do cadastro; nula = "Geral". */
  codCategoria?: number | null;
  /** Nome da categoria (só leitura, vem do backend). */
  dsCategoria?: string | null;
  /** Disponível em qualquer servidor (e na conexão avulsa); ignora codServidores. */
  snTodosServidores: boolean;
  /** Servidores vinculados quando snTodosServidores = false. */
  codServidores: number[];
  /** Envia Enter após digitar. */
  snExecutar: boolean;
  /** Pede confirmação antes de executar. */
  snConfirmar: boolean;
  nrOrdem?: number | null;
  nmUsuarioCadastro?: string | null;
  dtCadastro?: string | null;
  dtAtualizacao?: string | null;
}

export interface ServidorProcesso {
  codProcesso?: number;
  dsProcesso?: string;
  nmProcesso?: string;
  caminhoProcesso?: string;
  dsProcessoDetalhe?: string;
  dsStatus?: string;
  dtStatus?: Date;
  snMonitorado?: boolean;
  servidorTipoProcesso?: ServidorTipoProcesso;
}

export interface ServidorTipoProcesso {
  codTipoProcesso?: number;
  dsTipoProcesso?: string;
  tpTipoProcesso?: string;
}

export interface ServidorParamentroProcesso {
  codParametro?: number;
  servidorProcesso?: ServidorProcesso;
  dsParametro?: string;
  dsValor?: string;
  snMonitorado?: boolean;
}

export interface hbserviceStatus {
  status?: string;
  mensagem?: string;
}

export interface informativoMV {
  codMensagem?: number;
  dsMensagem?: string;
  dtInicio?: Date | string;  // Permitir ambos Date e string
  dtFinal?: Date | string;   // Permitir ambos Date e string
  link?: string;
  imagem?: string;
}

export interface schedulerJobInfo {
  jobId?: number;
  jobName?: string;
  jobGroup?: string;
  jobStatus?: Date;
  jobClass?: string;
  cronExpression?: string;
  interfaceName?: string;
  descricao?: string;
  repeatTime?: number;
  cronJob?: boolean;
}

export interface configuracaoUsuario {
  codConfigUsu?: number;
  chave?: string;
  valor?: string;
}

export interface schedulerJobInfoDetail {
  jobId?: number;
  jobName?: string;
  jobGroup?: string;
  jobStatus?: Date;
  jobClass?: string;
  cronExpression?: string;
  cronExpressionDescription?: string;
  descricao?: string;
  interfaceName?: string;
  repeatTime?: number;
  cronJob?: boolean;
  trigger_state?: string;
  prev_fire_time?: Date;
  next_fire_time?: Date;
  /** Motivo da última falha deste job (TB_SCHEDULER_JOB_ERRO) — vazio/undefined quando a última execução foi bem-sucedida. */
  ultimoErro?: string;
  dtUltimoErro?: Date;
}

export interface Chamado {
  idChamado?: number;
  titulo?:    string;
  descricao?: string;
  tipo?:      string;
  dthrAbertura?:Date;
  snAnaliseTecnica?:string;
  snTecnico?:string;
  snAnaliseRequisitos?:string;
  snPendente?: string;
  dthrSolucao?:string;
  snRemovidoGrupo?:string;
  snValidado?:string;
  statusAprovacaoGestao?:string;
  dthrAprovacaoGestao?:Date;
  snStatusNovo?:string;
}

export interface Alerta {
  tipo:    string;
  id:      string;
  msg:     string;
  titulo:  string;
  tts:     string;
}

export interface ServidorDto{
  codservidor:number;
  dsservidor:string;
  tempoatividade:string;
  lasstatus:string;
  /** Texto do uptime: médias de 1, 5 e 15 minutos. */
  cpuload:string;
  /** Núcleos de CPU do servidor (nproc). */
  qtcpu?:number;
  /** Load de 5 min dividido pelos núcleos: 1 = capacidade cheia, 2 = fila dobrada. */
  loadporcpu?:number;
  usodisco:string;
  /** Partição mais grave do servidor. */
  discolocal?:string;
  /** Nível dela pela regra do alerta: OK, ATENCAO, CRITICO, EXTREMO (nulo = ainda não avaliado). */
  niveldisco?:string;
}

// ============ ESCALA INTERFACES ATUALIZADAS ============

export interface Escala {
  id?: number;
  mesEscala: number; // YYYYMM
  criadoEm?: string;
  publicado: boolean;
  publicadoEm?: string;
  criadoPor: number;
  plantoes?: Plantao[];
}

export interface Plantao {
  id?: number;
  escala?: Escala;         // Para uso interno/visualização (opcional)
  idEscala?: number;       // ← NOVO: Para relacionamento/requests (opcional)
  mesEscala: number;
  dia: number;
  idUsuario: number;
  idTipoPlantao: number;
  tipoPlantao?: TipoPlantao;
  criadoEm?: string;
  atualizadoEm?: string;
  criadoPor?: number;
  observacoes?: string;
  status?: 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO' | 'SUBSTITUIDO' | 'CANCELADO';
  versao?: number;
}

export interface TipoPlantao {
  id: number;
  nome: string;
  cor: string;
  duracao: number;
  ativo?: boolean;
  descricao?: string;
  snRemunerado?: boolean;
  snPonte?: boolean;
}

export interface Funcionario {
  id: number;
  nome: string;
  matricula?: string;
  email?: string;
  ativo: boolean;
  cargaHoraria?: number;
  setor?: string;
}

export interface FeriasFuncionario {
  id?: number;
  idUsuario: number;
  dataInicio: string;
  dataFim: string;
  observacoes?: string;
  funcionario?: Funcionario;
}

export interface ContagemFuncionario {
  plantoes: number;
  horas: number;
}

export interface Feriado {
  id?: number;
  data: string;      // formato YYYY-MM-DD
  nome: string;
}

// Adicione estas propriedades na interface VistaEscala:
export interface VistaEscala {
  escala?: Escala;
  grid: { [idUsuario: number]: { [dia: number]: Plantao } };
  contagens: {
    [idUsuario: number]: ContagemFuncionario | number
  };
  funcionarios: Usuario[];
  legenda: TipoPlantao[];
  feriados: number[];
  feriasPorUsuario: { [idUsuario: number]: number[] };
  feriasDetalhadas: FeriasFuncionario[];
  mes: number;
  ano: number;
  escalaPublicada: boolean;

  totais?: {
    totalPlantoes: number;
    totalHoras: number;
    funcionariosAtivos: number;
    coberturaDias: number;
    totalPreferencias?: number; // ✅ ADICIONAR
  };

  // ✅ ADICIONAR ESTAS PROPRIEDADES
  preferenciasPorUsuario?: { [idUsuario: number]: number[] };
  preferencias?: number[];
}

export interface PermissaoUsuarioEscala {
  idUsuario: number;
  podeCriar: boolean;
  podeEditar: boolean;
  podeVisualizarContagens: boolean;
  podeReorganizar: boolean;
  podePublicar: boolean;
  podeGerarEscala: boolean;
  podeExcluir: boolean;
  permissoesEspecificas?: string[];
}

export interface PlantaoRequest {
  plantao: Plantao;
  idUsuarioAtual: number;
}

export interface ReorganizarRequest {
  dia: number;
  deIdUsuario: number;
  paraIdUsuario: number;
  mesEscala: number;
  idUsuarioAtual: number;
}

export interface GerarEscalaRequest {
  ano: number;
  mes: number;
  criadoPor: number;
  parametros?: {
    considerarFerias: boolean;
    considerarFeriados: boolean;
    considerarFolgas: boolean;
    distribuicaoEquitativa: boolean;
    limitePlantaoMensal: number;
  };
}

export interface PublicarEscalaRequest {
  mesEscala: number;
  idUsuarioAtual: number;
  observacao?: string;
}

export interface PreferenciaFolga {
  id?: number;
  idUsuario: number;
  dataFolga: Date | string;
  dataCriacao?: Date;
}

export interface PreferenciaFolgaRequest {
  idUsuario: number;
  dataFolga: string; // Formato YYYY-MM-DD
}

// src/app/models/sprint.model.ts
export enum StatusSprint {
  PLANEJADA = 'PLANEJADA',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA'
}

export enum StatusEntrega {
  PENDENTE = 'PENDENTE',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  AG_ENTREGA = 'AGUARDANDO ENTREGA',
  ENTREGUE = 'ENTREGUE',
  ATRASADO = 'ATRASADO',
  REMOVIDO = 'REMOVIDO'
}

export interface Sprint {
  id?: number;
  nome: string;
  objetivo?: string;
  dataInicio: string | Date;
  dataFim: string | Date;
  status?: string;
  qtTicketsTotal?: number;
  qtTicketsEntregues?: number;
  qtTicketsPendentes?: number;
  percentualConclusao?: number;
  tickets?: SprintTicket[];
}

export interface SprintTicket {
  id: number;
  sprint?: Sprint;           // opcional para evitar deep nesting
  ticket: TicketChamado;     // objeto completo do ticket
  criticidade: number;
  descricaoCriticidade: string;
  dataInclusao?: string | null;
  statusEntrega: StatusEntrega;
  dataEntregaPrevista?: string;
  dataEntregaReal?: string;
  observacao?: string;
}

export type RespostaAnaliseEntrega = 'ENTREGUE' | 'NAO_ENTREGUE';

/** Ticket de sprint encerrada aguardando o responsável informar se foi entregue. */
export interface TicketAnaliseEntrega {
  sprintId: number;
  sprintNome: string;
  sprintDataFim: string;
  ticketId: string;
  titulo?: string | null;
  statusTicket?: string | null;
  dtResolvido?: string | null;
  criticidade?: number | null;
  descricaoCriticidade?: string | null;
  observacao?: string | null;
}

export interface RegistrarAnaliseEntrega {
  sprintId: number;
  ticketId: string;
  statusEntrega: RespostaAnaliseEntrega;
  observacao?: string | null;
}

export interface CriarSprintRequest {
  nome: string;
  objetivo?: string;
  dataInicio: string; // Formato YYYY-MM-DD
  dataFim: string;    // Mude de diasDuracao para dataFim
  tickets: TicketSprintDTO[]; // ou TicketSprintRequest[]
}

export interface DashboardSprint {
  idSprint: number;
  nomeSprint: string;
  dataInicio: string;
  dataFim: string;
  diasDuracao: number;
  status: StatusSprint;
  percentualEntrega: number;
  qtdTotalTickets: number;
  qtdEntregues: number;
  qtdPendentes: number;
  qtdAtrasados: number;
  qtdNivel1: number;
  qtdNivel2: number;
  qtdNivel3: number;
  qtdNivel4: number;
  diasDecorridos: number;
  diasRestantes: number;
  distribuicaoCriticidade: { [key: string]: number };
  distribuicaoStatus: { [key: string]: number };
  ticketsDetalhados: TicketSprintDetalhado[];
  tickets?: any[];
}

export interface TicketSprintDetalhado {
  idSprintTicket: number;
  idTicket: string;
  criticidade: number;
  descricaoCriticidade: string;
  statusEntrega: StatusEntrega;
  dataEntregaPrevista: string;
  dataEntregaReal?: string;
  titulo: string;
  descricao: string;
  status: string;
  dataTicket: string;
  dtResolvido?: string | Date | null;
  responsavel: string;
  statusPrazo: string;
  ticketDetalhes: TicketChamado;
}

export interface TicketChamado {
  id: string;
  titulo: string;
  descricao: string;
  status: string;
  dataMovimento: string;
  snVinculo: number;
  dataTicket: string;
  slaContrato: SlaContrato;
  responsavel: string;
  /** Usuário do AppNTI responsável, pelo de-para de usuários MV (null = sem vínculo). */
  codUsuarioResp?: number | null;
  extId: string;
  dtUpdate: string;
  dtResolvido?: string | Date | null;
  // Campos de classificação HB
  statusHb?: string | null;
  observacao?: string | null;
  categoria?: string | null;
  dtStatus?: string | null;
  /** Calculado pelo backend: true quando DATA_MOVIMENTO > DH_STATUS_HB ou sem status HB */
  desatualizado?: boolean;
}

export interface AtualizarSprintRequest {
  nome: string;
  objetivo?: string;
  dataInicio: string;
  dataFim: string;
  ticketsAdicionar: TicketSprintDTO[];
  ticketsRemover: string[]; // IDs dos tickets (string)
}

// src/app/models/sla-critico.model.ts
export enum StatusSla {
  NO_PRAZO = 'NO_PRAZO',
  ATRASADO = 'ATRASADO',
  PENDENTE = 'PENDENTE'
}

export interface DashboardSlaCritico {
  ticketsNivel1: SlaCriticoDetalhado[];
  ticketsNivel2: SlaCriticoDetalhado[];
  totalNivel1: number;
  totalNivel2: number;
  noPrazoNivel1: number;
  noPrazoNivel2: number;
  atrasadosNivel1: number;
  atrasadosNivel2: number;
}

export interface SlaCriticoDetalhado {
  idSlaCritico: number;
  idTicket: string;
  nivel: number;
  descricaoNivel: string;
  dataAbertura: Date;
  dataLimitePaliativo: Date;
  dataLimiteDefinitivo: Date;
  dataPaliativoReal?: Date;
  dataDefinitivoReal?: Date;
  statusSlaPaliativo: string;
  statusSlaDefinitivo: string;
  titulo: string;
  descricao?: string;
  status: string;
  responsavel?: string;
  horasRestantesPaliativo?: number;
  horasRestantesDefinitivo?: number;
}

// src/app/core/models/ticket-classificacao.model.ts
export interface TicketClassificacao {
  id: string;
  ticket: TicketChamado;
  nivel: number;
  dataClassificacao: Date;
  classificador: string;
  observacao?: string;
  slaCriticoId?: number;
  emSprint: boolean;
  sprintAtual?: string;
  descricaoNivel?: string;
}

// src/app/core/models/dashboard-ticket-metrics.model.ts
export interface DashboardTicketMetrics {
  totalTickets: number;
  ticketsAbertos: number;
  ticketsResolvidos: number;
  ticketsNivel1: number;
  ticketsNivel2: number;
  ticketsNivel3: number;
  ticketsNivel4: number;
  ticketsSemClassificacao: number;
  ticketsEmSprint: number;
  ticketsForaSprint: number;
  ticketsAtrasados: number;
  percentualAtraso: number;
  tempoMedioResolucao: number;
  ticketsUltimaSemana: number;
  tendencia: 'melhorando' | 'piorando' | 'estavel';
}

// src/app/core/models/sla-contrato.model.ts
export interface SlaContrato {
  id?: number;
  nomeContrato: string;
  nivel: number;
  descricaoNivel?: string;
  horasPaliativo: number;
  horasDefinitivo: number;
  horasUteis: boolean;
  inicioExpediente?: string;
  fimExpediente?: string;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  descricao?: string;
  ativo: boolean;
  dataCriacao?: string;
  dataAtualizacao?: string;
  usuarioCriacao?: string;
  usuarioAtualizacao?: string;
}

// Interface para resposta do contrato vigente
export interface SlaContratoVigente {
  nivel: number;
  contrato: SlaContrato;
  emVigencia: boolean;
  diasRestantes?: number;
}

export interface CriarSprintRequest {
  nome: string;
  objetivo?: string;
  dataInicio: string;
  dataFim: string;  // ← dataFim, não diasDuracao
  tickets: TicketSprintDTO[];  // ← Usando TicketSprintDTO
}

export interface TicketSprintDTO {
  ticketId: string;
  criticidade: number;
  observacao?: string;
}

// src/app/core/dtos/dashboard-sprint.dto.ts
export interface DashboardSprintDTO {
  idSprint: number;
  nomeSprint: string;
  dataInicio: Date;
  dataFim: Date;
  diasDuracao: number;
  status: string;
  percentualEntrega: number;
  qtdTotalTickets: number;
  qtdEntregues: number;
  qtdPendentes: number;
  qtdAtrasados: number;
  qtdNivel1: number;
  qtdNivel2: number;
  qtdNivel3: number;
  qtdNivel4: number;
  diasDecorridos: number;
  diasRestantes: number;
  distribuicaoCriticidade?: Record<string, number>;
  distribuicaoStatus?: Record<string, number>;
  ticketsDetalhados?: TicketSprintDetalhadoDTO[];
}

export interface TicketSprintDetalhadoDTO {
  idSprintTicket: number;
  idTicket: string;
  criticidade: number;
  descricaoCriticidade: string;
  statusEntrega: string;
  dataEntregaPrevista: Date;
  dataEntregaReal?: Date;
  titulo: string;
  descricao: string;
  status: string;
  dataTicket: Date;
  dtResolvido?: Date;
  responsavel: string;
  statusPrazo: string;
}

// src/app/core/dtos/dashboard-sla-critico.dto.ts
export interface DashboardSlaCriticoDTO {
  ticketsNivel1: SlaCriticoDetalhado[];
  ticketsNivel2: SlaCriticoDetalhado[];
  totalNivel1: number;
  totalNivel2: number;
  noPrazoNivel1: number;
  noPrazoNivel2: number;
  atrasadosNivel1: number;
  atrasadosNivel2: number;
}
export interface Ticket {
  id: string;
  titulo: string;
  descricao?: string;
  tipo?: string;
  prioridade?: string;
  criticidade?: number;      // vem do SprintTicket
  responsavel?: string;      // vem do TicketChamado
}

export interface TicketFiltro {
  tipos: string[];
  prioridades: string[];
  search: string;
}

export interface TipoAusencia {
  id: number;
  nome: string;
  descricao?: string;
  cor: string;
  sigla: string; // Ex: "BH" para Banco de Horas, "AT" para Atestado
  ativo: boolean;
  ordem?: number;
}

// Modelo para Ausência registrada
export interface Ausencia {
  id?: number;
  dia: number;
  idUsuario: number;
  idTipoAusencia: number;
  idEscala: number;
  mesEscala: number;
  observacao?: string;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

export interface PermissionResponse {
  allowed?: boolean;
  message: string;
}

// =========================================================
// pagamento-plantao.interface.ts
// =========================================================

export interface PlantaoDisponivelDTO {
  idPlantao: number;
  matricula: string;
  nomeColaborador: string;
  dataPlantao: string;       // ISO date: "2026-01-15"
  horaInicio: string;        // "HH:mm"
  horaFim: string;           // "HH:mm"
  tipoPlantao: string;
  mesEscala: number;
  horasCalculadas: number;
  /** "ESCALA" (padrão) ou "AVULSO" — plantão incluído fora da escala publicada. */
  origem?: 'ESCALA' | 'AVULSO';
  motivoAvulso?: string;
}

export interface PlantaoEnviadoDTO {
  idPlantao: number;
  matricula: string;
  nomeColaborador: string;
  dataPlantao: string;
  horaInicio: string;
  horaFim: string;
  tipoPlantao: string;
  numeroRemessa: number;
  dataEnvioPagamento: string;
  enviadoPorNome: string;
  observacao: string;
  origem?: 'ESCALA' | 'AVULSO';
}

export interface PlantaoNaoPagoDTO {
  idPlantao: number;
  matricula: string;
  nomeColaborador: string;
  dataPlantao: string;
  horaInicio: string;
  horaFim: string;
  tipoPlantao: string;
  dataMarcacaoNaoPago: string;
  marcadoPorNome: string;
  motivoNaoPago: string;
  origem?: 'ESCALA' | 'AVULSO';
}

export interface RemessaDTO {
  numeroRemessa: number;
  dataEnvio: string;
  enviadoPorNome: string;
  totalPlantoes: number;
  dataPlantaoInicio: string;
  dataPlantaoFim: string;
}

export interface EnviarPagamentoRequest {
  idsPlantoes: number[];
  dataInicio?: string;
  dataFim?: string;
  incluirFuturos?: boolean;
  observacao?: string;
}

export interface MarcarNaoPagoRequest {
  idsPlantoes: number[];
  motivo: string;
}

/** Inclusão de plantão avulso — trabalho realizado fora da escala publicada. */
export interface CriarPlantaoAvulsoRequest {
  idUsuario: number;
  dataInicio: string;  // ISO datetime: "2026-01-15T22:00:00"
  dataFim: string;      // ISO datetime
  motivo: string;
}

export interface EnviarPagamentoResponse {
  numeroRemessa: number;
  dataEnvio: string;
  totalPlantoes: number;
  totalHoras: number;
  mensagem: string;
}

export interface MarcarNaoPagoResponse {
  totalMarcados: number;
  mensagem: string;
}

export interface DisponiveisResponse {
  plantoes: PlantaoDisponivelDTO[];
  total: number;
  totalHoras: number;
}

export interface EnviadosResponse {
  plantoes: PlantaoEnviadoDTO[];
  total: number;
}

export interface NaoPagosResponse {
  plantoes: PlantaoNaoPagoDTO[];
  total: number;
}

export interface RemessasResponse {
  remessas: RemessaDTO[];
  total: number;
}

export interface NotaFiscal {
  id?: number;
  chaveAcesso?: string;
  numeroNfse?: string;
  competencia?: string;
  dataEmissao?: string;
  cnpjCpfNif?: string;
  nomeEmpresarial?: string;
  descricaoServico?: string;
  valorServico?: number;
  criadoEm?: string;
  nomeArquivoPdf?: string;
  tamanhoArquivo?: number;
  origemDados?: 'ADN' | 'PDF_EXTRACAO' | 'MANUAL';
  intercorrencias?: string;
}

export interface CentroCusto {
  id?: number;
  cdSetor: string;
  nmSetor: string;
}

export interface Contrato {
  id?: number;
  empresa: string;
  cnpj: string;
  cnpjFormatado?: string;
  sistema?: string;
  descricao?: string;
  snAtivo?: string;
  criadoEm?: string;
  criadoPor?: number;
  centrosCusto?: CentroCusto[];
}

export interface Setor {
  cdSetor: string;
  nmSetor: string;
}

export interface AssinaturaUsuario {
  idUsuario?: number;
  nomeExibicao: string;
  cargo?: string;
  setor?: string;
  atualizadoEm?: string;
  possuiImagem?: boolean;
  imagemBase64?: string;
}

export type ModoAuthGoogleDrive = 'SERVICE_ACCOUNT' | 'OAUTH_USUARIO';
export type TipoPermissaoGoogleDrive = 'anyone' | 'domain';

export interface GoogleDriveConfig {
  habilitado: boolean;
  modoAuth: ModoAuthGoogleDrive;
  credenciaisPath?: string;
  pastaId?: string;
  tipoPermissao: TipoPermissaoGoogleDrive;
  dominio?: string;
  expurgoDias: number;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthRedirectUri?: string;
  autorizado: boolean;
  autorizadoEm?: string;
}
