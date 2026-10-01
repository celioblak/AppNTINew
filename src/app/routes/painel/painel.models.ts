import { Sessao } from '@core';

/**
 * Chamado exibido no painel (GET /api/painel/incidentes, /requisicao e /requisicao/hoje).
 * Só os campos que a TV usa — o backend devolve o bean inteiro.
 */
export interface ChamadoPainel {
  idChamado: number | string;
  titulo: string;
  tipo?: 'INCIDENTE' | 'REQUISICAO' | string;
  status?: string;
  snPendente?: 'S' | 'N' | string;
  snTecnico?: 'S' | 'N' | string;
  /** Minutos desde a abertura, calculados no backend; -1 quando não há data. */
  minutosAberto?: number;
}

export interface ChamadosResposta {
  total: number;
  item: ChamadoPainel[];
}

/** Contadores por situação devolvidos por /api/painel/requisicao. */
export interface RequisicaoTotais {
  total: number;
  totalSolicitado: number;
  totalAprovacaoGestor: number;
  totalAnaliseRequisitos: number;
  totalEmAnalise: number;
  totalPausado: number;
  totalValidacao: number;
  totalReprovado: number;
  totalAguardandoExecucao: number;
  totalEmExecucao: number;
}

export interface RequisicaoResposta extends Partial<RequisicaoTotais> {
  item?: ChamadoPainel[];
  /** O backend devolve type = 'error' quando a consulta falha. */
  type?: string;
}

/** Sessão em lock com o tempo já calculado na tela. */
export interface SessaoLockPainel extends Sessao {
  tempoLock?: number;
}

export interface LocksResposta {
  item?: SessaoLockPainel[];
  total?: number;
}

export const TOTAIS_ZERADOS: RequisicaoTotais = {
  total: 0,
  totalSolicitado: 0,
  totalAprovacaoGestor: 0,
  totalAnaliseRequisitos: 0,
  totalEmAnalise: 0,
  totalPausado: 0,
  totalValidacao: 0,
  totalReprovado: 0,
  totalAguardandoExecucao: 0,
  totalEmExecucao: 0,
};

/** Sistema derrubado por um problema: TOTAL (parado) ou PARCIAL (parte dos serviços fora). */
export interface SistemaImpactado {
  codSistema: number;
  nome: string;
  situacao: 'TOTAL' | 'PARCIAL' | string;
  nosAtivos: number;
  nosTotal: number;
}

/**
 * Servidor, serviço ou balanceador fora do ar e os sistemas que ele derruba
 * (GET /api/painel/impactos). Gravidade: CRITICO (algum sistema parado),
 * ALTO (algum sistema parcial), MEDIO (nenhum sistema cadastrado depende dele).
 */
export interface ProblemaPainel {
  chave: string;
  tipo: 'SERVIDOR' | 'SERVICO' | 'BALANCEADOR' | string;
  nome: string;
  servidor: string | null;
  descricao: string | null;
  gravidade: 'CRITICO' | 'ALTO' | 'MEDIO' | string;
  desde: string | number | null;
  sistemas: SistemaImpactado[];
}

export interface ImpactosResposta {
  atualizadoEm: string | number;
  problemas: ProblemaPainel[];
}
