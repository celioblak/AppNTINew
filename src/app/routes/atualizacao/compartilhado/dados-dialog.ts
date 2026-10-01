import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';

import { AMBIENTE_ROTULO, AtualizacaoDados, AtualizacaoDetalhe, Catalogo } from '../atualizacao.models';
import { AtualizacaoService } from '../atualizacao.service';

export interface DadosDialogData {
  catalogo: Catalogo;
  /** Ausente = nova atualização. */
  detalhe?: AtualizacaoDetalhe;
  codUsuarioLogado?: number | null;
}

/** Cadastro e edição dos dados da atualização (aba Dados da T-02). */
@Component({
  selector: 'app-atualizacao-dados-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ data.detalhe ? 'Dados de ' + data.detalhe.numero : 'Nova atualização' }}</h2>
    <form #form="ngForm" (ngSubmit)="salvar()">
      <mat-dialog-content class="campos">
        <mat-form-field appearance="outline" class="largo">
          <mat-label>Título</mat-label>
          <input matInput name="titulo" [(ngModel)]="dados.titulo" required maxlength="200" autocomplete="off" cdkFocusInitial />
          <mat-hint>Ex.: Correção do cálculo de glosa no faturamento</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Sistema</mat-label>
          <mat-select name="codSistema" [(ngModel)]="dados.codSistema" required>
            @for (s of sistemas; track s.codSistema) {
              <mat-option [value]="s.codSistema">{{ s.nome }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Ambiente de homologação</mat-label>
          <mat-select name="ambienteHomologacao" [(ngModel)]="dados.ambienteHomologacao" required [disabled]="travado">
            <mat-option value="HOMOLOGACAO">Homologação (SML)</mat-option>
            <mat-option value="TREINAMENTO">Treinamento (TRN)</mat-option>
          </mat-select>
        </mat-form-field>

        <p class="dica largo" [class.dica--alerta]="!!avisoAmbiente()">
          {{ avisoAmbiente() ?? 'Onde a atualização é testada antes da produção; os destinos de homologação saem do cadastro desse ambiente.' }}
        </p>

        <mat-form-field appearance="outline">
          <mat-label>Versão ou pacote do fabricante</mat-label>
          <input matInput name="versaoFabricante" [(ngModel)]="dados.versaoFabricante" maxlength="100" autocomplete="off" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Ticket MV</mat-label>
          <input matInput name="ticketMv" [(ngModel)]="dados.ticketMv" maxlength="100" autocomplete="off" />
          <mat-hint>Ticket aberto ao fabricante que originou a correção</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Chamado GLPI (opcional)</mat-label>
          <input matInput type="number" name="chamadoGlpi" [(ngModel)]="dados.chamadoGlpi" autocomplete="off" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="largo">
          <mat-label>Motivo</mat-label>
          <textarea matInput name="motivo" [(ngModel)]="dados.motivo" rows="3" maxlength="3000"></textarea>
          <mat-hint>Obrigatório quando não há ticket MV (R-03)</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Responsável</mat-label>
          <mat-select name="codResponsavel" [(ngModel)]="dados.codResponsavel">
            <mat-option [value]="null">Eu mesmo</mat-option>
            @for (u of data.catalogo.usuarios; track u.codUsuario) {
              <mat-option [value]="u.codUsuario">{{ u.nome }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="emergencial">
          <mat-slide-toggle name="emergencial" [(ngModel)]="dados.emergencial">Emergencial (produção antes de homologar)</mat-slide-toggle>
        </div>

        @if (dados.emergencial) {
          <mat-form-field appearance="outline" class="largo">
            <mat-label>Justificativa do emergencial</mat-label>
            <textarea matInput name="justificativaEmergencial" [(ngModel)]="dados.justificativaEmergencial" rows="2" required maxlength="2000"></textarea>
            <mat-hint>A homologação fica pendente até ser validada (R-08)</mat-hint>
          </mat-form-field>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || salvando() || semMotivo()">
          {{ data.detalhe ? 'Salvar' : 'Criar atualização' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .campos {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 12px;
      padding-top: 8px !important;
    }

    .largo,
    .emergencial {
      grid-column: 1 / -1;
    }

    .dica {
      margin: 0 0 12px;
      font-size: .78rem;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, .6));
    }

    .dica--alerta {
      color: #b26a00;
    }

    .emergencial {
      padding: 4px 0 12px;
    }

    @media (max-width: 600px) {
      .campos {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DadosDialogComponent {
  readonly data = inject<DadosDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<DadosDialogComponent, AtualizacaoDetalhe>>(MatDialogRef);
  private readonly service = inject(AtualizacaoService);

  readonly salvando = signal(false);
  /** Só sistemas ativos, mais o atual da atualização (mesmo que tenha sido desativado). */
  readonly sistemas = this.data.catalogo.sistemas.filter(s => s.ativo || s.codSistema === this.data.detalhe?.codSistema);
  /** Os destinos já foram calculados: trocar sistema ou ambiente de homologação exige remover os artefatos. */
  readonly travado = (this.data.detalhe?.artefatos.length ?? 0) > 0;

  /** Avisa quando o sistema não está configurado no ambiente escolhido (o destino sairia vazio). */
  avisoAmbiente(): string | null {
    if (this.travado) {
      return 'Sistema e ambiente de homologação não mudam depois de incluir artefatos.';
    }
    const ambiente = this.dados.ambienteHomologacao;
    if (!this.dados.codSistema || this.data.catalogo.ambientes.some(a => a.codSistema === this.dados.codSistema && a.ambiente === ambiente)) {
      return null;
    }
    return `O sistema não está configurado em ${AMBIENTE_ROTULO[ambiente]} (Atualizações › Configuração › Sistemas por ambiente).`;
  }

  dados: AtualizacaoDados = this.data.detalhe
    ? {
        titulo: this.data.detalhe.titulo,
        codSistema: this.data.detalhe.codSistema,
        versaoFabricante: this.data.detalhe.versaoFabricante,
        motivo: this.data.detalhe.motivo,
        ticketMv: this.data.detalhe.ticketMv,
        chamadoGlpi: this.data.detalhe.chamadoGlpi,
        codResponsavel: this.data.detalhe.codResponsavel,
        emergencial: this.data.detalhe.emergencial,
        justificativaEmergencial: this.data.detalhe.justificativaEmergencial,
        ambienteHomologacao: this.data.detalhe.ambienteHomologacao,
      }
    : {
        titulo: '',
        codSistema: null,
        versaoFabricante: null,
        motivo: null,
        ticketMv: null,
        chamadoGlpi: null,
        codResponsavel: this.data.codUsuarioLogado ?? null,
        emergencial: false,
        justificativaEmergencial: null,
        ambienteHomologacao: 'HOMOLOGACAO',
      };

  semMotivo() {
    return !this.dados.ticketMv?.trim() && !this.dados.motivo?.trim();
  }

  salvar() {
    this.salvando.set(true);
    const pedido = this.data.detalhe
      ? this.service.alterar(this.data.detalhe.codAtualizacao, this.dados)
      : this.service.criar(this.dados);
    pedido.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: detalhe => this.dialogRef.close(detalhe),
      error: () => {},
    });
  }
}
