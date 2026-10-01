/**
 * Utilitários de CNPJ/CPF considerando o CNPJ alfanumérico (IN RFB nº 2.229/2024,
 * vigente a partir de julho/2026): 12 posições [0-9A-Z] + 2 dígitos verificadores.
 * CNPJs antigos (só números) continuam válidos — são um caso particular do novo formato.
 *
 * Os valores trafegam/gravam "limpos": sem pontuação e em maiúsculas.
 */

const CNPJ_LIMPO = /^[0-9A-Z]{12}\d{2}$/;
const CPF_LIMPO = /^\d{11}$/;

/** Remove pontuação e espaços, preservando letras (em maiúsculas) e números. */
export function limparCnpj(doc?: string | null): string {
  return (doc || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** true se o valor (limpo ou formatado) tem o formato de CNPJ numérico ou alfanumérico. */
export function isFormatoCnpj(doc?: string | null): boolean {
  return CNPJ_LIMPO.test(limparCnpj(doc));
}

/** Valida os dígitos verificadores (cada caractere vale código ASCII - 48). */
export function isCnpjValido(doc?: string | null): boolean {
  const d = limparCnpj(doc);
  if (!CNPJ_LIMPO.test(d) || new Set(d).size === 1) return false;
  const dv1 = calcularDv(d.substring(0, 12));
  const dv2 = calcularDv(d.substring(0, 12) + dv1);
  return d.endsWith(`${dv1}${dv2}`);
}

function calcularDv(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += (base.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Formata CNPJ (XX.XXX.XXX/XXXX-XX, aceitando letras) ou CPF (XXX.XXX.XXX-XX).
 * Qualquer outro valor (ex.: NIF estrangeiro) é devolvido como veio.
 */
export function formatarCnpjCpf(doc?: string | null): string {
  if (!doc) return '';
  const d = limparCnpj(doc);
  if (CNPJ_LIMPO.test(d)) return d.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
  if (CPF_LIMPO.test(d)) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc;
}

/**
 * Máscara progressiva para digitação de CNPJ alfanumérico: aceita letras nas 12
 * primeiras posições e só dígitos nas 2 últimas (DV). Retorna o texto formatado.
 */
export function mascararCnpj(valor: string): string {
  const bruto = limparCnpj(valor);
  let v = '';
  for (const c of bruto) {
    if (v.length >= 14) break;
    if (v.length >= 12 && !/\d/.test(c)) continue; // DV é sempre numérico
    v += c;
  }
  const partes = [v.slice(0, 2), v.slice(2, 5), v.slice(5, 8), v.slice(8, 12), v.slice(12, 14)];
  let out = partes[0];
  if (partes[1]) out += '.' + partes[1];
  if (partes[2]) out += '.' + partes[2];
  if (partes[3]) out += '/' + partes[3];
  if (partes[4]) out += '-' + partes[4];
  return out;
}
