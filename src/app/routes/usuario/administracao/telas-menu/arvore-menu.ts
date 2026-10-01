import { MenuCadastro } from './telas-menu.service';

export interface LinhaMenu {
  menu: MenuCadastro;
  nivel: number;
  /** URL completa, ex.: /dispositivo/terminal-ssh */
  caminho: string;
  /** Chave de tradução usada pelo menu lateral, ex.: menu.dispositivos.terminal-ssh */
  chave: string;
}

const SEM_ORDEM = Number.MAX_SAFE_INTEGER;

/** Árvore do menu em profundidade (pai antes dos filhos), ordenada por ordem e nome em cada nível. */
export function linhasDoMenu(menus: MenuCadastro[]): LinhaMenu[] {
  const existentes = new Set(menus.map(m => m.codMenu));
  const filhos = new Map<number | null, MenuCadastro[]>();
  for (const menu of menus) {
    // Pai inexistente: mostra na raiz para o item não sumir da tela.
    const pai = menu.codMenuPai != null && existentes.has(menu.codMenuPai) ? menu.codMenuPai : null;
    const lista = filhos.get(pai);
    if (lista) {
      lista.push(menu);
    } else {
      filhos.set(pai, [menu]);
    }
  }

  const linhas: LinhaMenu[] = [];
  const visitar = (pai: number | null, nivel: number, caminho: string, chave: string, visitados: Set<number>) => {
    const ordenados = [...(filhos.get(pai) ?? [])].sort(
      (a, b) => (a.ordem ?? SEM_ORDEM) - (b.ordem ?? SEM_ORDEM) || a.nome.localeCompare(b.nome)
    );
    for (const menu of ordenados) {
      const codigo = menu.codMenu!;
      if (visitados.has(codigo)) {
        continue; // proteção contra ciclo na tabela
      }
      const linha: LinhaMenu = { menu, nivel, caminho: `${caminho}/${menu.rota}`, chave: `${chave}.${menu.nome}` };
      linhas.push(linha);
      visitar(codigo, nivel + 1, linha.caminho, linha.chave, new Set(visitados).add(codigo));
    }
  };
  visitar(null, 0, '', 'menu', new Set());
  return linhas;
}

/** O próprio item e todos os seus subitens (não podem ser escolhidos como pai dele). */
export function codigosDaSubarvore(codMenu: number, menus: MenuCadastro[]): Set<number> {
  const resultado = new Set<number>([codMenu]);
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const menu of menus) {
      if (menu.codMenuPai != null && resultado.has(menu.codMenuPai) && !resultado.has(menu.codMenu!)) {
        resultado.add(menu.codMenu!);
        cresceu = true;
      }
    }
  }
  return resultado;
}

/** Minúsculas e sem acentos, para filtros de texto. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
