/**
 * Mapa de serviços (GET /api/mapa-servicos) e o cadastro que o monta
 * (/api/mapa-servicos/balanceadores e /sistemas). A situação de cada item já
 * vem calculada do backend — a mesma regra que o painel de TV usa.
 *
 * A topologia é uma árvore: o sistema tem entradas (um balanceador ou um
 * serviço direto) e um balanceador tem membros (serviços ou outros balanceadores).
 */

/** Servidor, serviço e balanceador. */
export type SituacaoItem = 'OK' | 'ALERTA' | 'FORA' | 'MANUTENCAO' | 'DESCONHECIDO';

/** Sistema: PARCIAL = parte fora mas ainda atende; TOTAL = parado. */
export type SituacaoSistema = 'OK' | 'ATENCAO' | 'PARCIAL' | 'TOTAL' | 'SEM_CADASTRO';

export interface MembroJk {
  nome: string;
  host: string;
  porta: number;
  estado: string | null;
  ativacao: string | null;
  sessoes: number;
  ocupado: number;
  erros: number;
}

/** Serviço na visão por servidor. */
export interface Servico {
  codProcesso: number;
  nome: string;
  tipo: string | null;
  porta: string | null;
  codServidor: number;
  servidor: string;
  situacao: SituacaoItem;
  detalhe: string | null;
  ultimaLeitura: string | number | null;
}

/** Nó do organograma: balanceador (com membros em `filhos`) ou serviço. */
export interface NoMapa {
  tipo: 'BALANCEADOR' | 'SERVICO';
  codBalanceador: number | null;
  codProcesso: number | null;
  nome: string;
  codServidor: number | null;
  servidor: string | null;
  porta: string | null;
  worker: string | null;
  situacao: SituacaoItem;
  detalhe: string | null;
  /** "2 de 3 membros no ar" (só balanceador). */
  resumo: string | null;
  /** Como o balanceador pai vê este nó no jk-status. */
  membro: MembroJk | null;
  filhos: NoMapa[];
  membrosSemCadastro: MembroJk[];
}

export interface ServidorMapa {
  codServidor: number;
  nome: string;
  ip: string | null;
  so: string | null;
  grupo: string | null;
  situacao: SituacaoItem;
  detalhe: string | null;
  load: string | null;
  cpus: number | null;
  disco: string | null;
  ultimaConexao: string | number | null;
  foraDesde: string | number | null;
  monitorado: boolean;
  servicos: Servico[];
  sistemas: string[];
}

export interface SistemaMapa {
  codSistema: number;
  nome: string;
  url: string | null;
  situacao: SituacaoSistema;
  resumo: string;
  exibePainel: boolean;
  entradas: NoMapa[];
  nosAtivos: number;
  nosTotal: number;
}

export interface ResumoMapa {
  sistemas: number;
  sistemasParados: number;
  sistemasParciais: number;
  servidores: number;
  servidoresFora: number;
  servicosFora: number;
}

export interface Mapa {
  atualizadoEm: string | number;
  resumo: ResumoMapa;
  sistemas: SistemaMapa[];
  servidores: ServidorMapa[];
}

// ------------------------------------------------------------------ cadastro

/** Membro de balanceador: um serviço (codProcesso) OU outro balanceador (codBalanceadorFilho). */
export interface MembroCadastro {
  codProcesso: number | null;
  codBalanceadorFilho: number | null;
  membro: string | null;
}

export interface BalanceadorCadastro {
  codBalanceador: number | null;
  nome: string;
  /** Processo que executa o balanceador; vazio = balanceador externo (F5...). */
  codProcesso: number | null;
  worker: string | null;
  observacao: string | null;
  membros: MembroCadastro[];
  /** Só leitura: sistemas que entram por este balanceador. */
  sistemas: string[];
  /** Só leitura: balanceadores dos quais este é membro. */
  pais: string[];
}

/** Entrada do sistema: um balanceador OU um serviço direto (sistema sem balanceador). */
export interface EntradaCadastro {
  codBalanceador: number | null;
  codProcesso: number | null;
}

export interface SistemaCadastro {
  codSistema: number;
  sistema: string;
  sistemaAtivo: boolean;
  cadastrado: boolean;
  urlAcesso: string | null;
  exibePainel: boolean;
  observacao: string | null;
  entradas: EntradaCadastro[];
  /** Só leitura: processos ligados ao sistema na configuração de Atualizações (Produção primeiro). */
  servicosAtualizacao: number[];
}

export interface ProcessoOpcao {
  codProcesso: number;
  nome: string;
  codServidor: number;
  servidor: string;
  tipo: string | null;
  porta: string | null;
  temJkStatus: boolean;
}

export interface MembroSugestao {
  membro: MembroJk;
  codProcessoSugerido: number | null;
  codBalanceadorSugerido: number | null;
}

export interface WorkerJk {
  nome: string;
  membros: MembroSugestao[];
}

export interface JkConsulta {
  acessivel: boolean;
  erro: string | null;
  url: string | null;
  workers: WorkerJk[];
}

/**
 * Classe do painel dos diálogos do cadastro. A lista dos combos (mtx-select)
 * abre dentro dele: no <body>, o overlay do diálogo fica por cima dela e o
 * combo parece vazio.
 */
export const PAINEL_DIALOGO_MAPA = 'dialogo-mapa-servicos';

/** Item das listas de escolha: processo com rótulo legível. */
export interface ProcessoItem extends ProcessoOpcao {
  rotulo: string;
}

export function comRotulo(processos: ProcessoOpcao[]): ProcessoItem[] {
  return processos.map(p => ({ ...p, rotulo: `${p.nome} — ${p.servidor}${p.porta ? ' :' + p.porta : ''}` }));
}

// ------------------------------------------------------------------ rótulos

export const ROTULO_SITUACAO: Record<SituacaoItem, string> = {
  OK: 'No ar',
  ALERTA: 'Atenção',
  FORA: 'Fora do ar',
  MANUTENCAO: 'Manutenção',
  DESCONHECIDO: 'Sem leitura',
};

export const ROTULO_SISTEMA: Record<SituacaoSistema, string> = {
  OK: 'Operando',
  ATENCAO: 'Atenção',
  PARCIAL: 'Parcial',
  TOTAL: 'Parado',
  SEM_CADASTRO: 'Sem cadastro',
};
