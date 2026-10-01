import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';

export interface TelaCadastro {
  codTela?: number | null;
  dsTela: string;
  dsModulo: string | null;
  dsGrupoMenu: string | null;
  snAtivo: boolean;
  roles: string | null;
  /** Usuários com acesso liberado (TB_ACESSO). */
  qtdAcessos?: number;
  /** Itens de menu vinculados. */
  qtdMenus?: number;
}

/** M = agrupador (submenu), T = tela (link), R = rota oculta (fora do menu, mas libera acesso). */
export type TipoMenu = 'M' | 'T' | 'R';

export interface MenuCadastro {
  codMenu?: number | null;
  /** Nulo = raiz do menu. */
  codMenuPai: number | null;
  tipo: TipoMenu;
  /** Chave de tradução (menu.<pais>.<nome> no i18n). */
  nome: string;
  /** Trecho da URL; a URL completa junta as rotas dos pais. */
  rota: string;
  icone: string | null;
  ordem: number | null;
  codTela: number | null;
  dsTela?: string | null;
  qtdFilhos?: number;
}

@Injectable({ providedIn: 'root' })
export class TelasMenuService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.ApiBaseUrl}admin/telas-menu`;

  permissao() {
    return this.http.get<{ admin: boolean }>(`${this.apiUrl}/permissao`);
  }

  listarTelas() {
    return this.http.get<TelaCadastro[]>(`${this.apiUrl}/telas`);
  }

  salvarTela(tela: TelaCadastro) {
    return tela.codTela
      ? this.http.put<TelaCadastro>(`${this.apiUrl}/telas/${tela.codTela}`, tela)
      : this.http.post<TelaCadastro>(`${this.apiUrl}/telas`, tela);
  }

  excluirTela(codTela: number) {
    return this.http.delete<void>(`${this.apiUrl}/telas/${codTela}`);
  }

  listarMenus() {
    return this.http.get<MenuCadastro[]>(`${this.apiUrl}/menus`);
  }

  salvarMenu(menu: MenuCadastro) {
    return menu.codMenu
      ? this.http.put<MenuCadastro>(`${this.apiUrl}/menus/${menu.codMenu}`, menu)
      : this.http.post<MenuCadastro>(`${this.apiUrl}/menus`, menu);
  }

  excluirMenu(codMenu: number) {
    return this.http.delete<void>(`${this.apiUrl}/menus/${codMenu}`);
  }
}
