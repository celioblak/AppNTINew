import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxDialog } from '@ng-matero/extensions/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize, forkJoin } from 'rxjs';

import { Ambiente, Hospedagem } from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';
import { AmbienteDialogComponent, HospedagemDialogComponent } from './ambiente-dialogs';

/**
 * Infraestrutura > Ambientes: as fases do ciclo (Produção, Homologação...) e,
 * numa aba, as hospedagens (datacenter próprio, nuvem).
 */
@Component({
  selector: 'app-ambientes',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, MatTabsModule, MatTooltipModule],
  templateUrl: './ambientes.html',
  styleUrl: './ambientes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmbientesComponent implements OnInit {
  private readonly service = inject(InfraestruturaService);
  private readonly dialog = inject(MatDialog);
  private readonly mtxDialog = inject(MtxDialog);
  private readonly toast = inject(HotToastService);

  readonly ambientes = signal<Ambiente[]>([]);
  readonly hospedagens = signal<Hospedagem[]>([]);
  readonly carregando = signal(true);

  ngOnInit() {
    this.carregar();
  }

  usoTexto(a: Ambiente): string {
    const u = a.uso;
    if (!u) return '';
    const partes = [];
    if (u.servidores) partes.push(`${u.servidores} servidor${u.servidores > 1 ? 'es' : ''}`);
    if (u.servicos) partes.push(`${u.servicos} serviço${u.servicos > 1 ? 's' : ''}`);
    if (u.configuracoesAtualizacao) partes.push(`${u.configuracoesAtualizacao} config. em Atualizações`);
    return partes.length ? partes.join(' · ') : 'Não usado';
  }

  emUso(a: Ambiente): boolean {
    const u = a.uso;
    return !!u && u.servidores + u.servicos + u.configuracoesAtualizacao > 0;
  }

  editarAmbiente(a?: Ambiente) {
    this.dialog
      .open(AmbienteDialogComponent, { width: '560px', maxWidth: '95vw', data: a ?? null })
      .afterClosed()
      .subscribe(salvo => {
        if (salvo) {
          this.toast.success(`Ambiente "${salvo.nome}" salvo.`);
          this.carregar();
        }
      });
  }

  excluirAmbiente(a: Ambiente) {
    this.mtxDialog.confirm(`Excluir o ambiente "${a.nome}"?`, 'Esta ação não pode ser desfeita.', () =>
      this.service.excluirAmbiente(a.codigo).subscribe({
        next: () => {
          this.toast.success('Ambiente excluído.');
          this.carregar();
        },
        error: () => {},
      })
    );
  }

  editarHospedagem(h?: Hospedagem) {
    this.dialog
      .open(HospedagemDialogComponent, { width: '520px', maxWidth: '95vw', data: h ?? null })
      .afterClosed()
      .subscribe(salvo => {
        if (salvo) {
          this.toast.success(`Hospedagem "${salvo.nome}" salva.`);
          this.carregar();
        }
      });
  }

  excluirHospedagem(h: Hospedagem) {
    this.mtxDialog.confirm(`Excluir a hospedagem "${h.nome}"?`, 'Esta ação não pode ser desfeita.', () =>
      this.service.excluirHospedagem(h.codHospedagem!).subscribe({
        next: () => {
          this.toast.success('Hospedagem excluída.');
          this.carregar();
        },
        error: () => {},
      })
    );
  }

  private carregar() {
    this.carregando.set(true);
    forkJoin({ ambientes: this.service.ambientes(), hospedagens: this.service.hospedagens() })
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: r => {
          this.ambientes.set(r.ambientes);
          this.hospedagens.set(r.hospedagens);
        },
        error: () => {},
      });
  }
}
