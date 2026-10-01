import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';

import { SistemaResumo } from '../atualizacao/atualizacao.models';
import {
  Ambiente,
  Camada,
  ConsultaCredencial,
  Credencial,
  Hospedagem,
  Opcoes,
  Papel,
  Periodo,
  Servico,
  ServicoEdicao,
  Servidor,
  ServidorEdicao,
  ServicoSistemas,
  SistemaDoServico,
  SistemaInfra,
  TipoCredencial,
  TesteFonte,
  TesteWinRm,
  TipoServico,
} from './infraestrutura.models';

@Injectable({ providedIn: 'root' })
export class InfraestruturaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.ApiBaseUrl}infraestrutura`;

  opcoes() {
    return this.http.get<Opcoes>(`${this.api}/opcoes`);
  }

  // ---------------------------------------------------------------- ambientes

  ambientes() {
    return this.http.get<Ambiente[]>(`${this.api}/ambientes`);
  }

  salvarAmbiente(ambiente: Ambiente, novo: boolean) {
    return novo
      ? this.http.post<Ambiente>(`${this.api}/ambientes`, ambiente)
      : this.http.put<Ambiente>(`${this.api}/ambientes/${ambiente.codigo}`, ambiente);
  }

  excluirAmbiente(codigo: string) {
    return this.http.delete<void>(`${this.api}/ambientes/${codigo}`);
  }

  hospedagens() {
    return this.http.get<Hospedagem[]>(`${this.api}/hospedagens`);
  }

  salvarHospedagem(h: Hospedagem) {
    return h.codHospedagem
      ? this.http.put<Hospedagem>(`${this.api}/hospedagens/${h.codHospedagem}`, h)
      : this.http.post<Hospedagem>(`${this.api}/hospedagens`, h);
  }

  excluirHospedagem(cod: number) {
    return this.http.delete<void>(`${this.api}/hospedagens/${cod}`);
  }

  // ---------------------------------------------------------------- servidores e serviços

  tiposServico() {
    return this.http.get<TipoServico[]>(`${this.api}/tipos-servico`);
  }

  definirPapel(codTipo: number, papel: Papel | null) {
    return this.http.put<TipoServico>(`${this.api}/tipos-servico/${codTipo}/papel`, { papel });
  }

  servidores() {
    return this.http.get<Servidor[]>(`${this.api}/servidores`);
  }

  salvarServidor(codServidor: number | null, dados: ServidorEdicao) {
    return codServidor
      ? this.http.put<Servidor>(`${this.api}/servidores/${codServidor}`, dados)
      : this.http.post<Servidor>(`${this.api}/servidores`, dados);
  }

  salvarServico(codServidor: number, codProcesso: number | null, dados: ServicoEdicao) {
    return codProcesso
      ? this.http.put<Servico>(`${this.api}/servicos/${codProcesso}`, dados)
      : this.http.post<Servico>(`${this.api}/servidores/${codServidor}/servicos`, dados);
  }

  excluirServico(codProcesso: number) {
    return this.http.delete<void>(`${this.api}/servicos/${codProcesso}`);
  }

  // ---------------------------------------------------------------- WinRM (servidores Windows)

  /** Script PowerShell de preparação, já montado para o servidor e os IPs do NTI. */
  scriptWinRm(codServidor: number) {
    return this.http.get(`${this.api}/servidores/${codServidor}/winrm/script`, { responseType: 'text' });
  }

  testarWinRm(codServidor: number) {
    return this.http.post<TesteWinRm>(`${this.api}/servidores/${codServidor}/winrm/testar`, {});
  }

  /** Testa as fontes do modo de leitura do Windows (WinRM e/ou HB Service). */
  testarLeitura(codServidor: number) {
    return this.http.post<TesteFonte[]>(`${this.api}/servidores/${codServidor}/leitura/testar`, {});
  }

  // ---------------------------------------------------------------- cofre

  /** Exibe uma credencial; a consulta fica registrada no servidor. */
  revelarCredencial(codServidor: number, tipo: TipoCredencial) {
    return this.http.post<Credencial>(`${this.api}/servidores/${codServidor}/credenciais/${tipo}`, {});
  }

  consultasCredencial(codServidor: number) {
    return this.http.get<ConsultaCredencial[]>(`${this.api}/servidores/${codServidor}/credenciais/consultas`);
  }

  // ---------------------------------------------------------------- disponibilidade

  periodos(tipo: 'SERVIDOR' | 'SERVICO' | 'SISTEMA', codItem: number, dias = 30) {
    // Sistema: código do sistema no ambiente; rota própria para quem tem só a tela Sistemas e Serviços.
    const url = tipo === 'SISTEMA' ? `${this.api}/sistemas/ambientes/${codItem}/periodos` : `${this.api}/disponibilidade/${tipo}/${codItem}`;
    return this.http.get<Periodo[]>(url, { params: { dias } });
  }

  marcarPeriodo(codPeriodo: number, planejada: boolean, observacao: string | null) {
    return this.http.put<Periodo>(`${this.api}/disponibilidade/periodos/${codPeriodo}`, { planejada, observacao });
  }

  // ---------------------------------------------------------------- Sistemas e Serviços (F-2)

  sistemas() {
    return this.http.get<SistemaInfra[]>(`${this.api}/sistemas`);
  }

  sistema(codSistema: number) {
    return this.http.get<SistemaInfra>(`${this.api}/sistemas/${codSistema}`);
  }

  /** Cadastro (nome, ativo, módulos) no formato do diálogo de sistema. */
  cadastroSistemas() {
    return this.http.get<SistemaResumo[]>(`${this.api}/sistemas/cadastro`);
  }

  excluirSistema(codSistema: number) {
    return this.http.delete<void>(`${this.api}/sistemas/${codSistema}`);
  }

  salvarVersao(codSistema: number, ambiente: string, versao: string | null) {
    return this.http.put<SistemaInfra>(`${this.api}/sistemas/${codSistema}/ambientes/${ambiente}`, { versao });
  }

  excluirAmbienteDoSistema(codSistema: number, ambiente: string) {
    return this.http.delete<SistemaInfra>(`${this.api}/sistemas/${codSistema}/ambientes/${ambiente}`);
  }

  vincular(codSistema: number, ambiente: string, codProcesso: number, camada: Camada | null, essencial: boolean) {
    return this.http.post<SistemaInfra>(`${this.api}/sistemas/${codSistema}/ambientes/${ambiente}/servicos`, {
      codProcesso,
      camada,
      essencial,
    });
  }

  desvincular(codSistema: number, ambiente: string, codProcesso: number) {
    return this.http.delete<SistemaInfra>(`${this.api}/sistemas/${codSistema}/ambientes/${ambiente}/servicos/${codProcesso}`);
  }

  sistemasDoServico(codProcesso: number) {
    return this.http.get<ServicoSistemas>(`${this.api}/servicos/${codProcesso}/sistemas`);
  }

  salvarSistemasDoServico(codProcesso: number, sistemas: SistemaDoServico[]) {
    return this.http.put<ServicoSistemas>(`${this.api}/servicos/${codProcesso}/sistemas`, { sistemas });
  }
}
