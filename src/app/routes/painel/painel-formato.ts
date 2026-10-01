/**
 * Formatações compartilhadas pelas telas do painel.
 */

/**
 * Idade do chamado em texto curto, do jeito que se lê de longe:
 * "agora", "há 12 min", "há 2h14", "há 3 dias".
 *
 * O backend manda `minutosAberto` já calculado (-1 quando não há data de
 * abertura) para a TV não depender de parse de data em formato de servidor.
 */
export function idadeTexto(minutos: number | undefined | null): string {
  if (minutos === undefined || minutos === null || minutos < 0) return '';
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return resto ? `há ${horas}h${String(resto).padStart(2, '0')}` : `há ${horas}h`;
  }

  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/** Número com vírgula decimal, como se lê em português. */
export function numero(valor: number, casas = 2): string {
  return valor.toFixed(casas).replace('.', ',');
}

/**
 * Siglas e nomes com grafia fixa no título do chamado, pela forma minúscula.
 * Palavra fora da lista vai para minúsculas, então nome novo que aparecer nos
 * chamados entra aqui.
 */
const TERMOS_TITULO: Record<string, string> = Object.fromEntries(
  [
    // siglas
    'MV', 'GIF', 'XML', 'SQL', 'TXT', 'PDF', 'PIX', 'API', 'CPF', 'CNPJ', 'CIP', 'AGFA', 'NPH',
    'APAC', 'TISS', 'SUS', 'UTI', 'CTI', 'OPME', 'SADT', 'TI', 'NTI', 'GLPI', 'RH', 'PS', 'CC',
    'SMS', 'URL', 'QR', 'TV',
    // nomes próprios e produtos
    'SoulMV', 'Soul', 'Unimed', 'Senior', 'Pixeon', 'NoHarm', 'SisnacMed', 'Excel', 'Palmtop',
    'Kanban', 'Kambam', 'Shift', 'Braden', 'Bensaúde',
  ].map(termo => [termo.toLowerCase(), termo])
);

/**
 * Título do chamado em forma de frase, do mesmo jeito para todos.
 *
 * O título vem do Service Desk como o usuário digitou: tudo em maiúsculas, tudo
 * em minúsculas, espaço sobrando, ponto no fim. Na TV sai só com a primeira
 * letra (e a de cada parte depois de " - ", ": " ou " = ") em maiúscula,
 * mantendo siglas e nomes conhecidos.
 */
export function tituloChamado(titulo: string | null | undefined): string {
  if (!titulo) return '';

  let texto = titulo
    .replace(/[\u00A0\s]+/g, ' ') // espaço duplo, tab, quebra de linha, espaço não separável
    .trim()
    .replace(/(\p{L}{2,}|\d)\.+$/u, '$1'); // ponto final (não mexe em iniciais como "S.")

  // Em título de caixa mista, palavra toda em maiúsculas foi escrita assim de
  // propósito (sigla). Em título todo em maiúsculas não dá para saber.
  const tudoMaiusculo = texto === texto.toUpperCase();

  texto = texto.replace(/[\p{L}\p{N}]+/gu, (palavra: string, posicao: number, original: string) => {
    const conhecido = TERMOS_TITULO[palavra.toLowerCase()];
    if (conhecido) return conhecido;

    if (/\d/.test(palavra)) return palavra.toUpperCase();

    const inicial = palavra.length === 1 && original[posicao + 1] === '.';
    const siglaDigitada = !tudoMaiusculo && palavra.length >= 2 && palavra === palavra.toUpperCase();
    if (inicial || siglaDigitada) return palavra.toUpperCase();

    return palavra.toLowerCase();
  });

  return texto
    .replace(/\p{L}/u, letra => letra.toUpperCase())
    .replace(/(\s[-=]\s|:\s)(\p{L})/gu, (_, separador: string, letra: string) => separador + letra.toUpperCase());
}
