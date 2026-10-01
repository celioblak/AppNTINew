import { Component, OnInit, OnDestroy, Output, EventEmitter, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SugestaoSprintService, SugestaoTicketSprint } from './sugestao-ticket-sprint.service';

@Component({
  selector: 'app-painel-sugestoes',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `

    <!-- ── Botão flutuante de acionamento ── -->
    <button type="button"
            class="sugestao-fab"
            [class.tem-sugestoes]="sugestoes.length > 0"
            matTooltip="Sugestões de tickets para esta sprint"
            (click)="abrirPainel()">
      <mat-icon>lightbulb</mat-icon>
      <span class="fab-label">Sugestões</span>
      <span class="fab-badge" *ngIf="sugestoes.length > 0">{{ sugestoes.length }}</span>
    </button>

    <!-- ── Overlay ── -->
    <div class="sugestao-overlay" *ngIf="aberto" (click)="fecharPainel()"></div>

    <!-- ── Slide panel ── -->
    <div class="sugestao-slidebar" [class.aberto]="aberto">

      <div class="slidebar-header">
        <div class="slidebar-titulo">
          <mat-icon class="titulo-icon">lightbulb</mat-icon>
          <span>Sugestões para a Sprint</span>
          <span class="titulo-badge" *ngIf="sugestoes.length > 0">{{ sugestoes.length }}</span>
        </div>
        <div class="slidebar-acoes">
          <button type="button" mat-icon-button (click)="carregar()" matTooltip="Recarregar" class="btn-reload">
            <mat-icon>refresh</mat-icon>
          </button>
          <button type="button" mat-icon-button (click)="fecharPainel()" matTooltip="Fechar" class="btn-close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="slidebar-body">

        <!-- Loading -->
        <div *ngIf="carregando" class="slide-estado">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Carregando sugestões...</span>
        </div>

        <!-- Vazio -->
        <div *ngIf="!carregando && sugestoes.length === 0" class="slide-estado">
          <mat-icon class="estado-icon">lightbulb_outline</mat-icon>
          <p>Nenhuma sugestão pendente.</p>
          <small>Os tickets sugeridos aparecerão aqui.</small>
        </div>

        <!-- Lista -->
        <div *ngFor="let s of sugestoes"
             class="sugestao-card"
             [class.card-indisponivel]="!isTicketDisponivel(s.ticketId)">
          <div class="card-info">
            <div class="card-top">
              <span class="card-id">#{{ s.ticketId }}</span>
              <span class="card-usuario">
                <mat-icon class="u-icon">person</mat-icon>{{ s.sugeridoPorNome || 'Usuário' }}
              </span>
              <!-- Aviso ticket finalizado -->
              <span *ngIf="!isTicketDisponivel(s.ticketId)" class="card-aviso">
                <mat-icon>warning</mat-icon> Finalizado
              </span>
            </div>
            <div class="card-titulo">{{ s.titulo || 'Ticket #' + s.ticketId }}</div>
            <div *ngIf="!isTicketDisponivel(s.ticketId)" class="card-aviso-msg">
              Este ticket está finalizado e não pode ser adicionado à sprint.
            </div>
          </div>
          <button type="button" mat-flat-button color="primary" class="btn-incluir"
                  [disabled]="incluindoId === s.ticketId || !isTicketDisponivel(s.ticketId)"
                  [matTooltip]="!isTicketDisponivel(s.ticketId) ? 'Ticket finalizado' : 'Incluir na sprint'"
                  (click)="incluir(s)">
            <mat-spinner *ngIf="incluindoId === s.ticketId" diameter="14"></mat-spinner>
            <mat-icon *ngIf="incluindoId !== s.ticketId">
              {{ isTicketDisponivel(s.ticketId) ? 'add' : 'block' }}
            </mat-icon>
            {{ isTicketDisponivel(s.ticketId) ? 'Incluir' : 'Indisponível' }}
          </button>
        </div>

      </div>

      <div class="slidebar-footer">
        <mat-icon>info</mat-icon>
        Tickets sugeridos por usuários para esta sprint.
      </div>
    </div>
  `,
  styles: [`
    /* ── Botão flutuante ── */
    .sugestao-fab {
      position: fixed;
      right: 24px;
      bottom: 90px;
      z-index: 900;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px 10px 14px;
      border-radius: 28px;
      border: none;
      background: var(--mat-sys-surface-container-high, #e0e0e0);
      color: var(--mat-sys-on-surface-variant, #555);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,.18);
      transition: all .2s;

      mat-icon { font-size: 20px; width: 20px; height: 20px; }

      &:hover {
        box-shadow: 0 4px 16px rgba(0,0,0,.25);
        transform: translateY(-1px);
      }

      &.tem-sugestoes {
        background: #e65100;
        color: #fff;
        animation: pulse-fab 2s ease-in-out infinite;
      }
    }

    .fab-badge {
      min-width: 20px;
      height: 20px;
      border-radius: 10px;
      background: #fff;
      color: #e65100;
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
    }

    @keyframes pulse-fab {
      0%, 100% { box-shadow: 0 2px 8px rgba(230,81,0,.5); }
      50%       { box-shadow: 0 4px 22px rgba(230,81,0,.8); }
    }

    /* ── Overlay ── */
    .sugestao-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.35);
      z-index: 1000;
      backdrop-filter: blur(2px);
    }

    /* ── Slide panel ── */
    .sugestao-slidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: 360px;
      max-width: 95vw;
      height: 100dvh;
      z-index: 1001;
      display: flex;
      flex-direction: column;
      background: var(--mat-sys-surface-container, #fafafa);
      box-shadow: -4px 0 24px rgba(0,0,0,.2);
      transform: translateX(100%);
      transition: transform .3s cubic-bezier(.4,0,.2,1);

      &.aberto { transform: translateX(0); }
    }

    /* Header */
    .slidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: #e65100;
      color: #fff;
      flex-shrink: 0;
    }

    .slidebar-titulo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
    }

    .titulo-icon { font-size: 20px; }

    .titulo-badge {
      background: rgba(255,255,255,.3);
      border-radius: 20px;
      padding: 1px 8px;
      font-size: 11px;
      font-weight: 800;
    }

    .slidebar-acoes { display: flex; gap: 4px; }
    .btn-reload, .btn-close { color: rgba(255,255,255,.85); }
    .btn-reload:hover, .btn-close:hover { color: #fff; }

    /* Body */
    .slidebar-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,0,0,.15) transparent;
    }

    /* Estado vazio / loading */
    .slide-estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 48px 20px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant, #666);

      .estado-icon { font-size: 40px; width: 40px; height: 40px; opacity: .35; }
      p     { margin: 0; font-size: 14px; }
      small { font-size: 12px; opacity: .7; }
    }

    /* Card de sugestão */
    .sugestao-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: 8px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, #fff);
      border: 1px solid var(--mat-sys-outline-variant, rgba(128,128,128,.3));
      border-left: 3px solid #e65100;
      transition: box-shadow .15s;
      &:hover { box-shadow: 0 2px 8px rgba(0,0,0,.25); }
    }

    .card-indisponivel {
      border-left-color: var(--mat-sys-outline, rgba(128,128,128,.5)) !important;
      opacity: .6;
      background: var(--mat-sys-surface-container-low, rgba(128,128,128,.08)) !important;
    }

    .card-aviso {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 10px;
      font-weight: 600;
      color: #e65100;
      background: rgba(230, 81, 0, .15);
      padding: 1px 6px;
      border-radius: 10px;
      mat-icon { font-size: 11px; width: 11px; height: 11px; }
    }

    .card-aviso-msg {
      font-size: 10px;
      color: var(--mat-sys-on-surface-variant, rgba(128,128,128,.8));
      margin-top: 3px;
      font-style: italic;
    }

    .card-info { flex: 1; min-width: 0; }

    .card-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 3px;
      flex-wrap: wrap;
    }

    .card-id {
      font-size: 11px;
      font-weight: 700;
      color: var(--mat-sys-primary, #90caf9);
    }

    .card-usuario {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 11px;
      color: var(--mat-sys-on-surface-variant, rgba(255,255,255,.6));
    }

    .u-icon { font-size: 12px; width: 12px; height: 12px; }

    .card-titulo {
      font-size: 12px;
      font-weight: 500;
      color: var(--mat-sys-on-surface, inherit);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-incluir {
      flex-shrink: 0;
      font-size: 11px;
      height: 30px;
      padding: 0 10px;
      line-height: 30px;
      mat-icon { font-size: 14px; margin-right: 2px; }
    }

    /* Footer */
    .slidebar-footer {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      font-size: 11px;
      color: var(--mat-sys-on-surface-variant, #888);
      border-top: 1px solid var(--mat-sys-outline-variant, rgba(0,0,0,.08));
      flex-shrink: 0;
      mat-icon { font-size: 14px; width: 14px; }
    }
  `]
})
export class PainelSugestoesComponent implements OnInit, OnDestroy {

  @Input() idSprint: number | null | undefined = null;
  /** Tickets atualmente disponíveis para sprint — usado para sinalizar finalizados */
  @Input() idsTicketsDisponiveis: any[] = [];
  @Output() incluirTicket = new EventEmitter<{ ticketId: string; sugestaoId: number | null }>();

  sugestoes: SugestaoTicketSprint[] = [];
  carregando  = false;
  aberto      = false;
  incluindoId: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private sugestaoService: SugestaoSprintService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.carregar(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  abrirPainel(): void { this.aberto = true; }
  fecharPainel(): void { this.aberto = false; }

  /** Retorna true se o ticket da sugestão ainda está disponível para sprint */
  isTicketDisponivel(ticketId: string): boolean {
    if (!this.idsTicketsDisponiveis?.length) return true; // sem info = assume disponível
    return this.idsTicketsDisponiveis.some(
      (t: any) => t?.id?.toString() === ticketId?.toString()
    );
  }

  carregar(): void {
    this.carregando = true;
    this.sugestaoService.listarSugestoes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: s => { this.sugestoes = s || []; this.carregando = false; this.cdr.detectChanges(); },
        error: () => { this.carregando = false; this.cdr.detectChanges(); }
      });
  }

  incluir(s: SugestaoTicketSprint): void {
    this.incluindoId = s.ticketId;
    this.cdr.detectChanges();

    const evento = { ticketId: s.ticketId, sugestaoId: s.id ?? null };

    if (!this.idSprint || !s.id) {
      this.sugestoes = this.sugestoes.filter(x => x.id !== s.id);
      this.incluindoId = null;
      this.cdr.detectChanges();
      this.incluirTicket.emit(evento);
      return;
    }

    this.sugestaoService.atenderSugestao(s.id, this.idSprint)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sugestoes = this.sugestoes.filter(x => x.id !== s.id);
          this.incluindoId = null;
          this.cdr.detectChanges();
          this.incluirTicket.emit(evento);
        },
        error: () => {
          this.sugestoes = this.sugestoes.filter(x => x.id !== s.id);
          this.incluindoId = null;
          this.cdr.detectChanges();
          this.incluirTicket.emit(evento);
        }
      });
  }
}
