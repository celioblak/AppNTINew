/** Situação nos filtros de cadastro. */
export type FiltroSituacao = 'todos' | 'ativos' | 'inativos';

/** Minúsculas e sem acento: "Produção" casa com "producao". */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Busca livre: cada palavra digitada precisa aparecer em algum dos campos (ordem livre). */
export function contemTexto(busca: string, ...campos: (string | number | null | undefined)[]): boolean {
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
  if (!palavras.length) {
    return true;
  }
  const alvo = normalizar(campos.filter(c => c !== null && c !== undefined).join(' '));
  return palavras.every(p => alvo.includes(p));
}

export function passaSituacao(situacao: FiltroSituacao, ativo: boolean): boolean {
  return situacao === 'todos' || (situacao === 'ativos') === ativo;
}
