import { Injectable } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';

type Conteudo = Parameters<HotToastService['error']>[0];
type Opcoes = Parameters<HotToastService['error']>[1];
type Ref = ReturnType<HotToastService['error']>;

/** Mesmos tempos padrão da biblioteca (HOT_TOAST_DEFAULT_TIMEOUTS). */
const PADRAO_MS = 4000;
/** Folga depois do tempo do aviso, para o fechamento normal (com animação) acontecer primeiro. */
const FOLGA_MS = 2500;

/**
 * Rede de segurança dos avisos (toasts): o hot-toast fecha sozinho por animação CSS (a de entrada termina e agenda a de
 * saída); quando essa sequência não acontece, o aviso ficava na tela até alguém fechar. Aqui, passado o tempo do aviso
 * mais uma folga, ele é fechado pela referência (remove direto, sem depender da animação). Aviso com autoClose: false
 * (ou loading) não é mexido.
 */
@Injectable()
export class HotToastComFechamento extends HotToastService {
  override error<T>(mensagem?: Conteudo, opcoes?: Opcoes): Ref {
    return this.vigiar(super.error<T>(mensagem, opcoes as never), opcoes);
  }

  override success<T>(mensagem?: Conteudo, opcoes?: Opcoes): Ref {
    return this.vigiar(super.success<T>(mensagem, opcoes as never), opcoes);
  }

  override warning<T>(mensagem?: Conteudo, opcoes?: Opcoes): Ref {
    return this.vigiar(super.warning<T>(mensagem, opcoes as never), opcoes);
  }

  override info<T>(mensagem?: Conteudo, opcoes?: Opcoes): Ref {
    return this.vigiar(super.info<T>(mensagem, opcoes as never), opcoes);
  }

  private vigiar(ref: Ref, opcoes?: Opcoes): Ref {
    if (opcoes?.autoClose === false) return ref;
    let fechado = false;
    ref.afterClosed.subscribe(() => (fechado = true));
    const duracao = typeof opcoes?.duration === 'number' && isFinite(opcoes.duration) ? opcoes.duration : PADRAO_MS;
    setTimeout(() => {
      if (!fechado) ref.close();
    }, duracao + FOLGA_MS);
    return ref;
  }
}
