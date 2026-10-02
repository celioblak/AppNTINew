/**
 * Infraestrutura > Ambientes e Servidores e Serviços (/api/infraestrutura).
 * Senhas nunca vêm nestes objetos: o cofre entrega uma credencial por vez.
 */

export type Situacao = 'OK' | 'ALERTA' | 'FORA' | 'MANUTENCAO' | 'DESCONHECIDO';
export type TipoLocal = 'SERVIDOR' | 'APPLIANCE' | 'HOST_DOCKER' | 'CLUSTER_K8S' | 'GERENCIADO';
export type FormaExecucao = 'PROCESSO' | 'CONTAINER' | 'WORKLOAD_K8S';
export type Papel = 'APLICACAO' | 'BALANCEADOR' | 'BANCO_DADOS' | 'WEB' | 'OUTRO';
export type Gravidade = 'ALTA' | 'MEDIA' | 'BAIXA' | 'INFO';

export interface Uso {
  servidores: number;
  servicos: number;
  configuracoesAtualizacao: number;
}

export interface Ambiente {
  codigo: string;
  nome: string;
  descricao: string | null;
  producao: boolean;
  cor: string | null;
  ordem: number | null;
  ativo: boolean;
  uso?: Uso | null;
  /** Problemas da infraestrutura deste ambiente geram mensagem de alerta (Telegram, aplicativo, painel de TV). */
  alerta?: boolean;
}

export interface Hospedagem {
  codHospedagem: number | null;
  nome: string;
  tipo: 'ON_PREMISE' | 'CLOUD';
  provedor: string | null;
  regiao: string | null;
  ativo: boolean;
  servidores?: number;
}

export interface TipoServico {
  codTipoProcesso: number;
  nome: string;
  papel: Papel | null;
  servicos: number;
}

export interface Grupo {
  codGrupo: number;
  nome: string;
}

export interface Opcoes {
  ambientes: Ambiente[];
  hospedagens: Hospedagem[];
  tipos: TipoServico[];
  grupos: Grupo[];
  tiposParametro: string[];
}

export interface Pendencia {
  gravidade: Gravidade;
  mensagem: string;
  orientacao: string | null;
}

export interface Disponibilidade {
  percentual: number | null;
  percentualPleno: number | null;
  minutosParado: number;
  minutosDegradado: number;
  minutosSemDados: number;
  minutosPlanejados: number;
  paradas: number;
  cobertura: number;
  observacao: string | null;
}

export interface Parametro {
  codParametro: number | null;
  tipo: string;
  valor: string;
  monitorado: boolean;
}

export interface Servico {
  codProcesso: number;
  codServidor: number;
  nome: string;
  nmProcesso: string | null;
  descricao: string | null;
  caminho: string | null;
  codTipoProcesso: number | null;
  tipo: string | null;
  papel: Papel | null;
  formaExecucao: FormaExecucao;
  ambiente: string | null;
  ambienteEfetivo: string | null;
  ambienteHerdado: boolean;
  recurso: string | null;
  namespace: string | null;
  imagem: string | null;
  monitorado: boolean;
  situacao: Situacao;
  detalhe: string | null;
  orientacao: string | null;
  ultimaLeitura: string | number | null;
  parametros: Parametro[];
  pendencias: Pendencia[];
  disponibilidade: Disponibilidade | null;
}

export type NivelDisco = 'OK' | 'ATENCAO' | 'CRITICO' | 'EXTREMO' | 'SISTEMA' | 'IGNORADO' | 'SEM_DADOS';

export interface Disco {
  codDisco: number | null;
  local: string;
  total: string;
  usado: string;
  disponivel: string;
  percentual: string;
  /** Falso = aparece na tela, sem alerta (D-41). */
  monitorado: boolean;
  /** Partição de boot: nunca alerta (D-37). */
  sistema: boolean;
  nivel: NivelDisco;
  /** "8% livre (6,2 GB)". */
  livre: string;
  /** Limites próprios; nulo = padrão. */
  pcLivreAtencao: number | null;
  gbLivreAtencao: number | null;
  pcLivreCritico: number | null;
  gbLivreCritico: number | null;
}

/** Exceções da partição (D-41). */
export interface DiscoEdicao {
  monitorado: boolean;
  pcLivreAtencao: number | null;
  gbLivreAtencao: number | null;
  pcLivreCritico: number | null;
  gbLivreCritico: number | null;
}

export interface Servidor {
  codServidor: number;
  nome: string;
  ip: string | null;
  maquina: string | null;
  so: string | null;
  tipoLocal: TipoLocal;
  /** Só o padrão para serviços sem ambiente próprio. */
  ambiente: string | null;
  /** Ambientes que o servidor atende de fato (os dos serviços dele). */
  ambientes: string[];
  codHospedagem: number | null;
  hospedagem: string | null;
  codGrupo: number | null;
  grupo: string | null;
  observacao: string | null;
  ativo: boolean;
  monitorado: boolean;
  tipoAcessoRemoto: string | null;
  usuarioAdmin: string | null;
  senhaAdminCadastrada: boolean;
  usuarioAcessoRemoto: string | null;
  senhaAcessoRemotoCadastrada: boolean;
  situacao: Situacao;
  detalhe: string | null;
  orientacao: string | null;
  load: string | null;
  cpus: number | null;
  tempoAtividade: string | null;
  ultimaConexao: string | number | null;
  foraDesde: string | number | null;
  discos: Disco[];
  servicos: Servico[];
  pendencias: Pendencia[];
  disponibilidade: Disponibilidade | null;
  /** Última leitura de memória; null = nunca lida. */
  memoria: MemoriaServidor | null;
  /** Só Windows: protocolo do WinRM. */
  winrm: ProtocoloWinRm | null;
  /** Só Windows: de onde ler os recursos (R-48). */
  leitura: ModoLeitura | null;
  /** Só Windows: de onde veio a última leitura. */
  fonteLeitura: FonteLeitura | null;
}

export type ProtocoloWinRm = 'HTTPS' | 'HTTP';
export type ModoLeitura = 'AUTO' | 'HBSERVICE' | 'WINRM';
export type FonteLeitura = 'WINRM' | 'HBSERVICE' | 'HBSERVICE_INFO';

export const ROTULO_LEITURA: Record<ModoLeitura, string> = {
  AUTO: 'Automático (WinRM; se falhar, HB Service)',
  HBSERVICE: 'Só HB Service',
  WINRM: 'Só WinRM',
};

export const ROTULO_FONTE: Record<FonteLeitura, string> = {
  WINRM: 'WinRM',
  HBSERVICE: 'HB Service',
  HBSERVICE_INFO: 'HB Service antigo (só memória)',
};

/** Resultado de uma fonte no "Testar leitura". */
export interface TesteFonte {
  fonte: 'WINRM' | 'HBSERVICE';
  ok: boolean;
  mensagem: string;
  orientacao: string | null;
  /** HB Service antigo: a tela oferece "Atualizar HB Service" (R-59). */
  atualizarAgente: boolean;
}

/**
 * Memória do servidor (docs/infraestrutura.md, seção 12), em KB. Em uso = total − disponível (sem o cache).
 * Swap = arquivo de paginação no Windows. Paginação (pág/s) só no Linux; CPU % só no Windows.
 */
export interface MemoriaServidor {
  totalKb: number;
  emUsoKb: number | null;
  disponivelKb: number | null;
  cacheKb: number | null;
  swapTotalKb: number | null;
  swapUsadoKb: number | null;
  swapRotulo: string;
  paginacaoSeg: number | null;
  cpuPercentual: number | null;
  quando: string | number | null;
}

/** Resultado de "Testar WinRM". */
export interface TesteWinRm {
  ok: boolean;
  mensagem: string;
  orientacao: string | null;
  protocolo: string;
  memoriaTotalKb: number | null;
  nucleos: number | null;
  discos: number | null;
}

/** Senha null = manter a atual; '' = apagar. */
export interface ServidorEdicao {
  nome: string;
  ip: string | null;
  maquina: string | null;
  so: string | null;
  tipoLocal: TipoLocal;
  ambiente: string | null;
  codHospedagem: number | null;
  codGrupo: number | null;
  observacao: string | null;
  ativo: boolean;
  monitorado: boolean;
  tipoAcessoRemoto: string | null;
  usuarioAdmin: string | null;
  senhaAdmin: string | null;
  usuarioAcessoRemoto: string | null;
  senhaAcessoRemoto: string | null;
  /** Só Windows. */
  winrm: ProtocoloWinRm | null;
  /** Só Windows. */
  leitura: ModoLeitura | null;
}

export interface ServicoEdicao {
  nmProcesso: string | null;
  descricao: string | null;
  caminho: string | null;
  codTipoProcesso: number | null;
  formaExecucao: FormaExecucao;
  ambiente: string | null;
  recurso: string | null;
  namespace: string | null;
  imagem: string | null;
  monitorado: boolean;
  parametros: Parametro[];
}

export type TipoCredencial = 'ADMIN' | 'ACESSO_REMOTO';

export interface Credencial {
  tipo: TipoCredencial;
  usuario: string | null;
  senha: string | null;
  aviso: string | null;
}

export interface ConsultaCredencial {
  tipo: TipoCredencial;
  login: string;
  ip: string | null;
  quando: string;
}

export interface Periodo {
  codIndisponibilidade: number;
  tipoItem: 'SERVIDOR' | 'SERVICO';
  codItem: number;
  nomeItem: string;
  ambiente: string | null;
  situacao: 'TOTAL' | 'PARCIAL' | 'SEM_DADOS';
  inicio: string;
  fim: string | null;
  minutos: number;
  causa: string | null;
  planejada: boolean;
  observacao: string | null;
  usuarioObservacao: string | null;
}

// ------------------------------------------------------------------ rótulos

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  OK: 'No ar',
  ALERTA: 'Atenção',
  FORA: 'Fora do ar',
  MANUTENCAO: 'Manutenção',
  DESCONHECIDO: 'Sem leitura',
};

export const ROTULO_TIPO_LOCAL: Record<TipoLocal, string> = {
  SERVIDOR: 'Servidor (físico ou VM)',
  APPLIANCE: 'Appliance (F5, NetScaler...)',
  HOST_DOCKER: 'Host Docker',
  CLUSTER_K8S: 'Cluster Kubernetes',
  GERENCIADO: 'Serviço gerenciado (RDS, Azure SQL...)',
};

export const ROTULO_FORMA: Record<FormaExecucao, string> = {
  PROCESSO: 'Processo',
  CONTAINER: 'Container (Docker)',
  WORKLOAD_K8S: 'Workload Kubernetes',
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  APLICACAO: 'Aplicação',
  BALANCEADOR: 'Balanceador',
  BANCO_DADOS: 'Banco de dados',
  WEB: 'Web',
  OUTRO: 'Outro',
};

export const ROTULO_PERIODO: Record<Periodo['situacao'], string> = {
  TOTAL: 'Parado',
  PARCIAL: 'Degradado',
  SEM_DADOS: 'Sem dados',
};

/** "2h15", "45 min", "3 dias 4h". */
export function duracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 24) return resto ? `${horas}h${String(resto).padStart(2, '0')}` : `${horas}h`;
  const dias = Math.floor(horas / 24);
  const h = horas % 24;
  return `${dias} dia${dias > 1 ? 's' : ''}${h ? ` ${h}h` : ''}`;
}

// ---------------------------------------------------------------- Sistemas e Serviços (F-2)

export type Camada = 'ENTRADA' | 'BALANCEADOR' | 'APLICACAO' | 'WEB' | 'DEPENDENCIA' | 'BANCO' | 'OUTRO';
export type SituacaoSistema = 'OK' | 'PARCIAL' | 'FORA' | 'DESCONHECIDO';

export const CAMADAS: Camada[] = ['ENTRADA', 'BALANCEADOR', 'APLICACAO', 'WEB', 'DEPENDENCIA', 'BANCO', 'OUTRO'];

export const ROTULO_CAMADA: Record<Camada, string> = {
  ENTRADA: 'Entrada',
  BALANCEADOR: 'Balanceador',
  APLICACAO: 'Aplicação',
  WEB: 'Web',
  DEPENDENCIA: 'Dependência',
  BANCO: 'Banco',
  OUTRO: 'Outro',
};

export const DICA_CAMADA: Record<Camada, string> = {
  ENTRADA: 'Apache frontal que direciona a requisição para os balanceadores dos sistemas',
  BALANCEADOR: 'Balanceador do sistema (mod_jk, proxy...)',
  APLICACAO: 'Onde o sistema roda (Tomcat, aplicação)',
  WEB: 'Servidor web de conteúdo',
  DEPENDENCIA: 'Serviço de que o sistema depende (SSO, autenticação, integração)',
  BANCO: 'Banco de dados',
  OUTRO: 'Outro',
};

export const ROTULO_SITUACAO_SISTEMA: Record<SituacaoSistema, string> = {
  OK: 'No ar',
  PARCIAL: 'Parcial',
  FORA: 'Fora do ar',
  DESCONHECIDO: 'Sem leitura',
};

export interface ServicoSistema {
  codSistemaProcesso: number;
  codProcesso: number;
  nome: string;
  codServidor: number | null;
  servidor: string | null;
  tipo: string | null;
  papel: Papel | null;
  camada: Camada;
  camadaDefinida: Camada | null;
  essencial: boolean;
  ambienteServico: string | null;
  monitorado: boolean;
  situacao: Situacao;
  detalhe: string | null;
  disponibilidade: Disponibilidade | null;
}

export interface AmbienteSistema {
  ambiente: string;
  nomeAmbiente: string;
  cor: string | null;
  codSistemaAmbiente: number;
  versao: string | null;
  dataVersao: string | null;
  situacao: SituacaoSistema;
  detalhe: string;
  disponibilidade: Disponibilidade | null;
  servicos: ServicoSistema[];
  pendencias: Pendencia[];
  /** Banco cadastrado (ou texto antigo a conciliar); nulo se o sistema não tem banco. */
  banco: BancoSistema | null;
}

export interface SistemaInfra {
  codSistema: number;
  nome: string;
  ativo: boolean;
  trabalhaModulo: boolean;
  ambientes: AmbienteSistema[];
  pendencias: number;
}

export interface SistemaDoServico {
  codSistema: number;
  sistema: string;
  ativo: boolean;
  ambienteExiste: boolean;
  vinculado: boolean;
  camada: Camada;
  essencial: boolean;
}

export interface ServicoSistemas {
  codProcesso: number;
  servico: string;
  ambiente: string | null;
  nomeAmbiente: string | null;
  camadaPadrao: Camada;
  sistemas: SistemaDoServico[];
}

// ---------------------------------------------------------------- Bancos de Dados (F-3, docs/infraestrutura.md seção 13)

export type SituacaoBanco = 'OK' | 'PARCIAL' | 'FORA' | 'SEM_ACESSO' | 'DESCONHECIDO';
export type FormaAcesso = 'SIMPLES' | 'SCAN' | 'DESCRITOR';
export type FinalidadeAcesso = 'PRINCIPAL' | 'LEITURA' | 'ADMINISTRACAO';
export type ResultadoAcesso = 'OK' | 'FALHA' | 'SEM_ACESSO';

export const ROTULO_SITUACAO_BANCO: Record<SituacaoBanco, string> = {
  OK: 'No ar',
  PARCIAL: 'Parcial',
  FORA: 'Fora do ar',
  SEM_ACESSO: 'Sem acesso',
  DESCONHECIDO: 'Sem leitura',
};

export const ROTULO_FORMA_ACESSO: Record<FormaAcesso, string> = {
  SIMPLES: 'Endereço',
  SCAN: 'SCAN',
  DESCRITOR: 'Descritor (tnsnames)',
};

export const ROTULO_FINALIDADE: Record<FinalidadeAcesso, string> = {
  PRINCIPAL: 'Principal',
  LEITURA: 'Só leitura',
  ADMINISTRACAO: 'Administração',
};

export interface AcessoBanco {
  codAcesso: number;
  nome: string;
  forma: FormaAcesso;
  host: string | null;
  porta: number | null;
  servico: string | null;
  descritor: string | null;
  alias: string | null;
  finalidade: FinalidadeAcesso;
  monitorado: boolean;
  enderecos: string[];
  balanceia: boolean;
  failover: boolean;
  resultado: ResultadoAcesso | null;
  mensagem: string | null;
  orientacao: string | null;
  conexao: string | null;
  tempoMs: number | null;
  rede: string[];
  ipsScan: number | null;
  dataTeste: string | null;
}

export interface AcessoEdicao {
  nome: string;
  forma: FormaAcesso;
  host: string | null;
  porta: number | null;
  servico: string | null;
  descritor: string | null;
  alias: string | null;
  finalidade: FinalidadeAcesso;
  monitorado: boolean;
}

export interface InstanciaBanco {
  codInstancia: number;
  nome: string;
  numero: number | null;
  host: string | null;
  situacao: string | null;
  versao: string | null;
  inicio: string | null;
  noAr: boolean;
  dataLeitura: string | null;
  codProcesso: number | null;
  servico: string | null;
  codServidor: number | null;
  servidor: string | null;
}

export interface ServicoBanco {
  nome: string;
  instancias: string[];
}

export interface SistemaUsoBanco {
  codSistema: number;
  sistema: string;
  ambiente: string;
  base: string | null;
  acesso: string | null;
}

export interface Banco {
  codBanco: number;
  nome: string;
  sgbd: string;
  ambiente: string | null;
  nomeAmbiente: string | null;
  cor: string | null;
  observacao: string | null;
  usuarioMonitor: string | null;
  temSenha: boolean;
  ativo: boolean;
  monitorado: boolean;
  modelo: string;
  versao: string | null;
  dbUnique: string | null;
  cdb: boolean | null;
  rac: boolean | null;
  asm: boolean | null;
  papelDataGuard: string | null;
  modoAbertura: string | null;
  dataModelo: string | null;
  situacao: SituacaoBanco | null;
  detalhe: string | null;
  orientacao: string | null;
  atencoes: string[];
  conexao: string | null;
  tempoConexaoMs: number | null;
  dataLeitura: string | null;
  leituraVelha: boolean;
  acessos: AcessoBanco[];
  instancias: InstanciaBanco[];
  servicos: ServicoBanco[];
  grantsFaltando: string[];
  sistemas: SistemaUsoBanco[];
  pendencias: Pendencia[];
  disponibilidade: Disponibilidade | null;
}

export interface BancoEdicao {
  nome: string;
  ambiente: string | null;
  observacao: string | null;
  usuarioMonitor: string | null;
  senhaMonitor: string | null;
  apagarSenha: boolean;
  ativo: boolean;
  monitorado: boolean;
}

export interface EntradaTns {
  alias: string | null;
  descritor: string;
  enderecos: string[];
  servico: string | null;
  sid: string | null;
  balanceia: boolean;
  failover: boolean;
}

export interface ScriptBanco {
  usuarioPrevisto: string;
  script: string;
  senhaNova: boolean;
  aviso: string | null;
}

export interface AcessoVerificado {
  codAcesso: number;
  nome: string;
  finalidade: FinalidadeAcesso;
  resultado: ResultadoAcesso;
  mensagem: string | null;
  orientacao: string | null;
  conexao: string | null;
  tempoMs: number | null;
  rede: string[];
  atencoes: string[];
}

export interface TesteBanco {
  banco: Banco;
  acessos: AcessoVerificado[];
  grantsFaltando: string[];
}

export interface TesteNo {
  instancia: string;
  host: string;
  porta: number;
  resultado: ResultadoAcesso;
  mensagem: string | null;
  orientacao: string | null;
  tempoMs: number | null;
}

export interface ImportacaoInstancia {
  codInstancia: number;
  instancia: string;
  host: string | null;
  codServidor: number | null;
  servidor: string | null;
  codProcesso: number | null;
  acao: 'CRIAR' | 'LIGAR' | 'JA_IMPORTADA' | 'SEM_SERVIDOR';
  motivo: string;
}

export interface BancoOpcao {
  codBanco: number;
  nome: string;
  ambiente: string | null;
  situacao: SituacaoBanco | null;
  acessos: { codAcesso: number; nome: string; finalidade: FinalidadeAcesso }[];
}

/** Banco do sistema no ambiente (R-83): ligado, ou só o texto antigo de Atualizações com a sugestão. */
export interface BancoSistema {
  codBanco: number | null;
  nome: string | null;
  base: string | null;
  codAcesso: number | null;
  acesso: string | null;
  situacao: SituacaoBanco | null;
  detalhe: string | null;
  textoAntigo: string | null;
  sugestaoCodBanco: number | null;
  sugestaoNome: string | null;
  sugestaoBase: string | null;
}
