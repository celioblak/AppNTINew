import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { normalizar } from '../../dispositivo/terminal-ssh/comandos';
import {
  CAMADAS,
  Camada,
  DICA_CAMADA,
  Papel,
  ROTULO_CAMADA,
  ROTULO_PAPEL,
  Servidor,
  ServicoSistema,
  SistemaInfra,
} from '../infraestrutura.models';
import { InfraestruturaService } from '../infraestrutura.service';

export interface VinculoDialogData {
  sistema: SistemaInfra;
  ambiente: string;
  nomeAmbiente: string;
  servidores: Servidor[];
  /** Vínculo existente: só camada e marca mudam. */
  vinculo: ServicoSistema | null;
}

const CAMADA_DO_PAPEL: Record<Papel, Camada> = {
  APLICACAO: 'APLICACAO',
  BALANCEADOR: 'BALANCEADOR',
  BANCO_DADOS: 'BANCO',
  WEB: 'WEB',
  OUTRO: 'OUTRO',
};

interface Candidato {
  codProcesso: number;
  nome: string;
  servidor: string;
  tipo: string | null;
  papel: Papel | null;
}

/** Inclui um serviço no sistema (só serviços do ambiente, R-21) ou altera camada e marca essencial/auxiliar. */
@Component({
  selector: 'app-vinculo-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatRadioModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>
      {{ data.vinculo ? data.vinculo.nome : 'Incluir serviço' }}
      <small>{{ data.sistema.nome }} · {{ data.nomeAmbiente }}</small>
    </h2>
    <mat-dialog-content class="campos">
      @if (!data.vinculo) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Procurar serviço de {{ data.nomeAmbiente }}</mat-label>
          <input matInput [ngModel]="filtro()" (ngModelChange)="filtro.set($event)" placeholder="Serviço, servidor ou tipo" />
        </mat-form-field>
        <div class="candidatos">
          @for (c of candidatos(); track c.codProcesso) {
            <button type="button" class="candidato" [class.candidato--ativo]="escolhido()?.codProcesso === c.codProcesso" (click)="escolher(c)">
              <b>{{ c.nome }}</b>
              <small>{{ c.servidor }} · {{ c.tipo ?? 'sem tipo' }}{{ c.papel ? ' · ' + rotuloPapel[c.papel] : '' }}</small>
            </button>
          } @empty {
            <p class="dica">
              Nenhum serviço de {{ data.nomeAmbiente }} disponível{{ filtro() ? ' com esse texto' : '' }}. Só entram serviços deste ambiente
              (um serviço atende um só ambiente): confira o ambiente do serviço em Servidores e Serviços.
            </p>
          }
        </div>
      }

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Camada no sistema</mat-label>
        <mat-select [ngModel]="camada()" (ngModelChange)="camada.set($event)">
          @for (c of camadas; track c) {
            <mat-option [value]="c">{{ rotuloCamada[c] }}{{ c === camadaPadrao() ? ' (padrão do tipo)' : '' }}</mat-option>
          }
        </mat-select>
        <mat-hint>{{ dicaCamada[camada()] }}</mat-hint>
      </mat-form-field>

      <mat-radio-group class="marca" [ngModel]="essencial()" (ngModelChange)="essencial.set($event)">
        <mat-radio-button [value]="true">
          <b>Essencial</b> — sem ele (e sem os outros da mesma camada) o sistema fica fora
        </mat-radio-button>
        <mat-radio-button [value]="false">
          <b>Auxiliar</b> — se cair, o sistema fica parcial (ex.: relatórios)
        </mat-radio-button>
      </mat-radio-group>
      <p class="dica">
        Camadas ficam em série: se todos os essenciais de uma camada caem, o sistema fica fora. Na mesma camada os serviços são
        redundantes: parte fora deixa o sistema parcial.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Cancelar</button>
      <button matButton="filled" type="button" [disabled]="salvando() || (!data.vinculo && !escolhido())" (click)="salvar()">
        {{ data.vinculo ? 'Salvar' : 'Incluir' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    h2 small { display: block; font-size: 13px; font-weight: 400; color: var(--mat-sys-on-surface-variant); }
    .campos { display: flex; flex-direction: column; gap: 12px; min-width: min(560px, 90vw); padding-top: 8px !important; }
    .candidatos { display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; }
    .candidato { display: flex; flex-direction: column; align-items: flex-start; padding: 6px 10px; border: 1px solid var(--mat-sys-outline-variant);
                 border-radius: 8px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .candidato small { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
    .candidato--ativo { outline: 2px solid var(--mat-sys-primary); }
    .marca { display: flex; flex-direction: column; gap: 4px; }
    .dica { margin: 0; font-size: 12px; color: var(--mat-sys-on-surface-variant); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VinculoDialogComponent {
  readonly data = inject<VinculoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<VinculoDialogComponent>);
  private readonly service = inject(InfraestruturaService);

  readonly camadas = CAMADAS;
  readonly rotuloCamada = ROTULO_CAMADA;
  readonly dicaCamada = DICA_CAMADA;
  readonly rotuloPapel = ROTULO_PAPEL;

  readonly filtro = signal('');
  readonly escolhido = signal<Candidato | null>(null);
  readonly camada = signal<Camada>(this.data.vinculo?.camada ?? 'APLICACAO');
  readonly essencial = signal(this.data.vinculo?.essencial ?? true);
  readonly salvando = signal(false);

  readonly camadaPadrao = computed<Camada>(() => {
    const papel = this.data.vinculo ? this.data.vinculo.papel : this.escolhido()?.papel;
    return papel ? CAMADA_DO_PAPEL[papel] : 'OUTRO';
  });

  /** Serviços do ambiente que ainda não estão no sistema. */
  private readonly todos: Candidato[] = (() => {
    const ja = new Set(
      this.data.sistema.ambientes.find(a => a.ambiente === this.data.ambiente)?.servicos.map(s => s.codProcesso) ?? []
    );
    return this.data.servidores
      .filter(s => s.ativo)
      .flatMap(s =>
        s.servicos
          .filter(sv => sv.ambienteEfetivo === this.data.ambiente && !ja.has(sv.codProcesso))
          .map(sv => ({ codProcesso: sv.codProcesso, nome: sv.nome, servidor: s.nome, tipo: sv.tipo, papel: sv.papel }))
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));
  })();

  readonly candidatos = computed(() => {
    const termo = normalizar(this.filtro().trim());
    if (!termo) return this.todos;
    return this.todos.filter(c => normalizar(`${c.nome} ${c.servidor} ${c.tipo ?? ''}`).includes(termo));
  });

  escolher(c: Candidato) {
    this.escolhido.set(c);
    this.camada.set(c.papel ? CAMADA_DO_PAPEL[c.papel] : 'OUTRO');
  }

  salvar() {
    const codProcesso = this.data.vinculo?.codProcesso ?? this.escolhido()?.codProcesso;
    if (!codProcesso) return;
    this.salvando.set(true);
    this.service
      .vincular(this.data.sistema.codSistema, this.data.ambiente, codProcesso, this.camada(), this.essencial())
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({ next: s => this.dialogRef.close(s), error: () => {} }); // erro (com orientação) exibido pelo interceptor
  }
}
