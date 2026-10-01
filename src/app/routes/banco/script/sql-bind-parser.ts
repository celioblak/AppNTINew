// sql-bind-parser.ts
// Extrai nomes de bind variables (:NOME) de um texto SQL, ignorando qualquer
// ':' que esteja dentro de uma string literal (entre aspas simples) — mesma
// lógica do ScriptExecutionService.extrairBinds() no backend. Essencial
// porque máscaras de formato como TO_CHAR(dt,'HH24:MI:SS') contêm ':' seguido
// de letras que, sem esse cuidado, seriam confundidos com bind variables.

export function extrairBindsUnicos(sql: string): string[] {
  const resultado: string[] = [];
  const vistos = new Set<string>();
  let dentroDeString = false;
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const c = sql[i];

    if (c === "'") {
      if (dentroDeString && sql[i + 1] === "'") {
        i += 2;
        continue;
      }
      dentroDeString = !dentroDeString;
      i++;
      continue;
    }

    if (!dentroDeString && c === ':' && /[A-Za-z_]/.test(sql[i + 1] || '')) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(sql[j])) {
        j++;
      }
      const nome = sql.substring(i + 1, j).toUpperCase();
      if (!vistos.has(nome)) {
        vistos.add(nome);
        resultado.push(nome);
      }
      i = j;
      continue;
    }

    i++;
  }

  return resultado;
}
