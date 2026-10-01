import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { GrupoServidorResumo } from '@core';
import { environment } from '@env/environment';

export interface GrupoServidorEdicao {
  codGrupoServidor?: number | null;
  dsGrupo: string;
}

@Injectable({ providedIn: 'root' })
export class GrupoServidorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.ApiBaseUrl}servidor/grupo`;

  listar() {
    return this.http.get<GrupoServidorResumo[]>(`${this.apiUrl}/resumo`);
  }

  salvar(grupo: GrupoServidorEdicao) {
    return grupo.codGrupoServidor
      ? this.http.put<GrupoServidorResumo>(`${this.apiUrl}/${grupo.codGrupoServidor}`, grupo)
      : this.http.post<GrupoServidorResumo>(this.apiUrl, grupo);
  }

  excluir(codGrupoServidor: number) {
    return this.http.delete<void>(`${this.apiUrl}/${codGrupoServidor}`);
  }
}
