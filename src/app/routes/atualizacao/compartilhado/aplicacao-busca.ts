import { ChangeDetectionStrategy, Component, computed, effect, input, model, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { Aplicacao, normalizarTexto } from '../atualizacao.models';

/** Busca de aplicação (processo do servidor) por servidor, nome, caminho ou tipo. */
@Component({
  selector: 'app-aplicacao-busca',
  imports: [FormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" class="campo" [subscriptSizing]="dica() ? 'fixed' : 'dynamic'">
      <mat-label>{{ rotulo() }}</mat-label>
      <input
        matInput
        [matAutocomplete]="auto"
        [ngModel]="texto()"
        (ngModelChange)="digitar($event)"
        [disabled]="desabilitado()"
        placeholder="Servidor, processo ou caminho"
        autocomplete="off" />
      <mat-autocomplete #auto="matAutocomplete" [displayWith]="exibir" (optionSelected)="selecionar($event.option.value)">
        @for (a of filtradas(); track a.codProcesso) {
          <mat-option [value]="a">
            <span class="opcao">
              <span>{{ a.descricao }}</span>
              @if (a.caminho || a.tipoProcesso) {
                <small>{{ a.tipoProcesso }} {{ a.caminho }}</small>
              }
            </span>
          </mat-option>
        }
      </mat-autocomplete>
      @if (dica()) {
        <mat-hint>{{ dica() }}</mat-hint>
      }
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
    }

    .campo {
      width: 100%;
    }

    .opcao {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }

    small {
      font-size: .72rem;
      opacity: .7;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AplicacaoBuscaComponent {
  readonly aplicacoes = input.required<Aplicacao[]>();
  readonly rotulo = input('Aplicação');
  readonly dica = input<string | null>(null);
  readonly desabilitado = input(false);
  readonly codProcesso = model<number | null>(null);

  readonly texto = signal('');

  readonly filtradas = computed(() => {
    const termo = normalizarTexto(this.texto());
    return this.aplicacoes()
      .filter(a => !termo || normalizarTexto(`${a.descricao} ${a.caminho ?? ''} ${a.tipoProcesso ?? ''}`).includes(termo))
      .slice(0, 60);
  });

  constructor() {
    effect(() => {
      const codigo = this.codProcesso();
      const aplicacao = this.aplicacoes().find(a => a.codProcesso === codigo);
      if (aplicacao && untracked(this.texto) !== aplicacao.descricao) {
        this.texto.set(aplicacao.descricao);
      }
    });
  }

  readonly exibir = (valor: Aplicacao | string | null) => (typeof valor === 'string' ? valor : (valor?.descricao ?? ''));

  digitar(valor: Aplicacao | string) {
    if (typeof valor !== 'string') {
      return;
    }
    this.texto.set(valor);
    if (this.codProcesso() !== null) {
      this.codProcesso.set(null);
    }
  }

  selecionar(aplicacao: Aplicacao) {
    this.texto.set(aplicacao.descricao);
    this.codProcesso.set(aplicacao.codProcesso);
  }
}
