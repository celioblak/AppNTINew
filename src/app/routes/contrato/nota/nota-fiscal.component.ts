import {
  Component, OnInit, OnDestroy, inject,
  ChangeDetectorRef, TemplateRef, ViewChild, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { forkJoin, Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { Contrato, NotaFiscal as NotaFiscalBase } from '@core';

// Extensão local com campos adicionados ao backend neste módulo
interface NotaFiscal extends NotaFiscalBase {
  snAvulsa?:     string;   // 'S' = avulsa, 'N' = com contrato
  temVinculo?:   boolean;  // true se possui ao menos 1 contrato vinculado
  centrosCusto?: { cdSetor: string; nmSetor: string }[];
  descricaoServico?: string;
  /** Resumo dos contratos vinculados, usado no tooltip da linha. */
  contratosVinculados?: { empresa?: string; sistema?: string; valorRateio?: number; percentualRateio?: number }[];
}
import { NotaFiscalService } from './nota-fiscal.service';
import { ContratoService } from '../contrato/contrato.service';
import { formatarCnpjCpf as formatarDocumento, limparCnpj } from '@shared/utils/cnpj';

/** Minúsculas, sem acentos e com espaços simples — para pesquisa textual. */
function normalizarBusca(texto?: string): string {
  return (texto || '').normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── Upload múltiplo ──────────────────────────────────────────────
interface ArquivoUpload {
  file:       File;
  status:     'pendente' | 'processando' | 'sucesso' | 'erro' | 'duplicado';
  mensagem?:  string;
  nota?:      NotaFiscal;
}

// ── Modelo interno do item de contrato na aba ────────────────────
interface ItemContrato {
  contrato:   Contrato;
  selecionado: boolean;
  valor:      number;   // valor rateado absoluto
  percentual: number;   // percentual rateado (0-100)
}

interface CentroCusto {
  cdSetor: string;
  nmSetor: string;
}

type AbaDetalhe = 'detalhes' | 'contratos' | 'pdf';

@Component({
  selector: 'app-nota-fiscal',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatCardModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatTableModule, MatTabsModule, MatCheckboxModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDividerModule,
    MatDatepickerModule,
  ],
  templateUrl: './nota-fiscal.component.html',
  styleUrls: ['./nota-fiscal.component.scss']
})
export class NotaFiscalComponent implements OnInit, OnDestroy {

  @ViewChild('dialogUpload')  tmplUpload!:  TemplateRef<unknown>;
  @ViewChild('dialogDetalhe') tmplDetalhe!: TemplateRef<unknown>;

  private readonly cdr       = inject(ChangeDetectorRef);
  private readonly snackBar  = inject(MatSnackBar);
  private readonly dialog    = inject(MatDialog);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroy$  = new Subject<void>();

  private refUpload:  MatDialogRef<unknown> | null = null;
  private refDetalhe: MatDialogRef<unknown> | null = null;

  // ── Tabela ───────────────────────────────────────────────────────
  colunas = ['avaliacao','numeroNfse','competencia','dataEmissao','criadoEm','nomeEmpresarial',
             'cnpjCpfNif','valorServico','origemDados','acoes'];

  notas:          NotaFiscal[] = [];
  notasFiltradas: NotaFiscal[] = [];
  filtroOrigem      = '';
  filtroTexto       = '';
  filtroCompetencia = '';               // filtro server-side por competência
  competenciasDisponiveis: string[] = []; // populado ao iniciar
  filtroImportadoDe:  Date | null = null; // período de importação (CRIADO_EM) — server-side
  filtroImportadoAte: Date | null = null;
  private periodoAplicado = '|';          // evita recarregar se o período não mudou
  carregandoLista = false;

  // ── Upload ───────────────────────────────────────────────────────
  arquivoSelecionado: File | null = null;   // mantido para compatibilidade

  // Upload múltiplo
  arquivosSelecionados: ArquivoUpload[] = [];
  filaConcluidaComResultado = false;   // exibe botão OK e "Processar novas notas"
  carregando = false;
  dragOver   = false;

  // Alternativa ao upload: cadastro só pela chave de acesso (consulta ADN/Sefin)
  chaveAcessoInput = '';
  processandoChave = false;

  // ── Detalhe ──────────────────────────────────────────────────────
  notaSelecionada: NotaFiscal | null = null;

  // ── PDF ──────────────────────────────────────────────────────────
  pdfUrl:     SafeResourceUrl | null = null;
  pdfBlobUrl: string          | null = null;
  carregandoPdf = false;

  // ── Contratos / Rateio ───────────────────────────────────────────
  itensContrato:    ItemContrato[] = [];
  filtroContrato    = '';
  intercorrencias   = '';
  carregandoContratos  = false;
  salvandoTudo         = false;
  notaAvulsa           = false;   // true = salvar sem vínculo de contrato

  onToggleAvulso(): void {
    if (this.notaAvulsa) {
      // Desmarca todos os contratos ao ativar avulso
      this.itensContrato.forEach(i => i.selecionado = false);
    }
  }

  // Nota avulsa: centros de custo vinculados diretamente
  centrosAvulso:    CentroCusto[] = [];
  setoresDisponiveis: CentroCusto[] = [];
  termoBuscaSetor   = '';
  buscandoSetores   = false;
  mostrarDropdown   = false;

  // Nota avulsa: edição da descrição do serviço
  editandoDescricao = false;
  descricaoEditada  = '';

  // Edição completa dos campos da nota
  editandoDetalhes = false;
  detalheEditado: {
    numeroNfse?:       string;
    competencia?:      string;
    dataEmissao?:      string;
    cnpjCpfNif?:       string;
    nomeEmpresarial?:  string;
    descricaoServico?: string;
    valorServico?:     number;
  } = {};

  readonly coresRateio = [
    '#1976d2','#388e3c','#f57c00','#7b1fa2',
    '#c62828','#00838f','#558b2f','#ad1457'
  ];

  /**
   * Lista exibida na aba Contratos, filtrada pela pesquisa. Um mesmo CNPJ costuma
   * ter vários contratos (um por sistema), então a busca cobre empresa, sistema,
   * descrição, CNPJ e centros de custo; cada palavra digitada precisa casar.
   * Contratos já selecionados continuam visíveis para não "sumirem" do rateio.
   */
  get itensContratoFiltrados(): ItemContrato[] {
    const termos = normalizarBusca(this.filtroContrato).split(' ').filter(Boolean);
    if (termos.length === 0) return this.itensContrato;
    return this.itensContrato.filter(i => {
      if (i.selecionado) return true;
      const c = i.contrato;
      const texto = normalizarBusca([
        c.empresa, c.sistema, c.descricao, c.cnpj, c.cnpjFormatado,
        ...(c.centrosCusto ?? []).map(cc => `${cc.cdSetor} ${cc.nmSetor}`)
      ].filter(Boolean).join(' '));
      return termos.every(t => texto.includes(t));
    });
  }

  trackContrato(_: number, item: ItemContrato): number | undefined {
    return item.contrato.id;
  }

  get contratosSelecionados(): ItemContrato[] {
    return this.itensContrato.filter(i => i.selecionado);
  }

  /** Saldo = valorNota - soma dos valores rateados. Deve ser 0 ao salvar. */
  get saldoRateio(): number {
    const total = this.notaSelecionada?.valorServico ?? 0;
    const soma  = this.contratosSelecionados.reduce((s, i) => s + (i.valor || 0), 0);
    return parseFloat((total - soma).toFixed(2));
  }

  // ── Ciclo de vida ────────────────────────────────────────────────
  constructor(
    private notaFiscalService: NotaFiscalService,
    private contratoService:   ContratoService,
  ) {}

  ngOnInit(): void {
    setTimeout(() => {
      this.carregarNotas();
      this.carregarCompetencias();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.limparBlobUrl();
  }

  private toast(msg: string, tipo: 'success'|'error'|'warning'|'info' = 'info'): void {
    this.snackBar.open(msg, 'Fechar', {
      duration: 5000,
      panelClass: `snackbar-${tipo}`,
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  // ── Lista ────────────────────────────────────────────────────────

  carregarNotas(): void {
    this.aplicarResultado(() => { this.carregandoLista = true; });
    this.notaFiscalService.listarComFiltros(
      this.filtroCompetencia || undefined,
      undefined,
      this.filtroOrigem || undefined,
      this.formatarDataFiltro(this.filtroImportadoDe),
      this.formatarDataFiltro(this.filtroImportadoAte)
    )
      .pipe(
        finalize(() => this.aplicarResultado(() => { this.carregandoLista = false; })),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (notas) => this.aplicarResultado(() => { this.notas = notas; this.aplicarFiltro(); }),
        error: (err)  => this.aplicarResultado(() => this.toast(err.message, 'error'))
      });
  }

  /**
   * Recarrega só quando o período mudou — o seletor dispara dateChange e closed
   * na mesma seleção. Aceita só início ("a partir de") ou só fim ("até").
   */
  aplicarPeriodoImportacao(): void {
    const periodo = `${this.formatarDataFiltro(this.filtroImportadoDe) ?? ''}|${this.formatarDataFiltro(this.filtroImportadoAte) ?? ''}`;
    if (periodo === this.periodoAplicado) return;
    this.periodoAplicado = periodo;
    this.carregarNotas();
  }

  limparPeriodoImportacao(): void {
    this.filtroImportadoDe  = null;
    this.filtroImportadoAte = null;
    this.aplicarPeriodoImportacao();
  }

  /** Date do seletor → yyyy-MM-dd, pela data local (sem conversão de fuso). */
  private formatarDataFiltro(data: Date | null): string | undefined {
    if (!data || isNaN(data.getTime())) return undefined;
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
  }

  /**
   * Diferimento padrão pra evitar NG0100 (ExpressionChangedAfterItHasBeenCheckedError)
   * quando carregarNotas() é chamado de dentro de outro callback de subscribe (ex: após
   * enviar/remover uma nota) e o backend responde rápido o bastante pra cair na mesma
   * janela de verificação do change detection que originou a chamada.
   */
  private aplicarResultado(atualizar: () => void): void {
    setTimeout(() => {
      atualizar();
      this.cdr.detectChanges();
    });
  }

  carregarCompetencias(): void {
    this.notaFiscalService.listarCompetencias()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cs) => { this.competenciasDisponiveis = cs; this.cdr.markForCheck(); },
        error: () => {}
      });
  }

  onFiltroCompetenciaChange(comp: string): void {
    this.filtroCompetencia = comp;
    this.carregarNotas();
  }

  onFiltroOrigemChange(origem: string): void {
    this.filtroOrigem = origem;
    this.carregarNotas();
  }

  filtrar(texto: string): void { this.filtroTexto = texto.toLowerCase(); this.aplicarFiltro(); }

  aplicarFiltro(): void {
    // cnpjCpfNif fica armazenado sem pontuação (e, no CNPJ alfanumérico, com
    // letras maiúsculas) — se o usuário digitar o CNPJ formatado (com ./-), o
    // texto nunca casaria direto via .includes(). Compara separadamente a
    // versão limpa do texto contra o CNPJ/CPF.
    const docFiltro = limparCnpj(this.filtroTexto);

    this.notasFiltradas = this.notas.filter(n => {
      const t = !this.filtroTexto ||
        (n.numeroNfse      || '').toLowerCase().includes(this.filtroTexto) ||
        (n.nomeEmpresarial || '').toLowerCase().includes(this.filtroTexto) ||
        (n.cnpjCpfNif      || '').toLowerCase().includes(this.filtroTexto) ||
        (!!docFiltro && (n.cnpjCpfNif || '').toUpperCase().includes(docFiltro));
      const o = !this.filtroOrigem || n.origemDados === this.filtroOrigem;
      return t && o;
    });
  }

  // ── Upload ───────────────────────────────────────────────────────

  abrirUpload(): void {
    this.arquivoSelecionado        = null;
    this.arquivosSelecionados      = [];
    this.filaConcluidaComResultado = false;
    this.carregando = false;
    this.chaveAcessoInput = '';
    // Foco manual (não autoFocus do CDK) — o conteúdo vem de um ng-template
    // embutido no overlay do dialog, e o autoFocus por seletor CSS do CDK
    // mostrou timing inconsistente com esse conteúdo. Foco explícito via
    // querySelector depois do dialog abrir é mais previsível.
    this.refUpload = this.dialog.open(this.tmplUpload, {
      width: '480px',
      disableClose: true,
      autoFocus: false
    });
    this.refUpload.afterOpened().subscribe(() => {
      setTimeout(() => {
        document.querySelector<HTMLTextAreaElement>('.paste-target')?.focus();
      });
    });
  }

  fecharUpload(): void { this.refUpload?.close(); }

  /**
   * Cola uma imagem da área de transferência (Ctrl+V) — alternativa a
   * anexar arquivo, útil pra print/foto da NF-e. Dois caminhos de captura
   * (mais confiável que depender de só um): o (paste) da textarea
   * .paste-target (focada ao abrir o dialog, ver abrirUpload) E este
   * listener em nível de window, como reforço caso o foco da textarea
   * falhe silenciosamente por algum motivo específico do navegador.
   */
  @HostListener('window:paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (!this.refUpload || this.processandoFila) return;

    const item = Array.from(event.clipboardData?.items || [])
      .find(i => i.type.startsWith('image/'));
    if (!item) return;

    const blob = item.getAsFile();
    if (!blob) return;

    event.preventDefault();

    // Normaliza SEMPRE pra PNG via canvas — a origem da cópia (Outlook/Word
    // costuma colocar bitmap nativo do Windows, ex: image/bmp) não confiável
    // por si só: o backend só aceita PNG/JPEG/WEBP, e simplesmente renomear
    // a extensão sem converter os bytes reais deixa o arquivo com a extensão
    // errada por dentro. Convertendo sempre garante um formato aceito,
    // independente do app de origem.
    this.converterParaPng(blob)
      .then(arquivo => {
        this.adicionarArquivos([arquivo]);
        this.toast('Imagem colada — adicionada à fila.', 'success');
      })
      .catch(() => {
        this.toast('Não foi possível processar a imagem colada. Tente salvar e anexar o arquivo.', 'error');
      });
  }

  /**
   * true quando o navegador suporta a Clipboard API assíncrona
   * (navigator.clipboard.read) — só existe em contexto seguro (HTTPS ou
   * localhost). Usado pra decidir se mostra o botão "Colar da área de
   * transferência", que não depende de foco em elemento nenhum (dispara
   * direto no clique, que já é o gesto do usuário exigido pela API).
   */
  get suportaColarClipboard(): boolean {
    return typeof ClipboardItem !== 'undefined' && !!(navigator.clipboard && (navigator.clipboard as any).read);
  }

  /**
   * Alternativa ao Ctrl+V — lê a área de transferência direto no clique do
   * botão. Mais confiável que o listener de 'paste' (ver onPaste): aquele
   * depende do foco estar numa textarea invisível antes do Ctrl+V, e o
   * navegador simplesmente não dispara o evento "paste" se o foco não
   * estiver num elemento editável — sem foco, sem evento, sem erro nenhum
   * no console (foi exatamente o sintoma relatado). Clicar no botão já É
   * o gesto do usuário, então não depende de nenhum foco prévio.
   */
  async colarImagemClipboard(): Promise<void> {
    if (this.processandoFila) return;
    try {
      const itens = await navigator.clipboard.read();
      for (const item of itens) {
        const tipoImagem = item.types.find(t => t.startsWith('image/'));
        if (!tipoImagem) continue;
        const blob = await item.getType(tipoImagem);
        const arquivo = await this.converterParaPng(blob);
        this.adicionarArquivos([arquivo]);
        this.toast('Imagem colada — adicionada à fila.', 'success');
        return;
      }
      this.toast('Nenhuma imagem encontrada na área de transferência.', 'warning');
    } catch (e) {
      this.toast('Não foi possível acessar a área de transferência. Copie a imagem novamente e tente de novo, ou anexe o arquivo.', 'error');
    }
  }

  /** Redesenha a imagem colada num canvas e exporta como PNG — normaliza qualquer formato de origem (ver onPaste). */
  private converterParaPng(blob: Blob): Promise<File> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas indisponível')); return; }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(pngBlob => {
          URL.revokeObjectURL(url);
          if (!pngBlob) { reject(new Error('Falha ao converter a imagem')); return; }
          resolve(new File([pngBlob], `colado-${Date.now()}.png`, { type: 'image/png' }));
        }, 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
      img.src = url;
    });
  }

  novasNotas(): void {
    // Limpa fila mantendo o dialog aberto para adicionar novos arquivos
    this.arquivosSelecionados      = [];
    this.arquivoSelecionado        = null;
    this.filaConcluidaComResultado = false;
    this.chaveAcessoInput          = '';
    this.cdr.markForCheck();
  }

  /** Cadastra a NF-e só pela chave de acesso, sem precisar do PDF/XML em mãos. */
  processarChaveAcesso(): void {
    const chave = this.chaveAcessoInput.trim();
    if (!chave || this.processandoChave) return;

    this.processandoChave = true;
    this.carregando = true;
    this.cdr.markForCheck();

    this.notaFiscalService.processarPorChaveAcesso(chave)
      .pipe(
        finalize(() => { this.processandoChave = false; this.carregando = false; this.cdr.detectChanges(); }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (nota) => {
          this.chaveAcessoInput = '';
          this.fecharUpload();
          this.toast(`NF-e Nº ${nota.numeroNfse || nota.id} importada com sucesso!`, 'success');
          this.carregarNotas();
          this.abrirDetalhes(nota, 'contratos');
        },
        error: (err: any) => {
          const msg = err?.message
            || err?.error?.erro
            || err?.error?.error
            || err?.error?.message
            || `Erro ${err?.status || ''}`;
          this.toast(msg, 'error');
        }
      });
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.adicionarArquivos(files);
    input.value = '';
  }

  onDragOver(e: DragEvent): void  { e.preventDefault(); e.stopPropagation(); this.dragOver = true; }
  onDragLeave(e: DragEvent): void { e.preventDefault(); e.stopPropagation(); this.dragOver = false; }
  onDrop(e: DragEvent): void {
    e.preventDefault(); e.stopPropagation(); this.dragOver = false;
    const files = Array.from(e.dataTransfer?.files || []);
    this.adicionarArquivos(files);
  }

  private static readonly EXTENSOES_IMAGEM = ['.png', '.jpg', '.jpeg', '.webp'];

  adicionarArquivos(files: File[]): void {
    const validos = files.filter(f => {
      const nome = f.name.toLowerCase();
      const ehImagem = NotaFiscalComponent.EXTENSOES_IMAGEM.some(ext => nome.endsWith(ext));
      if (!nome.endsWith('.pdf') && !nome.endsWith('.xml') && !ehImagem) {
        this.toast(`${f.name}: apenas PDF, XML ou imagem (PNG/JPEG/WEBP) são aceitos`, 'error'); return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        this.toast(`${f.name}: excede 10MB`, 'error'); return false;
      }
      if (this.arquivosSelecionados.find(a => a.file.name === f.name && a.file.size === f.size))
        return false;
      return true;
    });
    this.arquivosSelecionados = [
      ...this.arquivosSelecionados,
      ...validos.map(f => ({ file: f, status: 'pendente' as const }))
    ];
    this.arquivoSelecionado = this.arquivosSelecionados[0]?.file ?? null;
    this.cdr.markForCheck();
  }

  removerArquivoDaFila(idx: number): void {
    this.arquivosSelecionados = this.arquivosSelecionados.filter((_, i) => i !== idx);
    this.arquivoSelecionado = this.arquivosSelecionados[0]?.file ?? null;
  }

  private selecionarArquivo(f: File): void {
    this.adicionarArquivos([f]);
  }

  get totalPendentes(): number {
    return this.arquivosSelecionados.filter(a => a.status === 'pendente').length;
  }
  get totalProcessados(): number {
    return this.arquivosSelecionados.filter(a => ['sucesso','erro','duplicado'].includes(a.status)).length;
  }
  get processandoFila(): boolean {
    return this.arquivosSelecionados.some(a => a.status === 'processando');
  }
  get totalSucesso(): number {
    return this.arquivosSelecionados.filter(a => a.status === 'sucesso').length;
  }
  get totalDuplicado(): number {
    return this.arquivosSelecionados.filter(a => a.status === 'duplicado').length;
  }
  get totalErro(): number {
    return this.arquivosSelecionados.filter(a => a.status === 'erro').length;
  }

  /** PDF, XML e imagem usam endpoints diferentes no backend — decide pela extensão do arquivo. */
  private uploadArquivo(file: File) {
    const nome = file.name.toLowerCase();
    if (nome.endsWith('.xml')) return this.notaFiscalService.uploadXml(file);
    if (NotaFiscalComponent.EXTENSOES_IMAGEM.some(ext => nome.endsWith(ext))) {
      return this.notaFiscalService.uploadImagem(file);
    }
    return this.notaFiscalService.uploadPdf(file);
  }

  enviarArquivo(): void {
    if (this.arquivosSelecionados.length === 0) return;

    // Se apenas 1 arquivo: comportamento original (abre detalhe ao terminar)
    if (this.arquivosSelecionados.length === 1) {
      const item = this.arquivosSelecionados[0];
      item.status = 'processando';
      this.carregando = true;
      this.cdr.markForCheck();

      this.uploadArquivo(item.file)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (nota) => {
            item.status = 'sucesso';
            this.carregando = false;
            this.fecharUpload();
            this.toast(`NF-e Nº ${nota.numeroNfse || nota.id} importada com sucesso!`, 'success');
            this.carregarNotas();
            this.abrirDetalhes(nota, 'contratos');
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            const msg = err?.message
              || err?.error?.erro
              || err?.error?.error
              || err?.error?.message
              || `Erro ${err?.status || ''}`;
            const isDup = msg.toLowerCase().includes('já cadastrada')
              || msg.toLowerCase().includes('ja cadastrada')
              || (err?.status === 409);
            item.status   = isDup ? 'duplicado' : 'erro';
            item.mensagem = msg;
            this.carregando = false;
            this.filaConcluidaComResultado = true;
            this.cdr.detectChanges();
          }
        });
      return;
    }

    // Múltiplos arquivos: processa fila sequencialmente
    this.processarFila();
  }

  processarFila(): void {
    const pendentes = this.arquivosSelecionados.filter(a => a.status === 'pendente');
    if (pendentes.length === 0) {
      const ok  = this.arquivosSelecionados.filter(a => a.status === 'sucesso').length;
      const err = this.arquivosSelecionados.filter(a => a.status === 'erro').length;
      const dup = this.arquivosSelecionados.filter(a => a.status === 'duplicado').length;
      this.carregando = false;
      this.filaConcluidaComResultado = true;   // exibe botões OK / Novas Notas
      this.carregarNotas();
      this.cdr.detectChanges();
      return;
    }

    const item = pendentes[0];
    item.status = 'processando';
    this.carregando = true;
    this.cdr.markForCheck();

    this.uploadArquivo(item.file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (nota) => {
          item.status   = 'sucesso';
          item.nota     = nota;
          item.mensagem = `NF-e #${nota.numeroNfse || nota.id}`;
          this.cdr.markForCheck();
          this.processarFila();
        },
        error: (err: any) => {
          // Extrai mensagem legível — pode vir como Error.message (interceptor)
          // ou diretamente do HttpErrorResponse.error.erro/error
          const msg = err?.message
            || err?.error?.erro
            || err?.error?.error
            || err?.error?.message
            || `Erro ${err?.status || ''}`;
          const isDup = msg.toLowerCase().includes('já cadastrada')
            || msg.toLowerCase().includes('ja cadastrada')
            || (err?.status === 409);
          item.status   = isDup ? 'duplicado' : 'erro';
          item.mensagem = msg;
          this.cdr.markForCheck();
          this.processarFila();
        }
      });
  }

  // ── Dialog Detalhe ───────────────────────────────────────────────

 abrirDetalhes(nota: NotaFiscal, aba: AbaDetalhe = 'detalhes'): void {
  this.limparBlobUrl();
  this.itensContrato      = [];
  this.filtroContrato     = '';
  this.termoBuscaSetor    = '';
  this.setoresDisponiveis = [];

  // Busca nota completa do backend para garantir intercorrências, snAvulsa e centrosCusto
  this.notaFiscalService.buscarPorId(nota.id!)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (notaCompleta: NotaFiscal) => {
        this.notaSelecionada   = notaCompleta;
        this.intercorrencias   = notaCompleta.intercorrencias || '';
        this.notaAvulsa        = notaCompleta.snAvulsa === 'S';
        this.centrosAvulso     = notaCompleta.centrosCusto ?? [];
        this.editandoDescricao = false;
        this.descricaoEditada  = notaCompleta.descricaoServico || '';
        this.cdr.markForCheck();
      },
      error: () => {
        // fallback: usa objeto da grid
        this.notaSelecionada   = nota;
        this.intercorrencias   = nota.intercorrencias || '';
        this.notaAvulsa        = nota.snAvulsa === 'S';
        this.centrosAvulso     = nota.centrosCusto ?? [];
        this.editandoDescricao = false;
        this.descricaoEditada  = nota.descricaoServico || '';
      }
    });

  // Abre o dialog imediatamente (dados carregam em paralelo) — visão unificada e ampla
  this.refDetalhe = this.dialog.open(this.tmplDetalhe, {
    width: '1700px', maxWidth: '98vw', maxHeight: '94vh',
    panelClass: 'dialog-detalhe-panel',
  });

  // Carrega contratos e PDF em paralelo — PDF sempre, pois agora é visível direto na visão unificada
  this.carregarContratosNota(nota);
  this.carregarPdfPreview(nota);

  // Rola até o painel relevante (mantém o comportamento dos botões de atalho da grid)
  setTimeout(() => {
    document.getElementById('painel-' + aba)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, 80);

  this.refDetalhe.afterClosed()
    .pipe(takeUntil(this.destroy$))
    .subscribe(() => { this.limparBlobUrl(); this.notaSelecionada = null; });
}

 getCentrosCusto(c: Contrato): any[] {
    return c?.centrosCusto ?? [];
  }

  /** Retorna true se a nota já foi avaliada (tem contrato OU é avulsa) */
  notaAvaliada(nota: NotaFiscal): boolean {
    return nota.snAvulsa === 'S' || nota.temVinculo === true;
  }

  tooltipAvaliacao(nota: NotaFiscal): string {
    if (nota.snAvulsa === 'S') return 'Nota avulsa (sem contrato)';
    if (nota.temVinculo === true) return 'Contrato vinculado';
    return 'Aguardando avaliação';
  }

  /** Tooltip da linha da grid: empresa, serviço e o que está vinculado à nota. */
  tooltipLinha(nota: NotaFiscal): string {
    const linhas: string[] = [nota.nomeEmpresarial || 'Empresa não informada'];

    const servico = (nota.descricaoServico || '').trim();
    linhas.push('', 'Serviço:', servico.length > 350 ? servico.slice(0, 350) + '…' : (servico || '—'));

    if (nota.snAvulsa === 'S') {
      const centros = (nota.centrosCusto ?? []).map(cc => `• ${cc.cdSetor} - ${cc.nmSetor}`);
      linhas.push('', 'Nota avulsa — centros de custo:', ...(centros.length ? centros : ['—']));
    } else if (nota.contratosVinculados?.length) {
      linhas.push('', 'Contratos vinculados:', ...nota.contratosVinculados.map(c => {
        const identificacao = [c.empresa, c.sistema].filter(Boolean).join(' — ') || 'Contrato';
        const percentual = c.percentualRateio != null
          ? ` (${Number(c.percentualRateio).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)`
          : '';
        const rateio = c.valorRateio != null ? ` · ${this.formatarValor(c.valorRateio)}${percentual}` : '';
        return `• ${identificacao}${rateio}`;
      }));
    } else {
      linhas.push('', 'Sem contrato vinculado (aguardando avaliação)');
    }

    return linhas.join('\n');
  }

  onAbaChange(index: number): void {
    if (!this.notaSelecionada) return;
    // Aba contratos: carrega se ainda não carregou (ou estava vazio e não está carregando)
    if (index === 1 && !this.carregandoContratos && this.itensContrato.length === 0)
      this.carregarContratosNota(this.notaSelecionada);
    if (index === 2 && !this.pdfUrl)
      this.carregarPdfPreview(this.notaSelecionada);
  }

  fecharDetalhes(): void { this.refDetalhe?.close(); }

  // ── Contratos / Rateio ───────────────────────────────────────────

  /**
   * Carrega em paralelo:
   * 1. Todos os contratos do CNPJ da nota (disponíveis para vínculo)
   * 2. Contratos já vinculados (com valores de rateio)
   *
   * Monta os itensContrato combinando os dois resultados.
   */
  private carregarContratosNota(nota: NotaFiscal): void {
    if (!nota.id) return;
    this.carregandoContratos = true;
    this.itensContrato = [];
    this.filtroContrato = '';
    const cnpj = nota.cnpjCpfNif || '';

    forkJoin({
      todos:      this.contratoService.listarPorCnpj(cnpj),
      vinculados: this.notaFiscalService.listarContratos(nota.id)
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ todos, vinculados }) => {

        // vinculados vem como ContratoDTO com valorRateio/percentualRateio extras
        // O cruzamento é feito pelo id do contrato
        const mapVinculados = new Map<number, any>(
          vinculados.map((c: any) => [c.id, c])
        );

        // Se todos estiver vazio mas vinculados não, usa vinculados como base
        // (caso o CNPJ da nota não corresponda a nenhum contrato disponível)
        const base = todos.length > 0 ? todos : vinculados;

        this.itensContrato = base.map((c: any) => {
          const vinc  = mapVinculados.get(c.id);
          // valorRateio pode estar no próprio objeto (quando vem de vinculados)
          // ou no objeto vinculado cruzado
          const valor = vinc?.valorRateio ?? c.valorRateio ?? 0;
          const total = nota.valorServico ?? 0;
          const perc  = vinc?.percentualRateio
            ?? (total > 0 && valor > 0 ? parseFloat(((valor / total) * 100).toFixed(4)) : 0);

          return {
            contrato:    c,
            selecionado: !!vinc || !!c.valorRateio,
            valor:       valor,
            percentual:  perc
          };
        });

        // Restaura estado de avulso e centros de custo já salvos
        if (nota.snAvulsa === 'S') {
          this.notaAvulsa    = true;
          this.centrosAvulso = nota.centrosCusto ?? [];
        }

        this.carregandoContratos = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Erro ao carregar contratos:', err);
        this.carregandoContratos = false;
        this.toast('Erro ao carregar contratos', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  onToggleContrato(item: ItemContrato): void {
    if (!item.selecionado) {
      item.valor = 0;
      item.percentual = 0;
    }
    // Redistribui igualmente ao marcar/desmarcar
    if (this.contratosSelecionados.length > 0) {
      this.distribuirRateioIgual();
    }
  }

  /** Ao alterar percentual → recalcula valor */
  onPercentualChange(item: ItemContrato): void {
    const total = this.notaSelecionada?.valorServico ?? 0;
    if (!total) return;
    item.percentual = Math.min(100, Math.max(0, item.percentual || 0));
    item.valor = parseFloat(((total * item.percentual) / 100).toFixed(2));
  }

  /** Ao alterar valor → recalcula percentual */
  onValorChange(item: ItemContrato): void {
    const total = this.notaSelecionada?.valorServico ?? 0;
    if (!total) return;
    item.valor = Math.min(total, Math.max(0, item.valor || 0));
    item.percentual = parseFloat(((item.valor / total) * 100).toFixed(4));
  }

  /** Distribui o valor total igualmente entre os contratos selecionados */
  distribuirRateioIgual(): void {
    const total    = this.notaSelecionada?.valorServico ?? 0;
    const selecionados = this.contratosSelecionados;
    if (!total || selecionados.length === 0) return;

    const perc  = parseFloat((100 / selecionados.length).toFixed(4));
    const valor = parseFloat((total / selecionados.length).toFixed(2));

    selecionados.forEach((item, i) => {
      item.percentual = perc;
      item.valor      = valor;
    });

    // Ajusta último para consumir o saldo restante (evita diferença de centavos)
    const soma = selecionados.reduce((s, i) => s + i.valor, 0);
    const diff = parseFloat((total - soma).toFixed(2));
    if (diff !== 0 && selecionados.length > 0) {
      selecionados[selecionados.length - 1].valor =
        parseFloat((selecionados[selecionados.length - 1].valor + diff).toFixed(2));
    }
  }

  // ── Nota avulsa: busca de setores ────────────────────────────────
  onBuscaSetor(termo: string): void {
    this.termoBuscaSetor = termo;
    if (termo.length < 2) { this.setoresDisponiveis = []; return; }
    this.buscandoSetores = true;
    this.mostrarDropdown = true;
    this.contratoService.listarSetores(termo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (setores: any[]) => {
          this.setoresDisponiveis = setores.map((s: any) => ({
            cdSetor: s.cdSetor, nmSetor: s.nmSetor
          }));
          this.buscandoSetores = false;
        },
        error: () => { this.buscandoSetores = false; }
      });
  }

  adicionarCCAvulso(cc: CentroCusto): void {
    if (!this.centrosAvulso.find(c => c.cdSetor === cc.cdSetor)) {
      this.centrosAvulso = [...this.centrosAvulso, cc];
    }
    this.termoBuscaSetor  = '';
    this.setoresDisponiveis = [];
    this.mostrarDropdown  = false;
  }

  removerCCAvulso(cc: CentroCusto): void {
    this.centrosAvulso = this.centrosAvulso.filter(c => c.cdSetor !== cc.cdSetor);
  }

  // ── Edição completa dos detalhes ─────────────────────────────────

  iniciarEdicaoDetalhes(): void {
    if (!this.notaSelecionada) return;
    this.detalheEditado = {
      numeroNfse:       this.notaSelecionada.numeroNfse       || '',
      competencia:      this.notaSelecionada.competencia      || '',
      dataEmissao:      this.notaSelecionada.dataEmissao      || '',
      cnpjCpfNif:       this.notaSelecionada.cnpjCpfNif       || '',
      nomeEmpresarial:  this.notaSelecionada.nomeEmpresarial  || '',
      descricaoServico: this.notaSelecionada.descricaoServico || '',
      valorServico:     this.notaSelecionada.valorServico      ?? undefined,
    };
    this.editandoDetalhes  = true;
    this.editandoDescricao = false; // fecha o modo inline se estiver aberto
    this.cdr.markForCheck();
  }

  cancelarEdicaoDetalhes(): void {
    this.editandoDetalhes = false;
    this.detalheEditado   = {};
    this.cdr.markForCheck();
  }

  salvarDetalhes(): void {
    if (!this.notaSelecionada?.id) return;

    this.notaFiscalService.atualizarNota(this.notaSelecionada.id, this.detalheEditado)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notaAtualizada: NotaFiscal) => {
          // Atualiza objeto local
          this.notaSelecionada = { ...this.notaSelecionada!, ...notaAtualizada };
          this.editandoDetalhes = false;
          this.detalheEditado   = {};

          // Propaga para a grid
          const idx = this.notas.findIndex(n => n.id === this.notaSelecionada!.id);
          if (idx >= 0) {
            this.notas[idx] = { ...this.notas[idx], ...notaAtualizada };
            this.notas = [...this.notas];
            this.aplicarFiltro();
          }
          this.toast('Nota fiscal atualizada com sucesso!', 'success');
          this.cdr.markForCheck();
        },
        error: (err: Error) => this.toast(err.message || 'Erro ao salvar', 'error')
      });
  }

  iniciarEdicaoDescricao(): void {
    this.descricaoEditada  = this.notaSelecionada?.descricaoServico || '';
    this.editandoDescricao = true;
  }

  confirmarEdicaoDescricao(): void {
    if (!this.notaSelecionada?.id) return;

    this.notaFiscalService.atualizarDescricao(this.notaSelecionada.id, this.descricaoEditada)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notaAtualizada: NotaFiscal) => {
          // Atualiza objeto local
          this.notaSelecionada = { ...this.notaSelecionada!, descricaoServico: notaAtualizada.descricaoServico };
          this.editandoDescricao = false;

          // Propaga para a grid
          const idx = this.notas.findIndex(n => n.id === this.notaSelecionada!.id);
          if (idx >= 0) {
            this.notas[idx] = { ...this.notas[idx], descricaoServico: notaAtualizada.descricaoServico };
            this.notas = [...this.notas];
            this.aplicarFiltro();
          }
          this.toast('Descrição atualizada com sucesso!', 'success');
          this.cdr.markForCheck();
        },
        error: (err: Error) => {
          this.toast(err.message || 'Erro ao salvar descrição', 'error');
        }
      });
  }

  cancelarEdicaoDescricao(): void {
    this.editandoDescricao = false;
  }

  /** Salva vínculos + intercorrências em uma única ação */
  salvarTudo(): void {
    if (!this.notaSelecionada?.id) return;

    // Deve ter ao menos um contrato vinculado OU estar marcada como nota avulsa
    if (this.contratosSelecionados.length === 0 && !this.notaAvulsa) {
      this.toast('Selecione ao menos um contrato ou marque como "Nota Avulsa".', 'warning');
      return;
    }
    // Nota avulsa requer ao menos 1 centro de custo
    if (this.notaAvulsa && this.centrosAvulso.length === 0) {
      this.toast('Nota avulsa requer ao menos um Centro de Custo vinculado.', 'warning');
      return;
    }

    // Valida saldo se há mais de um contrato
    if (this.contratosSelecionados.length > 1 && this.saldoRateio !== 0) {
      this.toast(`Ajuste o rateio. Saldo pendente: ${this.formatarValor(this.saldoRateio)}`, 'warning');
      return;
    }

    this.salvandoTudo = true;

    const idContratos = this.contratosSelecionados.map(i => i.contrato.id!);
    const rateios = this.contratosSelecionados
      .filter(i => i.contrato.id != null)
      .map(i => ({
        idContrato:  i.contrato.id!,
        valor:       i.valor,
        percentual:  i.percentual
      }));

    this.notaFiscalService.salvarVinculoEIntercorrencias(
      this.notaSelecionada.id,
      idContratos,
      this.intercorrencias,
      rateios,
      this.notaAvulsa,
      this.centrosAvulso
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.toast('Contratos e intercorrências salvos com sucesso!', 'success');
        this.salvandoTudo = false;

        // Atualiza o objeto local na grid para refletir avaliação sem recarregar tudo
        if (this.notaSelecionada) {
          this.notaSelecionada.intercorrencias = this.intercorrencias;
          this.notaSelecionada.snAvulsa        = this.notaAvulsa ? 'S' : 'N';
          this.notaSelecionada.temVinculo      = this.notaAvulsa
            || this.contratosSelecionados.length > 0;
          // Mantém o tooltip da linha coerente com o que acabou de ser salvo
          this.notaSelecionada.centrosCusto        = this.notaAvulsa ? [...this.centrosAvulso] : [];
          this.notaSelecionada.contratosVinculados = this.notaAvulsa
            ? []
            : this.contratosSelecionados.map(i => ({
                empresa:          i.contrato.empresa,
                sistema:          i.contrato.sistema,
                valorRateio:      i.valor,
                percentualRateio: i.percentual
              }));

          // Propaga a mudança para o array da grid
          // Novo array obriga o Angular (OnPush) a detectar mudança
          const idx = this.notas.findIndex(n => n.id === this.notaSelecionada!.id);
          if (idx >= 0) {
            this.notas[idx] = { ...this.notas[idx], ...this.notaSelecionada };
            this.notas = [...this.notas];   // novo array → change detection
            this.aplicarFiltro();
          }
        }
        this.cdr.detectChanges();   // força re-render imediato
      },
      error: (err: Error) => {
        this.toast(err.message, 'error');
        this.salvandoTudo = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── PDF ──────────────────────────────────────────────────────────

  carregarPdfPreview(nota: NotaFiscal): void {
    if (!nota.id) return;
    this.limparBlobUrl();
    this.carregandoPdf = true;
    this.notaFiscalService.baixarPdf(nota.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          this.pdfBlobUrl = window.URL.createObjectURL(blob);
          this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl);
          this.carregandoPdf = false;
          this.cdr.detectChanges();
        },
        error: () => { this.carregandoPdf = false; this.cdr.detectChanges(); }
      });
  }

  private limparBlobUrl(): void {
    if (this.pdfBlobUrl) { window.URL.revokeObjectURL(this.pdfBlobUrl); this.pdfBlobUrl = null; }
    this.pdfUrl = null;
  }

  abrirPdfNovaAba(nota: NotaFiscal | null): void {
    if (!nota?.id) return;
    if (this.pdfBlobUrl) { window.open(this.pdfBlobUrl, '_blank'); return; }
    this.notaFiscalService.baixarPdf(nota.id).pipe(takeUntil(this.destroy$))
      .subscribe({ next: (b: Blob) => window.open(window.URL.createObjectURL(b), '_blank') });
  }

  baixarPdf(nota: NotaFiscal | null, event?: Event): void {
    if (event) event.stopPropagation();
    if (!nota?.id) return;
    this.notaFiscalService.baixarPdf(nota.id).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href = url;
          a.download = nota.nomeArquivoPdf || `nfse-${nota.numeroNfse || nota.id}.pdf`;
          a.click(); window.URL.revokeObjectURL(url);
        }
      });
  }

  gerarRelatorio(nota: NotaFiscal, event?: Event): void {
    if (event) event.stopPropagation();
    if (!nota?.id) return;

    // Obtém idUsuario do localStorage (padrão do projeto)
    const idUsuario = Number(localStorage.getItem('idUsuario') || '1');

    this.notaFiscalService.baixarRelatorio(nota.id, idUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const emp  = (nota.nomeEmpresarial || 'empresa').replace(/[^a-zA-Z0-9À-ÿ\s]/g,'').trim();
          const nf   = nota.numeroNfse || nota.id?.toString() || '';
          const url  = window.URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href     = url;
          a.download = `Relatorio de Prestacao de Servico ${emp} - NF ${nf}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err: Error) => this.toast(err.message, 'error')
      });
  }

  // ── Remoção ──────────────────────────────────────────────────────

  remover(nota: NotaFiscal, event: Event): void {
    event.stopPropagation();
    if (!nota.id || !confirm(`Remover NF-e Nº ${nota.numeroNfse || nota.id}?`)) return;
    this.notaFiscalService.remover(nota.id).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast('NF-e removida', 'success');
          if (this.notaSelecionada?.id === nota.id) this.fecharDetalhes();
          this.carregarNotas();
        },
        error: (err) => this.toast(err.message, 'error')
      });
  }

  // ── Formatadores ─────────────────────────────────────────────────

  // CNPJ pode ser alfanumérico (IN RFB 2.229/2024)
  formatarCnpjCpf(doc?: string): string {
    return doc ? formatarDocumento(doc) : '—';
  }

  // A chave embute o CNPJ do emitente — pode conter letras
  formatarChave(c?: string): string { return c ? c.replace(/([0-9A-Za-z]{4})/g,'$1 ').trim() : '—'; }

  formatarValor(v?: number | null): string {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  }

  formatarData(d?: string): string { return d ? new Date(d).toLocaleString('pt-BR') : '—'; }

  formatarTamanho(b?: number): string {
    if (!b) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
    return (b/(1024*1024)).toFixed(2) + ' MB';
  }

  /**
   * Único ponto de mapeamento de origemDados → label/classe/sigla — evita as
   * três funções divergirem entre si (era o que causava SEFIN/PDF_FORMULARIO/
   * XML_DIRETO caindo no "—"/badge-neutro mesmo sendo origens válidas).
   * Valores reais atribuídos pelo backend (NotaFiscalService): ADN, SEFIN,
   * PDF_EXTRACAO, PDF_FORMULARIO, PDF_OCR, XML_DIRETO, IMAGEM_OCR. MANUAL nunca é
   * gravado hoje, mas fica mapeado para o dia em que existir cadastro manual.
   */
  private static readonly ORIGEM_INFO: { [origem: string]: { label: string; classe: string; sigla: string } } = {
    ADN:             { label: 'Consulta oficial (ADN)',        classe: 'badge-sucesso', sigla: 'ADN' },
    SEFIN:           { label: 'Consulta oficial (Sefin)',      classe: 'badge-info',    sigla: 'SEFIN' },
    PDF_EXTRACAO:    { label: 'Extraído do PDF (texto)',       classe: 'badge-aviso',   sigla: 'PDF' },
    PDF_FORMULARIO:  { label: 'Extraído do PDF (formulário)',  classe: 'badge-aviso',   sigla: 'PDF' },
    PDF_OCR:         { label: 'Extraído do PDF (OCR)',         classe: 'badge-aviso',   sigla: 'OCR' },
    IMAGEM_OCR:      { label: 'Extraído de imagem (OCR)',      classe: 'badge-aviso',   sigla: 'OCR' },
    XML_DIRETO:      { label: 'Extraído do XML',               classe: 'badge-info',    sigla: 'XML' },
    MANUAL:          { label: 'Cadastro manual',                classe: 'badge-neutro', sigla: 'MANUAL' },
  };

  obterLabelOrigem(o?: string): string {
    return (o && NotaFiscalComponent.ORIGEM_INFO[o]?.label) || '—';
  }

  obterClasseOrigem(o?: string): string {
    return (o && NotaFiscalComponent.ORIGEM_INFO[o]?.classe) || 'badge-neutro';
  }

  obterSiglaOrigem(o?: string): string {
    return (o && NotaFiscalComponent.ORIGEM_INFO[o]?.sigla) || '—';
  }
}
