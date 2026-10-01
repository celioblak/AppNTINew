import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';

export type TipoParametro = 'TEXTO' | 'NUMERO' | 'SIM_NAO' | 'URL' | 'LISTA_IP' | 'SEGREDO' | 'DATA';
export type EfeitoParametro = 'IMEDIATO' | 'UM_MINUTO' | 'REINICIAR';

/** Parâmetro de TB_CONFIGURACAO (docs/parametros.md). Segredo vem sem valor, só "cadastrado". */
export interface Parametro {
  chave: string;
  grupo: string;
  descricao: string | null;
  tipo: TipoParametro;
  valor: string | null;
  cadastrado: boolean;
  padrao: string | null;
  usandoPadrao: boolean;
  minimo: number | null;
  maximo: number | null;
  segredo: boolean;
  /** Mantido pelo sistema: só leitura. */
  interno: boolean;
  /** O sistema não funciona sem valor. */
  obrigatorio: boolean;
  efeito: EfeitoParametro;
  alteradoPor: string | null;
  alteradoEm: string | number | null;
}

export interface ParametroNovo {
  chave: string;
  grupo: string;
  tipo: TipoParametro;
  descricao: string;
  valor: string | null;
  padrao: string | null;
  minimo: number | null;
  maximo: number | null;
  obrigatorio: boolean;
  efeito: EfeitoParametro;
}

export interface HistoricoParametro {
  acao: 'CRIOU' | 'ALTEROU' | 'PADRAO';
  valorAnterior: string | null;
  valorNovo: string | null;
  usuario: string | null;
  quando: string | number;
}

export const ROTULO_TIPO: Record<TipoParametro, string> = {
  TEXTO: 'Texto',
  NUMERO: 'Número',
  SIM_NAO: 'Sim/Não',
  URL: 'Endereço (URL)',
  LISTA_IP: 'Lista de IPs',
  SEGREDO: 'Segredo (senha, token)',
  DATA: 'Data',
};

export const ROTULO_EFEITO: Record<EfeitoParametro, string> = {
  IMEDIATO: 'Vale na hora',
  UM_MINUTO: 'Vale em até 1 minuto',
  REINICIAR: 'Exige reiniciar o ntiapi',
};

@Injectable({ providedIn: 'root' })
export class ParametrosService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.ApiBaseUrl}parametros`;

  listar() {
    return this.http.get<Parametro[]>(this.api);
  }

  salvar(chave: string, valor: string | null) {
    return this.http.put<Parametro>(`${this.api}/${encodeURIComponent(chave)}`, { valor });
  }

  voltarAoPadrao(chave: string) {
    return this.http.post<Parametro>(`${this.api}/${encodeURIComponent(chave)}/padrao`, {});
  }

  criar(dados: ParametroNovo) {
    return this.http.post<Parametro>(this.api, dados);
  }

  historico(chave: string) {
    return this.http.get<HistoricoParametro[]>(`${this.api}/${encodeURIComponent(chave)}/historico`);
  }
}
