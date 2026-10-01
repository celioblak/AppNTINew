import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { TokenService } from '@core';
import { SprintService } from '../sprintService';
import { AnaliseEntregaDialog } from './analise-entrega-dialog';

const ID_DIALOG = 'analise-entrega-sprint';

/**
 * Abre a análise de entrega da sprint ao entrar no sistema.
 *
 * Chamado pelo AdminLayout, que é recriado a cada login mas também ao trocar
 * entre grupos de rota (ex: Perfil). Por isso a verificação acontece uma vez
 * por token de acesso: um novo login gera outro token e verifica de novo;
 * navegar dentro da mesma sessão não reabre o popup.
 */
@Injectable({ providedIn: 'root' })
export class AnaliseEntregaPopupService {
  private readonly dialog = inject(MatDialog);
  private readonly sprintService = inject(SprintService);
  private readonly tokenService = inject(TokenService);

  private tokenVerificado: string | null = null;

  verificarAoEntrar(): void {
    const token = this.tokenService.getBearerToken();
    if (!this.tokenService.valid() || !token || token === this.tokenVerificado) return;
    this.tokenVerificado = token;

    this.sprintService.listarMinhasAnalisesEntrega().subscribe({
      next: tickets => {
        if (!tickets.length || this.dialog.getDialogById(ID_DIALOG)) return;
        this.dialog.open(AnaliseEntregaDialog, {
          id: ID_DIALOG,
          data: tickets,
          width: '760px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          autoFocus: false,
          disableClose: true,
        });
      },
      // Sem a verificação o sistema segue normalmente; o erro já aparece pelo errorInterceptor.
      error: () => {},
    });
  }
}
