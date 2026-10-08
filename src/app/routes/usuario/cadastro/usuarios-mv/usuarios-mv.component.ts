import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HotToastService } from '@ngxpert/hot-toast';

import { UsuarioCadastro } from '../usuario-cadastro.service';
import { SituacaoUsuarioMv, UsuarioMv, UsuariosMvService } from './usuarios-mv.service';

type FiltroSituacao = 'TODOS' | SituacaoUsuarioMv;

/**
 * Aba "Usuários MV" do Cadastro de Usuário: de-para entre o nome do responsável
 * que chega nos tickets MV e os usuários do AppNTI (docs/de-para-usuarios-mv.md, T-01).
 */
@Component({
  selector: 'app-usuarios-mv',
  standalone: true,
  templateUrl: './usuarios-mv.component.html',
  styleUrls: ['./usuarios-mv.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
})
export class UsuariosMvComponent implements OnInit {
  private readonly service = inject(UsuariosMvService);
  private readonly toast = inject(HotToastService);

  /** Usuários do cadastro (a tela pai já carrega); só os ativos podem ser vinculados. */
  @Input() set usuarios(lista: UsuarioCadastro[] | null) {
    this.usuariosAtivos = (lista ?? [])
      .filter(u => u.snAtivo && u.codUsuario != null)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }
  /** Quantidade de pendentes, para o número na aba. */
  @Output() pendentesChange = new EventEmitter<number>();

  usuariosAtivos: UsuarioCadastro[] = [];
  linhas: UsuarioMv[] = [];
  carregando = false;
  reprocessando = false;

  busca = '';
  filtro: FiltroSituacao = 'TODOS';

  /** Linha com o campo de usuário aberto (pendente sempre tem o campo; vinculado só ao clicar em Alterar). */
  editandoId: number | null = null;
  /** Texto digitado no campo de usuário de cada linha. */
  textoUsuario: Record<number, string> = {};
  /** Linha com ação em andamento (desabilita os botões dela). */
  salvandoId: number | null = null;

  readonly rotulos: Record<SituacaoUsuarioMv, string> = {
    PENDENTE: 'Pendente',
    AUTOMATICO: 'Automático',
    MANUAL: 'Vinculado',
    SEM_APPNTI: 'Não usa o AppNTI',
  };

  readonly icones: Record<SituacaoUsuarioMv, string> = {
    PENDENTE: 'help_outline',
    AUTOMATICO: 'flash_on',
    MANUAL: 'done',
    SEM_APPNTI: 'block',
  };

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.service.listar().subscribe({
      next: lista => {
        this.linhas = lista ?? [];
        this.carregando = false;
        this.emitirPendentes();
      },
      error: err => {
        this.carregando = false;
        this.toast.error(this.mensagemErro(err, 'Não foi possível carregar os usuários MV.'));
      },
    });
  }

  // ── Filtros ───────────────────────────────────────────────────────────

  contar(situacao: SituacaoUsuarioMv): number {
    return this.linhas.filter(l => l.situacao === situacao).length;
  }

  get linhasFiltradas(): UsuarioMv[] {
    const termo = this.normalizar(this.busca);
    return this.linhas.filter(l => {
      if (this.filtro !== 'TODOS' && l.situacao !== this.filtro) return false;
      if (!termo) return true;
      return this.normalizar(`${l.nmMv} ${l.nomeUsuario ?? ''}`).includes(termo);
    });
  }

  /** Usuários ativos que contêm o texto digitado (sem acento/maiúsculas). */
  opcoesUsuario(l: UsuarioMv): UsuarioCadastro[] {
    const termo = this.normalizar(this.textoUsuario[l.codUsuarioMv] ?? '');
    const lista = termo
      ? this.usuariosAtivos.filter(u => this.normalizar(`${u.nome} ${u.login}`).includes(termo))
      : this.usuariosAtivos;
    return lista.slice(0, 30);
  }

  mostraCampoUsuario(l: UsuarioMv): boolean {
    return l.situacao === 'PENDENTE' || this.editandoId === l.codUsuarioMv;
  }

  alterarUsuario(l: UsuarioMv): void {
    this.editandoId = l.codUsuarioMv;
    this.textoUsuario[l.codUsuarioMv] = '';
  }

  cancelarAlteracao(): void {
    this.editandoId = null;
  }

  // ── Ações ─────────────────────────────────────────────────────────────

  vincular(l: UsuarioMv, codUsuario: number, nome: string): void {
    this.executar(l, this.service.vincular(l.codUsuarioMv, codUsuario),
      atual => `"${l.nmMv}" vinculado a ${nome}${this.sufixoTickets(atual)}`);
  }

  marcarSemAppNti(l: UsuarioMv): void {
    this.executar(l, this.service.marcarSemAppNti(l.codUsuarioMv),
      atual => `"${l.nmMv}" marcado como "Não usa o AppNTI": não gera mais aviso${this.sufixoTickets(atual)}`);
  }

  voltarParaPendente(l: UsuarioMv): void {
    this.executar(l, this.service.voltarParaPendente(l.codUsuarioMv),
      atual => `"${l.nmMv}" voltou para pendente${this.sufixoTickets(atual)}`);
  }

  reprocessar(): void {
    this.reprocessando = true;
    this.service.reprocessar().subscribe({
      next: r => {
        this.reprocessando = false;
        const partes = [
          r.nomesNovos ? `${r.nomesNovos} nome(s) novo(s)` : null,
          r.pendentesVinculados ? `${r.pendentesVinculados} pendente(s) vinculado(s)` : null,
          r.ticketsAtualizados ? `${r.ticketsAtualizados} ticket(s) atualizado(s)` : null,
        ].filter(Boolean);
        this.toast.success(partes.length ? `Reprocessado: ${partes.join(', ')}.` : 'Reprocessado: nada a mudar.');
        this.carregar();
      },
      error: err => {
        this.reprocessando = false;
        this.toast.error(this.mensagemErro(err, 'Não foi possível reprocessar o de-para.'));
      },
    });
  }

  private executar(l: UsuarioMv, acao: ReturnType<UsuariosMvService['vincular']>,
                   mensagem: (atual: UsuarioMv) => string): void {
    this.salvandoId = l.codUsuarioMv;
    acao.subscribe({
      next: atual => {
        this.salvandoId = null;
        this.editandoId = null;
        delete this.textoUsuario[l.codUsuarioMv];
        this.linhas = this.linhas.map(x => (x.codUsuarioMv === atual.codUsuarioMv ? atual : x));
        this.emitirPendentes();
        this.toast.success(mensagem(atual));
      },
      error: err => {
        this.salvandoId = null;
        this.toast.error(this.mensagemErro(err, 'Não foi possível salvar.'));
      },
    });
  }

  // ── Auxiliares ────────────────────────────────────────────────────────

  private emitirPendentes(): void {
    this.pendentesChange.emit(this.contar('PENDENTE'));
  }

  private sufixoTickets(atual: UsuarioMv): string {
    const n = atual.ticketsAtualizados ?? 0;
    return n > 0 ? ` (${n} ticket(s) atualizado(s))` : '';
  }

  private normalizar(texto: string): string {
    return (texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /** Mensagem do backend (ApplicationException traz motivo e como corrigir). */
  private mensagemErro(err: any, padrao: string): string {
    return err?.error?.message || err?.error?.erro || padrao;
  }

  trackLinha(_: number, l: UsuarioMv): number {
    return l.codUsuarioMv;
  }
}
