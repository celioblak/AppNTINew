import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

import { semTratamentoDeErro } from '@core';
import { environment } from '@env/environment';
import { ServidorDto } from '@core';
import { ChamadosResposta, ImpactosResposta, LocksResposta, RequisicaoResposta } from './painel.models';

/**
 * Endpoints do painel de TV. Todos estão liberados sem autenticação no backend
 * (SecurityConfiguration: /api/painel/**), porque a tela fica ligada numa TV sem login.
 *
 * Cada chamada marca `semTratamentoDeErro()`: uma falha de rede não pode abrir toast
 * nem mandar o painel para a tela de login.
 *
 * O erro sobe para quem chamou de propósito. Devolver lista vazia na falha faria a
 * TV apagar os problemas da tela e mostrar "tudo certo" justamente quando o painel
 * perdeu contato com a API — alarme falso ao contrário, e o pior tipo, porque
 * ninguém desconfia de uma tela limpa. As telas seguram o último dado bom e deixam
 * o indicador de idade acusar que parou de atualizar.
 */
@Injectable({ providedIn: 'root' })
export class PainelService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.ApiBaseUrl}painel/`;

  private get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}${endpoint}`, { context: semTratamentoDeErro() });
  }

  /** Incidentes sem técnico + chamados novos do dia. */
  incidentes(): Observable<ChamadosResposta> {
    return this.get<ChamadosResposta>('incidentes');
  }

  /** Requisições pendentes com os contadores por situação. */
  requisicoes(): Observable<RequisicaoResposta> {
    return this.get<RequisicaoResposta>('requisicao');
  }

  /** Requisições abertas hoje. */
  requisicoesDoDia(): Observable<ChamadosResposta> {
    return this.get<ChamadosResposta>('requisicao/hoje');
  }

  /** Servidores monitorados, já ordenados por load por núcleo e uso de disco. */
  servidores(): Observable<ServidorDto[]> {
    return this.get<ServidorDto[]>('servidor');
  }

  /** Servidores/serviços fora do ar e os sistemas que cada um derruba. */
  impactos(): Observable<ImpactosResposta> {
    return this.get<ImpactosResposta>('impactos');
  }

  /** Sessões Oracle em lock. */
  locks(): Observable<LocksResposta> {
    return this.get<LocksResposta>('locks');
  }

  /**
   * Configuração TTS_PAINEL: o `valor` é a URL do serviço de voz.
   * Aqui a falha é tolerada — sem configuração o painel apenas não fala.
   */
  configTts(): Observable<{ valor?: string } | null> {
    return this.get<{ valor?: string } | null>('configuracao/tts').pipe(
      catchError(erro => {
        console.error('Painel: falha ao ler a configuração de voz', erro);
        return of(null);
      })
    );
  }
}
