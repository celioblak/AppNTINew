import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface UsuarioDTO {
  codUsuario: number;
  login: string;
  nome: string;
  email: string;
  foto?: string;
  snativo: boolean;    // @JsonProperty("snativo")
  snadmin: boolean;    // @JsonProperty("snadmin")
  matricula?: number;
  snPlantonista?: boolean;
}

export interface TelaDTO {
  codTela: number;
  dsTela: string;
  rota: string;
  comAcesso: boolean;
  codAcesso: number | null;
}

export interface AcessoAdminDTO {
  codAcesso: number;
  codUsuario: number;
  nomeUsuario: string;
  codTela: number;
  dsTela: string;
}

@Injectable({ providedIn: 'root' })
export class AcessoAdminService {

  private api = `${environment.ApiBaseUrl}acesso/admin`;

  constructor(private http: HttpClient) {}

  listarUsuarios(): Observable<UsuarioDTO[]> {
    return this.http.get<UsuarioDTO[]>(`${this.api}/usuarios`);
  }

  listarTelas(codUsuario: number): Observable<TelaDTO[]> {
    return this.http.get<TelaDTO[]>(`${this.api}/telas/${codUsuario}`);
  }

  concederAcesso(codUsuario: number, codTela: number): Observable<AcessoAdminDTO> {
    return this.http.post<AcessoAdminDTO>(`${this.api}/conceder`, { codUsuario, codTela });
  }

  revogarAcesso(codAcesso: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/revogar/${codAcesso}`);
  }

  copiarAcessos(origem: number, destino: number): Observable<{ copiados: number; mensagem: string }> {
    return this.http.post<{ copiados: number; mensagem: string }>(
      `${this.api}/copiar`,
      null,
      { params: { origem: origem.toString(), destino: destino.toString() } }
    );
  }

  copiarAcessosLote(origem: number, destinos: number[]): Observable<{ totalCopiados: number; totalIgnorados: number; mensagem: string }> {
    return this.http.post<{ totalCopiados: number; totalIgnorados: number; mensagem: string }>(
      `${this.api}/copiar-lote`,
      { origem, destinos }
    );
  }
}
