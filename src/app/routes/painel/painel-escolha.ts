import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

/**
 * Tela inicial do painel: escolhe qual TV será exibida.
 *
 * Também aceita o formato antigo de URL do PainelConsultoria (`/painel?tipo=incidente`),
 * para não ter que reconfigurar as TVs já apontadas.
 */
@Component({
  selector: 'app-painel-escolha',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="escolha">
      <p class="escolha__chamada">Escolha o painel que ficará na tela</p>

      <div class="escolha__botoes">
        <a routerLink="/painel/incidente">Incidentes</a>
        <a routerLink="/painel/requisicao">Requisições</a>
      </div>

      <div class="escolha__classico">
        Visual anterior:
        <a routerLink="/painel/classico/incidente">incidentes</a>
        ·
        <a routerLink="/painel/classico/requisicao">requisições</a>
      </div>
    </div>
  `,
  styles: [
    `
      .escolha {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: clamp(12px, 3vh, 32px);
        text-align: center;
      }

      .escolha__chamada {
        margin: 0;
        color: var(--pn-texto-fraco);
        font-size: clamp(1rem, 2.4vh, 2rem);
      }

      .escolha__botoes {
        display: flex;
        gap: clamp(12px, 2vw, 28px);
      }

      .escolha__botoes a {
        padding: clamp(14px, 2.5vh, 32px) clamp(24px, 4vw, 64px);
        border-radius: 10px;
        background: var(--pn-superficie-alta);
        color: var(--pn-texto);
        font-size: clamp(1.2rem, 3vh, 2.6rem);
        font-weight: 700;
        text-decoration: none;
      }

      .escolha__classico {
        color: var(--pn-texto-fraco);
        font-size: clamp(0.8rem, 1.5vh, 1.3rem);
      }

      .escolha__classico a {
        color: var(--pn-info);
      }
    `,
  ],
})
export class PainelEscolha implements OnInit {
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const tipo = (this.rota.snapshot.queryParamMap.get('tipo') ?? '').toLowerCase();

    if (tipo === 'incidente' || tipo === 'requisicao') {
      void this.router.navigate(['/painel', tipo], { replaceUrl: true });
    }
  }
}
