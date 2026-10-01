// script-agendamento.interface.ts
// Atualizado: campos de custo de execução Oracle adicionados em AgendamentoExecucao.
// LEMBRETE: exportar este arquivo no barril @core (index.ts):
//   export * from './script-agendamento.interface';

export type TipoSql = 'QUERY' | 'PROCEDURE' | 'FUNCTION';
export type TipoDadoParametro = 'DATE' | 'NUMBER' | 'VARCHAR2';
export type TipoDestinatario = 'TO' | 'CC' | 'CCO';
export type StatusExecucao = 'EXECUTANDO' | 'GERANDO_ARQUIVO' | 'ENVIANDO' | 'CONCLUIDO' | 'ERRO' | 'AGUARDANDO_REENVIO';

export interface ParametroAgendamento {
  nome: string;
  tipo: TipoDadoParametro;
  valor?: string;
  ordem?: number;
  detectado?: boolean;
}

export interface DestinatarioDTO {
  email: string;
  tipo: TipoDestinatario;
}

export interface ScriptAgendamentoCreate {
  codSql?: number;
  nomeAgendamento: string;
  cronExpression: string;
  formatoSaida: string;
  nomeArquivo?: string;
  recuperarMisfire?: boolean;
  parametros: ParametroAgendamento[];
  destinatarios: DestinatarioDTO[];
}

export interface ScriptAgendamento {
  codAgendamento?: number;
  nomeAgendamento: string;
  jobName?: string;
  cronExpression?: string;
  /** Tradução legível do cron em pt-BR (ex: "Todos os dias às 18:00"), resolvida no backend. */
  cronExpressionDescription?: string;
  jobStatus?: string;
  codSql: number;
  scriptNome?: string;
  formatoSaida: string;
  nomeArquivo?: string;
  ativo: boolean;
  recuperarMisfire?: boolean;
  dtCadastro?: string;
  proximaExecucao?: string;
  destinatarios: DestinatarioDTO[];
  parametros?: ParametroAgendamento[];
}

export interface AgendamentoExecucao {
  codExecucao: number;
  status: string;
  instanceId?: string;
  dtInicio: string;
  dtFim?: string;
  qtdLinhas?: number;
  tamanhoArquivoKb?: number;
  msgErro?: string;
  qtdTentativas?: number;
  driveFileId?: string;
  driveLink?: string;

  // Custo de execução Oracle (Bloco 2)
  tempoSqlMs?: number;
  cpuMs?: number;
  dbTimeMs?: number;
  logicalReads?: number;
  physicalReads?: number;
  physicalReadBytes?: number;
}

/**
 * Agendamento + sua última execução — tela de acompanhamento geral.
 * ultimaExecucao vem null só quando o agendamento nunca executou nenhuma
 * vez — "Limpar histórico" sempre preserva a execução mais recente
 * (ver ScriptAgendamentoService.excluirHistorico no backend).
 */
export interface UltimaExecucaoAgendamento {
  codAgendamento: number;
  nomeAgendamento: string;
  scriptNome: string;
  ativo: boolean;
  jobStatus?: string;
  ultimaExecucao?: AgendamentoExecucao;
}
