import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import { Notificacao, NotificacaoService, resumir, textoSimples } from '@shared/services/notificacao.service';
import { classeGravidade, iconeGravidade } from '../widgets/notification-button';

/** Central de notificações (painel lateral do botão ☰): não lidas e histórico (docs/telegram-expediente.md, T-04). */
@Component({
  selector: 'app-sidebar-notice',
  templateUrl: './sidebar-notice.html',
  styleUrl: './sidebar-notice.scss',
  host: {
    class: 'matero-sidebar-notice',
  },
  encapsulation: ViewEncapsulation.None,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
  ],
})
export class SidebarNotice implements OnInit {
  readonly svc = inject(NotificacaoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly aba = signal(0);
  readonly busca = signal('');
  readonly gravidade = signal<string | null>(null);
  readonly lista = signal<Notificacao[]>([]);
  readonly carregando = signal(false);
  readonly aberto = signal<number | null>(null);

  private temporizadorBusca: ReturnType<typeof setTimeout> | undefined;

  ngOnInit() {
    // Chegou notificação ou alguém marcou como lida pelo sino: recarrega a lista aberta.
    this.svc.mudou$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.carregar(false));
    this.svc.abrirCentral$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.carregar());
    this.carregar();
  }

  trocarAba(i: number) {
    this.aba.set(i);
    this.carregar();
  }

  pesquisar(texto: string) {
    this.busca.set(texto);
    clearTimeout(this.temporizadorBusca);
    this.temporizadorBusca = setTimeout(() => this.carregar(), 400);
  }

  carregar(mostrarCarregando = true) {
    if (mostrarCarregando) this.carregando.set(true);
    this.svc
      .listar({ naoLidas: this.aba() === 0, gravidade: this.gravidade(), busca: this.busca().trim() || null })
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: l => {
          // A notificação aberta continua na lista (ex.: acabou de ser lida na aba "Não lidas").
          const aberta = this.lista().find(x => x.codigo === this.aberto());
          if (aberta && !l.some(x => x.codigo === aberta.codigo)) {
            l = [...l, { ...aberta, lida: true }].sort((a, b) => (b.quando ?? '').localeCompare(a.quando ?? ''));
          }
          this.lista.set(l);
        },
        error: () => {},
      });
  }

  alternar(n: Notificacao) {
    this.aberto.set(this.aberto() === n.codigo ? null : n.codigo);
    if (!n.lida) {
      // Na aba "Não lidas" o item aberto continua visível (ver carregar), para dar tempo de ler.
      this.lista.update(l => l.map(x => (x.codigo === n.codigo ? { ...x, lida: true } : x)));
      this.svc.marcarLida(n).subscribe({ error: () => {} });
    }
  }

  marcarTodas() {
    this.svc.marcarTodas().subscribe({ next: () => this.carregar(), error: () => {} });
  }

  titulo(n: Notificacao) {
    return resumir(textoSimples(n.titulo) || n.tipo || 'Notificação', 120);
  }

  /** Mensagem completa; o Angular sanitiza o HTML (links do chamado continuam clicáveis). */
  corpo(n: Notificacao) {
    return (n.mensagem || '').replace(/\n/g, '<br>');
  }

  classe(n: Notificacao) {
    return classeGravidade(n.gravidade);
  }

  icone(n: Notificacao) {
    return iconeGravidade(n.gravidade);
  }
}
