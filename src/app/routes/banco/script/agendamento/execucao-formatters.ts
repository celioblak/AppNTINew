// execucao-formatters.ts
// Formatadores compartilhados entre o dialog de histórico de UM agendamento
// (dialog-historico-execucao) e a tela de última execução de TODOS os
// agendamentos (ultimas-execucoes) — extraído pra evitar duas cópias da
// mesma lógica (custo Oracle, tamanho, data/hora) divergindo com o tempo.

export function escaparAspas(texto: string): string {
  return texto.replace(/"/g, '&quot;');
}

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Formata uma data ISO no padrão brasileiro dd/MM/yyyy HH:mm:ss, usando
 * componentes locais do Date (não toISOString, que voltaria pra UTC) —
 * assim o horário exibido bate com o fuso do navegador do usuário.
 */
export function formatarDataHoraExecucao(valor?: string): string {
  if (!valor) {
    return '-';
  }
  const d = new Date(valor);
  if (isNaN(d.getTime())) {
    return '-';
  }
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Formata milissegundos como "1.2s" ou "340ms" ou "2m 15s". */
export function formatarMs(ms?: number | null): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const seg = Math.round((ms % 60000) / 1000);
  return `${min}m ${seg}s`;
}

/** Formata número grande com separador de milhar (pt-BR). */
export function formatarNumero(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** Formata bytes em KB/MB/GB legível. */
export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Formata tamanho do arquivo (KB) de forma mais legível. */
export function formatarTamanhoArquivo(tamanhoArquivoKb?: number | null): string {
  if (tamanhoArquivoKb == null) return '-';
  if (tamanhoArquivoKb < 1024) return `${tamanhoArquivoKb} KB`;
  return `${(tamanhoArquivoKb / 1024).toFixed(1)} MB`;
}

export interface CustoOracle {
  tempoSqlMs?: number | null;
  cpuMs?: number | null;
  dbTimeMs?: number | null;
  logicalReads?: number | null;
  physicalReads?: number | null;
  physicalReadBytes?: number | null;
}

/**
 * Coluna "Custo Oracle" — resumo compacto com tooltip detalhado.
 * Formato: "CPU 1.2s | DB 1.5s" (as duas métricas mais úteis no relance).
 * Tooltip mostra tudo: tempo SQL (Java), CPU, DB time, logical/physical
 * reads, volume de I/O. Se não houver dados de custo (execução antiga ou
 * falha na leitura de V$), mostra "-".
 */
export function formatarCustoOracle(data: CustoOracle): string {
  if (data.tempoSqlMs == null && data.cpuMs == null) {
    return '-';
  }

  const cpu = formatarMs(data.cpuMs);
  const db = formatarMs(data.dbTimeMs);
  const resumo = `CPU ${cpu} | DB ${db}`;

  const linhas: string[] = [];
  linhas.push(`Tempo SQL (Java): ${formatarMs(data.tempoSqlMs)}`);
  linhas.push(`CPU Oracle: ${cpu}`);
  linhas.push(`DB Time Oracle: ${db}`);
  if (data.logicalReads != null) {
    linhas.push(`Logical Reads: ${formatarNumero(data.logicalReads)}`);
  }
  if (data.physicalReads != null) {
    linhas.push(`Physical Reads: ${formatarNumero(data.physicalReads)}`);
  }
  if (data.physicalReadBytes != null) {
    linhas.push(`I/O Físico: ${formatarBytes(data.physicalReadBytes)}`);
  }
  if (data.tempoSqlMs != null && data.dbTimeMs != null && data.dbTimeMs > 0) {
    const pctBanco = Math.round((data.dbTimeMs / data.tempoSqlMs) * 100);
    linhas.push(`─────`);
    linhas.push(`${pctBanco}% do tempo total foi no banco`);
    linhas.push(`${100 - pctBanco}% foi geração do Excel/rede`);
  }

  const tooltip = escaparAspas(linhas.join('\n'));
  return `<span class="hist-custo" title="${tooltip}">${resumo}</span>`;
}

/**
 * Calcula a duração entre dtInicio e dtFim, formatada como "1d 2h 3m 4s"
 * (omitindo unidades zeradas à esquerda, mas sempre mostrando segundos).
 * Para execuções ainda sem dtFim (em andamento), calcula contra o momento
 * atual e sinaliza isso no texto.
 */
export function calcularDuracaoExecucao(dtInicio?: string, dtFim?: string): string {
  if (!dtInicio) {
    return '-';
  }

  const inicio = new Date(dtInicio).getTime();
  const emAndamento = !dtFim;
  const fimReferencia = emAndamento ? Date.now() : new Date(dtFim!).getTime();

  let totalSegundos = Math.floor((fimReferencia - inicio) / 1000);
  if (totalSegundos < 0) {
    totalSegundos = 0;
  }

  const dias = Math.floor(totalSegundos / 86400);
  totalSegundos %= 86400;
  const horas = Math.floor(totalSegundos / 3600);
  totalSegundos %= 3600;
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;

  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (dias > 0 || horas > 0) partes.push(`${horas}h`);
  if (dias > 0 || horas > 0 || minutos > 0) partes.push(`${minutos}m`);
  partes.push(`${segundos}s`);

  const duracaoFormatada = partes.join(' ');
  return emAndamento ? `${duracaoFormatada} (em andamento)` : duracaoFormatada;
}
