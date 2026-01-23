export interface User {
  [prop: string]: any;
  codusuario?: number | string | null;
  nome?: string;
  email?: string;
  foto?: string;
  login?: string;
  roles?: any[];
  permissions?: any[];
  snAdmin?: boolean;
  snAtivo?: boolean;
  isAdmin?: boolean; // Alias para snAdmin
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
  tempoAtividade?: string;
  dtStatus?: Date;
  snMonitorado?: boolean;
  grupoServidor?: grupoServidor;
}

export interface grupoServidor {
  codGrupoServidor?: number;
  dsGrupo?: string;
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
  link?: string;
  dtInicio?: Date;
  dtFinal?: Date;
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
  cpuload:string;
  usodisco:string;
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

// Adicione estas propriedades na interface VistaEscala:
export interface VistaEscala {
  escala?: Escala;
  grid: { [idUsuario: number]: { [dia: number]: Plantao } };
  contagens: {
    [idUsuario: number]: ContagemFuncionario | number
  };
  funcionarios: User[];
  legenda: TipoPlantao[];
  feriados: number[];
  feriasPorUsuario: { [idUsuario: number]: number[] };
  feriasDetalhadas: FeriasFuncionario[];
  mes: number;
  ano: number;
  escalaPublicada: boolean;
  permissoes?: PermissaoUsuario;
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

export interface PermissaoUsuario {
  idUsuario: number;
  role: 'ADMIN' | 'COORDENADOR' | 'USUARIO' | 'VISUALIZADOR';
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
