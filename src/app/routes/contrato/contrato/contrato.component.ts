import {
  Component, OnInit, OnDestroy, inject,
  ChangeDetectorRef, TemplateRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CentroCusto, Contrato, Setor } from '@core';
import { formatarCnpjCpf, isCnpjValido, isFormatoCnpj, limparCnpj, mascararCnpj } from '@shared/utils/cnpj';
import { ContratoService } from './contrato.service';

@Component({
  selector: 'app-contrato',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatCardModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatTableModule, MatChipsModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatTooltipModule, MatMenuModule, MatDividerModule,
  ],
  templateUrl: './contrato.component.html',
  styleUrls: ['./contrato.component.scss']
})
export class ContratoComponent implements OnInit, OnDestroy {

  @ViewChild('dialogForm') tmplForm!: TemplateRef<unknown>;

  private readonly cdr      = inject(ChangeDetectorRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog   = inject(MatDialog);
  private readonly destroy$ = new Subject<void>();
  private readonly buscaSetor$ = new Subject<string>();
  private refForm: MatDialogRef<unknown> | null = null;

  // ── Tabela ─────────────────────────────────────────────────────
  colunas = ['empresa','cnpj','sistema','centrosCusto','snAtivo','acoes'];
  contratos:           Contrato[]     = [];
  contratoSelecionado: Contrato|null  = null;
  carregandoLista = false;
  apenasAtivos    = true;

  // ── Formulário ─────────────────────────────────────────────────
  modoEdicao = false;
  carregando = false;
  form: Partial<Contrato> = {};

  // ── Setores ────────────────────────────────────────────────────
  setoresDisponiveis: Setor[] = [];
  termoBuscaSetor    = '';
  buscandoSetores    = false;
  mostrarDropdownSetor = false;

  constructor(private contratoService: ContratoService) {}

  ngOnInit(): void {
    this.carregarContratos();
    this.buscaSetor$.pipe(
      debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)
    ).subscribe(termo => this.buscarSetores(termo));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private toast(msg: string, tipo: 'success'|'error'|'warning'|'info' = 'info'): void {
    this.snackBar.open(msg, 'Fechar', {
      duration: 4000,
      panelClass: `snackbar-${tipo}`,
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  // ── Lista ───────────────────────────────────────────────────────
  carregarContratos(): void {
    this.carregandoLista = true;
    this.contratoService.listar(this.apenasAtivos)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.contratos = lista;
          this.carregandoLista = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toast(err.message, 'error');
          this.carregandoLista = false;
          this.cdr.detectChanges();
        }
      });
  }

  pesquisar(termo: string): void {
    if (!termo.trim()) { this.carregarContratos(); return; }
    this.carregandoLista = true;
    this.contratoService.pesquisar(termo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => { this.contratos = lista; this.carregandoLista = false; this.cdr.detectChanges(); },
        error: (err)  => { this.toast(err.message, 'error'); this.carregandoLista = false; }
      });
  }

  selecionarContrato(c: Contrato): void {
    this.contratoSelecionado = this.contratoSelecionado?.id === c.id ? null : c;
  }

  // ── Formulário ──────────────────────────────────────────────────
  abrirFormulario(): void {
    this.modoEdicao = false;
    this.form = { empresa:'', cnpj:'', sistema:'', descricao:'', snAtivo:'S', centrosCusto:[] };
    this.termoBuscaSetor = '';
    this.setoresDisponiveis = [];
    this.refForm = this.dialog.open(this.tmplForm, { width:'680px', disableClose: true });
  }

  editarContrato(c: Contrato): void {
    this.modoEdicao = true;
    this.form = { ...c, centrosCusto: [...(c.centrosCusto || [])] };
    this.termoBuscaSetor = '';
    this.setoresDisponiveis = [];
    this.refForm = this.dialog.open(this.tmplForm, { width:'680px', disableClose: true });
  }

  cancelarFormulario(): void { this.refForm?.close(); }

  salvar(): void {
    if (!isFormatoCnpj(this.form.cnpj)) {
      this.toast('CNPJ deve ter 14 caracteres: 12 letras/números + 2 dígitos verificadores', 'error'); return;
    }
    if (!isCnpjValido(this.form.cnpj)) { this.toast('CNPJ inválido: dígitos verificadores não conferem', 'error'); return; }
    if (!this.form.empresa?.trim()) { this.toast('Nome da empresa é obrigatório', 'error'); return; }

    this.carregando = true;
    const dto = this.form as Contrato;

    const req$ = this.modoEdicao && dto.id
      ? this.contratoService.atualizar(dto.id, dto)
      : this.contratoService.criar(dto);

    req$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast(this.modoEdicao ? 'Contrato atualizado!' : 'Contrato cadastrado!', 'success');
        this.carregando = false;
        this.refForm?.close();
        this.carregarContratos();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toast(err.message, 'error');
        this.carregando = false;
        this.cdr.detectChanges();
      }
    });
  }

  alternarAtivo(c: Contrato): void {
    if (!c.id) return;
    this.contratoService.alternarAtivo(c.id).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.toast('Status alterado', 'success'); this.carregarContratos(); },
        error: (err) => this.toast(err.message, 'error')
      });
  }

  remover(c: Contrato): void {
    if (!c.id) return;
    if (!confirm(`Remover contrato "${c.empresa}"?`)) return;
    this.contratoService.remover(c.id).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast('Contrato removido', 'success');
          if (this.contratoSelecionado?.id === c.id) this.contratoSelecionado = null;
          this.carregarContratos();
        },
        error: (err) => this.toast(err.message, 'error')
      });
  }

  // ── Setores ─────────────────────────────────────────────────────
  onBuscaSetorChange(termo: string): void {
    this.termoBuscaSetor = termo;
    this.mostrarDropdownSetor = termo.length >= 1;
    this.buscaSetor$.next(termo);
  }

  private buscarSetores(termo: string): void {
    this.buscandoSetores = true;
    this.contratoService.listarSetores(termo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (setores) => {
          const ativos = (this.form.centrosCusto || []).map(cc => cc.cdSetor);
          this.setoresDisponiveis = setores.filter(s => !ativos.includes(s.cdSetor));
          this.buscandoSetores = false;
          this.cdr.markForCheck();
        },
        error: () => { this.buscandoSetores = false; }
      });
  }

  adicionarSetor(s: Setor): void {
    if (!this.form.centrosCusto) this.form.centrosCusto = [];
    if (!this.form.centrosCusto.some(cc => cc.cdSetor === s.cdSetor)) {
      this.form.centrosCusto.push({ cdSetor: s.cdSetor, nmSetor: s.nmSetor });
    }
    this.termoBuscaSetor = '';
    this.mostrarDropdownSetor = false;
    this.setoresDisponiveis = [];
  }

  removerCentroCusto(cc: CentroCusto): void {
    if (!this.form.centrosCusto) return;
    this.form.centrosCusto = this.form.centrosCusto.filter(c => c.cdSetor !== cc.cdSetor);
  }

  fecharDropdownSetor(): void {
    setTimeout(() => { this.mostrarDropdownSetor = false; }, 200);
  }

  // ── Formatadores ────────────────────────────────────────────────
  // CNPJ pode ser alfanumérico (IN RFB 2.229/2024): letras nas 12 primeiras posições
  formatarCnpj(cnpj?: string): string {
    return formatarCnpjCpf(cnpj);
  }

  mascaraCnpj(event: Event): void {
    const input = event.target as HTMLInputElement;
    const v = mascararCnpj(input.value);
    input.value = v;
    if (this.form) this.form.cnpj = limparCnpj(v);
  }
}
