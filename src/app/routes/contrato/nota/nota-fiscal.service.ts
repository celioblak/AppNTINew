import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Contrato, NotaFiscal } from '@core';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class NotaFiscalService {

  private apiUrl = `${environment.ApiBaseUrl}nota-fiscal`;

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    let msg = 'Erro desconhecido ao processar a requisição';
    if (error.error?.erro)         msg = error.error.erro;
    else if (error.error?.message) msg = error.error.message;
    else if (error.message)        msg = error.message;
    const err = new Error(msg);
    (err as any).status = error.status;
    return throwError(() => err);
  }

  // ── NF-e ────────────────────────────────────────────────────────

  // idUsuario não é mais enviado pelo cliente — o backend resolve o usuário
  // criador a partir do token autenticado (ver NotaFiscalController.usuarioLogadoId).

  uploadPdf(arquivo: File): Observable<NotaFiscal> {
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    return this.http.post<NotaFiscal>(`${this.apiUrl}/upload`, fd)
      .pipe(catchError(this.handleError));
  }

  /**
   * Processa a NF-e a partir do arquivo XML nacional (mesmo schema do ADN).
   * Extração direta/estruturada — mais confiável que o PDF quando disponível.
   */
  uploadXml(arquivo: File): Observable<NotaFiscal> {
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    return this.http.post<NotaFiscal>(`${this.apiUrl}/upload-xml`, fd)
      .pipe(catchError(this.handleError));
  }

  /**
   * Processa a NF-e a partir de uma imagem (foto/print colado ou anexado).
   * OCR local (Tesseract) no backend — menos confiável que PDF/XML/chave,
   * usar como último recurso quando não há nenhum desses em mãos.
   */
  uploadImagem(arquivo: File): Observable<NotaFiscal> {
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    return this.http.post<NotaFiscal>(`${this.apiUrl}/upload-imagem`, fd)
      .pipe(catchError(this.handleError));
  }

  /**
   * Cadastra a NF-e consultando ADN/Sefin Nacional só pela chave de acesso —
   * sem precisar do PDF ou XML em mãos.
   */
  processarPorChaveAcesso(chaveAcesso: string): Observable<NotaFiscal> {
    return this.http.post<NotaFiscal>(`${this.apiUrl}/por-chave-acesso`, {
      chaveAcesso
    }).pipe(catchError(this.handleError));
  }

  listar(): Observable<NotaFiscal[]> {
    return this.http.get<NotaFiscal[]>(this.apiUrl)
      .pipe(catchError(this.handleError));
  }

  listarComFiltros(
    competencia?: string,
    texto?: string,
    origemDados?: string,
    importadoDe?: string,    // yyyy-MM-dd, inclusivo
    importadoAte?: string    // yyyy-MM-dd, inclusivo
  ): Observable<NotaFiscal[]> {
    let params: any = {};
    if (competencia)  params['competencia']  = competencia;
    if (texto)        params['texto']        = texto;
    if (origemDados)  params['origemDados']  = origemDados;
    if (importadoDe)  params['importadoDe']  = importadoDe;
    if (importadoAte) params['importadoAte'] = importadoAte;
    return this.http.get<NotaFiscal[]>(this.apiUrl, { params })
      .pipe(catchError(this.handleError));
  }

  listarCompetencias(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/competencias`)
      .pipe(catchError(this.handleError));
  }

  atualizarDescricao(id: number, descricaoServico: string): Observable<NotaFiscal> {
    return this.http.patch<NotaFiscal>(`${this.apiUrl}/${id}/descricao`, { descricaoServico })
      .pipe(catchError(this.handleError));
  }

  /** Atualiza qualquer campo da nota — usado para edição manual de notas não-padrão */
  atualizarNota(id: number, dados: {
    numeroNfse?:       string;
    competencia?:      string;
    dataEmissao?:      string;
    cnpjCpfNif?:       string;
    nomeEmpresarial?:  string;
    descricaoServico?: string;
    valorServico?:     number;   // BigDecimal no backend, serializado como number no JSON
  }): Observable<NotaFiscal> {
    return this.http.patch<NotaFiscal>(`${this.apiUrl}/${id}`, dados)
      .pipe(catchError(this.handleError));
  }

  buscarPorId(id: number): Observable<NotaFiscal> {
    return this.http.get<NotaFiscal>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  remover(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  baixarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/pdf/download`, { responseType: 'blob' })
      .pipe(catchError(this.handleError));
  }

  // ── Contratos vinculados ─────────────────────────────────────────

  listarContratos(idNota: number): Observable<Contrato[]> {
    return this.http.get<Contrato[]>(`${this.apiUrl}/${idNota}/contratos`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Endpoint unificado: salva vínculos + intercorrências + rateio
   * em uma única transação. PUT /nota-fiscal/{id}/vinculos
   */
  salvarVinculoEIntercorrencias(
    idNota: number,
    idContratos: number[],
    intercorrencias: string,
    rateios: { idContrato: number; valor: number; percentual: number }[],
    avulsa: boolean = false,
    centrosAvulso: { cdSetor: string; nmSetor: string }[] = []
  ): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${idNota}/vinculos`, {
      idContratos,
      intercorrencias,
      rateios,
      avulsa,
      centrosAvulso
    }).pipe(catchError(this.handleError));
  }

  // ── Relatório ────────────────────────────────────────────────────

  baixarRelatorio(idNota: number, idUsuario = 1): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/${idNota}/relatorio?idUsuario=${idUsuario}`,
      { responseType: 'blob' }
    ).pipe(catchError(this.handleError));
  }
}
