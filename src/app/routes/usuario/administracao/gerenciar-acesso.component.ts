import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AcessoAdminService, TelaDTO, UsuarioDTO } from './AcessoAdminService';



@Component({
  selector: 'app-gerenciar-acesso',
  templateUrl: './gerenciar-acesso.component.html',
  styleUrls: ['./gerenciar-acesso.component.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatProgressSpinnerModule, MatTooltipModule,
    MatBadgeModule, MatDividerModule, MatSelectModule, MatSlideToggleModule,
  ]
})
export class GerenciarAcessoComponent implements OnInit, OnDestroy {

  // ── Dados ─────────────────────────────────────────────────────────────────
  usuarios: UsuarioDTO[] = [];
  usuariosFiltrados: UsuarioDTO[] = [];
  usuarioSelecionado: UsuarioDTO | null = null;

  telas: TelaDTO[] = [];
  telasFiltradas: TelaDTO[] = [];
  filtroTelas: 'todas' | 'com' | 'sem' = 'todas';

  // ── Copiar acessos ────────────────────────────────────────────────────────
  usuariosCopiasDestino: number[] = [];

  // ── Estados ───────────────────────────────────────────────────────────────
  carregandoUsuarios  = false;
  carregandoTelas     = false;
  atualizandoTelaId: number | null = null;
  copiando = false;

  buscaUsuario = new FormControl('');
  buscaTela    = new FormControl('');

  private destroy$ = new Subject<void>();

  constructor(
    private service: AcessoAdminService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.carregarUsuarios();

    this.buscaUsuario.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.filtrarUsuarios());

    this.buscaTela.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.filtrarTelas());
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ── Usuários ──────────────────────────────────────────────────────────────

  carregarUsuarios(): void {
    this.carregandoUsuarios = true;
    this.service.listarUsuarios().pipe(takeUntil(this.destroy$)).subscribe({
      next: (lista) => {
        this.usuarios = lista
          .filter(u => u.snativo)
          .sort((a, b) => a.nome.localeCompare(b.nome));
        this.filtrarUsuarios();
        this.carregandoUsuarios = false;
        this.cdr.detectChanges();
      },
      error: () => { this.toast('Erro ao carregar usuários.', 'error'); this.carregandoUsuarios = false; this.cdr.detectChanges(); }
    });
  }

  filtrarUsuarios(): void {
    const t = (this.buscaUsuario.value ?? '').toLowerCase();
    this.usuariosFiltrados = !t ? this.usuarios
      : this.usuarios.filter(u =>
          u.nome.toLowerCase().includes(t) ||
          u.login.toLowerCase().includes(t) ||
          u.email?.toLowerCase().includes(t));
  }

  selecionarUsuario(u: UsuarioDTO): void {
    this.usuarioSelecionado = u;
    this.telas = [];
    this.telasFiltradas = [];
    this.buscaTela.setValue('');
    this.filtroTelas = 'todas';
    this.cdr.detectChanges();
    this.carregarTelas(u.codUsuario);
  }

  // ── Telas ─────────────────────────────────────────────────────────────────

  carregarTelas(codUsuario: number): void {
    this.carregandoTelas = true;
    this.service.listarTelas(codUsuario).pipe(takeUntil(this.destroy$)).subscribe({
      next: (lista) => {
        this.telas = lista.sort((a, b) => a.dsTela.localeCompare(b.dsTela));
        this.filtrarTelas();
        this.carregandoTelas = false;
        this.cdr.detectChanges();
      },
      error: () => { this.toast('Erro ao carregar telas.', 'error'); this.carregandoTelas = false; this.cdr.detectChanges(); }
    });
  }

  filtrarTelas(): void {
    const t = (this.buscaTela.value ?? '').toLowerCase();
    let lista = this.telas;
    if (this.filtroTelas === 'com') lista = lista.filter(x => x.comAcesso);
    if (this.filtroTelas === 'sem') lista = lista.filter(x => !x.comAcesso);
    this.telasFiltradas = !t ? lista
      : lista.filter(x => x.dsTela.toLowerCase().includes(t) || x.rota?.toLowerCase().includes(t));
  }

  setFiltroTelas(f: 'todas' | 'com' | 'sem'): void {
    this.filtroTelas = f;
    this.filtrarTelas();
  }

  // ── Alternar acesso ───────────────────────────────────────────────────────

  toggleAcesso(tela: TelaDTO): void {
    if (!this.usuarioSelecionado) return;
    this.atualizandoTelaId = tela.codTela;

    if (tela.comAcesso && tela.codAcesso) {
      this.service.revogarAcesso(tela.codAcesso).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          tela.comAcesso = false;
          tela.codAcesso = null;
          this.atualizandoTelaId = null;
          this.cdr.detectChanges();
          this.toast(`Acesso à "${tela.dsTela}" revogado.`, 'info');
        },
        error: () => { this.atualizandoTelaId = null; this.cdr.detectChanges(); this.toast('Erro ao revogar acesso.', 'error'); }
      });
    } else {
      this.service.concederAcesso(this.usuarioSelecionado.codUsuario, tela.codTela)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: (dto) => {
            tela.comAcesso = true;
            tela.codAcesso = dto.codAcesso;
            this.atualizandoTelaId = null;
            this.cdr.detectChanges();
            this.toast(`Acesso à "${tela.dsTela}" concedido.`, 'success');
          },
          error: (e) => {
            this.atualizandoTelaId = null;
            this.cdr.detectChanges();
            this.toast(e?.error || 'Erro ao conceder acesso.', 'error');
          }
        });
    }
  }

  // ── Copiar acessos ────────────────────────────────────────────────────────

  copiarAcessos(): void {
    if (!this.usuarioSelecionado || !this.usuariosCopiasDestino.length) return;

    const destinosSemOrigem = this.usuariosCopiasDestino
      .filter(id => id !== this.usuarioSelecionado!.codUsuario);

    if (!destinosSemOrigem.length) {
      this.toast('Selecione ao menos um usuário destino diferente do origem.', 'error');
      return;
    }

    this.copiando = true;
    this.cdr.detectChanges();

    this.service.copiarAcessosLote(this.usuarioSelecionado.codUsuario, destinosSemOrigem)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.copiando = false;
          this.usuariosCopiasDestino = [];
          this.cdr.detectChanges();
          this.toast(res.mensagem, 'success');
        },
        error: () => {
          this.copiando = false;
          this.cdr.detectChanges();
          this.toast('Erro ao copiar acessos.', 'error');
        }
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  get totalComAcesso(): number { return this.telas.filter(t => t.comAcesso).length; }
  get totalSemAcesso(): number { return this.telas.filter(t => !t.comAcesso).length; }

  usuariosParaCopia(): UsuarioDTO[] {
    return this.usuarios.filter(u =>
      u.snativo && u.codUsuario !== this.usuarioSelecionado?.codUsuario
    );
  }

  // ── Avatar ────────────────────────────────────────────────────────────────

  /**
   * Retorna src da foto — igual ao dashboard:
   *  - foto base64 do banco → adiciona prefixo se necessário
   *  - foto null/vazia      → SVG com inicial (sem dependência de arquivo)
   */
  getFoto(u: UsuarioDTO): string {
    const foto = u.foto;
    if (!foto || foto === 'null' || foto.trim() === '') {
      return this.avatarSvg(u.nome);
    }
    // UsuarioDTO.getFoto() Java: adiciona prefixo base64 se não tiver
    if (!foto.startsWith('data:image')) {
      return 'data:image/jpeg;base64,' + foto;
    }
    return foto;
  }

  onImgError(event: Event, nome: string): void {
    (event.target as HTMLImageElement).src = this.avatarSvg(nome);
  }

  private avatarSvg(nome: string): string {
    const inicial = (nome || '?').charAt(0).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="#1976d2"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="18" font-weight="bold" font-family="Roboto,Arial,sans-serif">${inicial}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  private toast(msg: string, tipo: 'success' | 'error' | 'info'): void {
    this.snackBar.open(msg, 'Fechar', { duration: 4000, panelClass: [`snackbar-${tipo}`] });
  }
}
