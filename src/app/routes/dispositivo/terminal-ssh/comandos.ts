import { ServidorComando } from '@core';

const PADRAO_PARAMETRO = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** Nomes únicos dos parâmetros {{nome}} de um comando, na ordem em que aparecem. */
export function extrairParametros(comando: string): string[] {
  return [...new Set([...comando.matchAll(PADRAO_PARAMETRO)].map(trecho => trecho[1]))];
}

export function aplicarParametros(comando: string, valores: Record<string, string>): string {
  return comando.replace(PADRAO_PARAMETRO, (_trecho, nome: string) => valores[nome] ?? '');
}

/** Nomes dos servidores vinculados ao comando, na ordem do cadastro. */
export function nomesVinculados(comando: ServidorComando, nomes: Map<number, string>): string[] {
  return comando.codServidores.map(cod => nomes.get(cod) ?? `Servidor ${cod}`);
}

/** Texto curto de onde o comando está disponível: "Todos os servidores", "srv1, srv2 +3"... */
export function rotuloServidores(comando: ServidorComando, nomes: Map<number, string>): string {
  if (comando.snTodosServidores) {
    return 'Todos os servidores';
  }
  const vinculados = nomesVinculados(comando, nomes);
  if (vinculados.length === 0) {
    return 'Nenhum servidor';
  }
  return vinculados.length <= 2
    ? vinculados.join(', ')
    : `${vinculados.slice(0, 2).join(', ')} +${vinculados.length - 2}`;
}

/** Minúsculas e sem acentos, para filtros de texto. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Agrupa mantendo a ordem de chegada dos itens dentro de cada grupo. */
export function agrupar<T>(itens: T[], chave: (item: T) => string): { nome: string; itens: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const nome = chave(item);
    const lista = grupos.get(nome);
    if (lista) {
      lista.push(item);
    } else {
      grupos.set(nome, [item]);
    }
  }
  return [...grupos].map(([nome, lista]) => ({ nome, itens: lista }));
}
