/**
 * Controle, neste navegador, das tentativas de login automático com o usuário do Windows.
 *
 * - suspenso (sessionStorage): o usuário saiu do sistema; não entra sozinho de novo nesta aba.
 * - indisponível (localStorage): este navegador/computador não tem o login do Windows (fora do domínio,
 *   site fora da intranet) ou a conta não usa login automático; não tenta sozinho, só pelo botão.
 * - última tentativa (sessionStorage): evita repetir em sequência se a sessão aberta for recusada logo depois.
 */
const CHAVE_SUSPENSO = 'ntiapp.sso.suspenso';
const CHAVE_INDISPONIVEL = 'ntiapp.sso.indisponivel';
const CHAVE_ULTIMA_TENTATIVA = 'ntiapp.sso.ultimaTentativa';
const INTERVALO_MINIMO_MS = 60_000;

type Armazenamento = () => Storage;
const sessao: Armazenamento = () => sessionStorage;
const local: Armazenamento = () => localStorage;

function ler(armazenamento: Armazenamento, chave: string): string | null {
  try {
    return armazenamento().getItem(chave);
  } catch {
    return null;
  }
}

function gravar(armazenamento: Armazenamento, chave: string, valor: string) {
  try {
    armazenamento().setItem(chave, valor);
  } catch {
    // armazenamento indisponível: só não lembra a situação
  }
}

function remover(armazenamento: Armazenamento, chave: string) {
  try {
    armazenamento().removeItem(chave);
  } catch {
    // armazenamento indisponível
  }
}

export const preferenciasSso = {
  /** Tentativa automática ao abrir o login: não depois de sair, não em navegador sem login do Windows, não em sequência. */
  podeTentarAutomatico(): boolean {
    const ultima = Number(ler(sessao, CHAVE_ULTIMA_TENTATIVA) ?? 0);
    return (
      ler(sessao, CHAVE_SUSPENSO) !== '1' &&
      ler(local, CHAVE_INDISPONIVEL) !== '1' &&
      Date.now() - ultima > INTERVALO_MINIMO_MS
    );
  },

  registrarTentativaAutomatica() {
    gravar(sessao, CHAVE_ULTIMA_TENTATIVA, String(Date.now()));
  },

  /** Saída do sistema: não entra sozinho de novo nesta aba. */
  suspender() {
    gravar(sessao, CHAVE_SUSPENSO, '1');
  },

  /** Login pelo formulário: volta a permitir a tentativa automática nesta aba. */
  retomar() {
    remover(sessao, CHAVE_SUSPENSO);
  },

  marcarIndisponivel() {
    gravar(local, CHAVE_INDISPONIVEL, '1');
  },

  /** Login automático funcionou ou foi ativado no perfil: libera a tentativa automática neste navegador. */
  liberar() {
    remover(sessao, CHAVE_SUSPENSO);
    remover(local, CHAVE_INDISPONIVEL);
  },
};
