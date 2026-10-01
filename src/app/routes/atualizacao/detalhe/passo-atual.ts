import { AMBIENTE_ROTULO, Alvo, Artefato, AtualizacaoDetalhe } from '../atualizacao.models';

/** Abas do detalhe, na ordem do template. */
export const ABA = { ARTEFATOS: 0, HOMOLOGACAO: 1, PRODUCAO: 2, DADOS: 3 } as const;
export type Aba = (typeof ABA)[keyof typeof ABA];

export const ABA_ROTULO: Record<Aba, string> = {
  0: 'Artefatos',
  1: 'Homologação',
  2: 'Produção',
  3: 'Dados',
};

export type AcaoPasso = 'incluirArtefatos' | 'backupsHomologacao' | 'validar' | 'backupsProducao' | 'solicitar' | 'aprovar' | 'concluir';

/** acao: o usuário tem o que fazer · espera: depende de outra pessoa ou do fabricante · fim: nada mais a fazer. */
export type TomPasso = 'acao' | 'espera' | 'fim';

export interface Passo {
  /** Identifica o passo: quando muda, a tela vai para a aba dele (wizard). */
  id: string;
  aba: Aba;
  tom: TomPasso;
  titulo: string;
  descricao: string;
  /** O que falta, em números, quando há destinos pendentes. */
  falta: string | null;
  proximo: string | null;
  acao: { tipo: AcaoPasso; rotulo: string; icone: string } | null;
}

interface Contagem {
  /** Artefatos com destino no ambiente (cada um é um cluster: backup e JAR valem para todos os nós). */
  artefatos: number;
  semBackup: number;
  semJar: number;
  /** Nós que ainda não receberam a versão (a aplicação continua sendo marcada por nó). */
  naoAplicados: number;
}

/** O que falta por artefato (backup, JAR) e por nó (aplicação), nas versões vigentes não reprovadas. */
function contar(artefatos: Artefato[], destinos: (a: Artefato) => Alvo[], producao: boolean): Contagem {
  const c: Contagem = { artefatos: 0, semBackup: 0, semJar: 0, naoAplicados: 0 };
  for (const a of artefatos) {
    if (!a.versaoVigente || a.versaoVigente.situacao === 'REPROVADA') {
      continue;
    }
    const pendentes = destinos(a).filter(alvo => alvo.ultimaAplicacao?.resultado !== 'SUCESSO');
    if (!destinos(a).length) {
      continue;
    }
    c.artefatos++;
    c.naoAplicados += pendentes.length;
    if (!pendentes.length) {
      continue;
    }
    // Revisão 9: o backup e o JAR são do cluster; basta o do primeiro nó pendente.
    const rep = pendentes[0];
    const base = producao ? (rep.backupRenovado ?? rep.backup) : rep.backup;
    if (!base) {
      c.semBackup++;
    } else if (a.montaJar && !rep.jarGerado?.baseAtual) {
      c.semJar++;
    }
  }
  return c;
}

function falta(c: Contagem, comBackup: boolean): string | null {
  const partes = [
    comBackup && c.semBackup ? `${c.semBackup} backup(s)` : null,
    c.semJar ? `${c.semJar} JAR(s) a gerar` : null,
    c.naoAplicados ? `aplicação em ${c.naoAplicados} nó(s)` : null,
  ].filter(Boolean);
  return partes.length ? `Faltam ${partes.join(', ')} — de ${c.artefatos} artefato(s).` : null;
}

function dataHora(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'não informada';
}

/**
 * Passo atual do processo, em linguagem de quem opera: o que fazer agora, em que aba, quanto falta e o que vem
 * depois. Sai só do detalhe que a API devolve; as regras continuam no backend (as ações vêm de d.acoes).
 */
export function passoAtual(d: AtualizacaoDetalhe): Passo {
  const hml = d.ambienteHomologacao === 'HOMOLOGACAO' ? 'homologação' : `homologação (${AMBIENTE_ROTULO[d.ambienteHomologacao]})`;
  const base = { falta: null, acao: null } as Pick<Passo, 'falta' | 'acao'>;

  switch (d.situacao) {
    case 'CANCELADA':
      return { ...base, id: 'cancelada', aba: ABA.DADOS, tom: 'fim', titulo: 'Atualização cancelada', descricao: 'Nada mais a fazer. O histórico continua disponível na linha do tempo.', proximo: null };

    case 'CONCLUIDA':
      return { ...base, id: 'concluida', aba: ABA.PRODUCAO, tom: 'fim', titulo: 'Atualização concluída', descricao: 'Aplicada em produção e encerrada após o período de observação.', proximo: null };

    case 'AGUARDANDO_CORRECAO': {
      const reprovados = d.artefatos.filter(a => a.versaoVigente?.situacao === 'REPROVADA').length;
      return {
        ...base,
        id: 'correcao',
        aba: ABA.ARTEFATOS,
        tom: 'espera',
        titulo: 'Aguardando a versão corrigida do fabricante',
        descricao:
          `A validação reprovou ${reprovados} artefato(s). Quando o fabricante devolver o arquivo corrigido, ` +
          'use "Versão corrigida" no próprio artefato — ele entra como nova versão, sem apagar a anterior.',
        proximo: `Aplicar a versão corrigida em ${hml} e validar de novo`,
      };
    }

    case 'RASCUNHO':
    case 'EM_HOMOLOGACAO': {
      if (!d.artefatos.length) {
        return {
          id: 'incluir',
          aba: ABA.ARTEFATOS,
          tom: 'acao',
          titulo: 'Incluir os arquivos recebidos do fabricante',
          descricao: 'Envie o JAR inteiro ou o pacote de telas. Cada arquivo vira um artefato, com versão e assinatura (hash); os destinos vêm do cadastro do sistema.',
          falta: null,
          proximo: `Backup e aplicação em ${hml}`,
          acao: d.acoes.incluirArtefato ? { tipo: 'incluirArtefatos', rotulo: 'Incluir artefatos', icone: 'file_upload' } : null,
        };
      }
      if (!d.homologacaoCompleta) {
        const c = contar(d.artefatos, a => a.homologacao, false);
        const temJar = d.artefatos.some(a => a.montaJar);
        return {
          id: 'homologar',
          aba: ABA.HOMOLOGACAO,
          tom: 'acao',
          titulo: `Aplicar em ${hml}`,
          descricao:
            'Em cada artefato: envie o backup (o arquivo que está hoje em um dos nós; vale para todos)' +
            (temJar ? ', gere o JAR com as telas novas' : '') +
            ', aplique em todos os nós, na ordem, e registre o resultado marcando os nós.',
          falta: falta(c, true),
          proximo: 'Validação: quem testou registra o roteiro, com Passou ou Falhou em cada item',
          acao:
            d.acoes.registrarHomologacao && c.semBackup > 1
              ? { tipo: 'backupsHomologacao', rotulo: 'Enviar vários backups', icone: 'file_upload' }
              : null,
        };
      }
      return {
        ...base,
        id: 'validar',
        aba: ABA.HOMOLOGACAO,
        tom: d.acoes.validar ? 'acao' : 'espera',
        titulo: 'Registrar a validação',
        descricao: d.acoes.validar
          ? `Todas as versões estão aplicadas em ${hml}. Teste o sistema e registre o roteiro com o resultado de cada item.`
          : `Todas as versões estão aplicadas em ${hml}. A validação precisa ser registrada por outra pessoa: quem aplicou não valida (R-06).`,
        proximo: 'Backup de produção de cada destino',
        acao: d.acoes.validar ? { tipo: 'validar', rotulo: 'Registrar validação', icone: 'assignment_turned_in' } : null,
      };
    }

    case 'VALIDADA': {
      const c = contar(d.artefatos, a => a.producao, true);
      if (!d.backupProducaoCompleto) {
        return {
          id: 'backup-producao',
          aba: ABA.PRODUCAO,
          tom: 'acao',
          titulo: 'Enviar os backups de produção',
          descricao: c.artefatos
            ? 'Validação aprovada. Envie, de cada artefato, o arquivo que está hoje em produção (de qualquer nó; vale para todos) — é ele que volta se for preciso reverter.'
            : 'Validação aprovada, mas os artefatos ainda não têm destino de produção. Configure a produção do sistema (Configuração › Sistemas por ambiente) e use "Recalcular destinos".',
          falta: c.semBackup ? `Faltam ${c.semBackup} backup(s) — de ${c.artefatos} artefato(s).` : null,
          proximo: 'Solicitar a aprovação, com a data e hora da janela de produção',
          acao:
            d.acoes.registrarBackupProducao && c.semBackup > 1
              ? { tipo: 'backupsProducao', rotulo: 'Enviar vários backups', icone: 'file_upload' }
              : null,
        };
      }
      return {
        ...base,
        id: 'solicitar',
        aba: ABA.PRODUCAO,
        tom: 'acao',
        titulo: 'Solicitar a aprovação',
        descricao: 'Backups de produção completos. Proponha a data e hora da janela para o gestor aprovar.',
        proximo: 'Aprovação do gestor',
        acao: d.acoes.solicitarAprovacao ? { tipo: 'solicitar', rotulo: 'Solicitar aprovação', icone: 'send' } : null,
      };
    }

    case 'AGUARDANDO_APROVACAO':
      return {
        ...base,
        id: 'aprovacao',
        aba: ABA.PRODUCAO,
        tom: d.acoes.aprovar ? 'acao' : 'espera',
        titulo: d.acoes.aprovar ? 'Aprovar a janela de produção' : 'Aguardando a aprovação do gestor',
        descricao:
          `Janela proposta: ${dataHora(d.janela)}. ` +
          (d.acoes.aprovar ? 'Confira validação, backups e choques e aprove ou recuse.' : 'Nada a fazer até a aprovação.'),
        proximo: 'Aplicar em produção na janela',
        acao: d.acoes.aprovar ? { tipo: 'aprovar', rotulo: 'Aprovar', icone: 'verified_user' } : null,
      };

    case 'APROVADA':
    case 'PARCIAL': {
      const c = contar(d.artefatos, a => a.producao, true);
      const parcial = d.situacao === 'PARCIAL';
      return {
        ...base,
        id: parcial ? 'parcial' : 'producao',
        aba: ABA.PRODUCAO,
        tom: 'acao',
        titulo: parcial ? 'Produção parcial: complete os destinos' : 'Aplicar em produção na janela',
        descricao: parcial
          ? 'Parte dos destinos já recebeu a versão. Aplique nos que faltam, na ordem, ou reverta os que foram.'
          : `Janela: ${dataHora(d.janela)}. Em cada artefato: confira que nada mudou desde o backup (ou renove)` +
            (d.artefatos.some(a => a.montaJar) ? ', gere o JAR' : '') +
            ', aplique em todos os nós, na ordem, e registre marcando os nós.',
        falta: falta(c, true),
        proximo: 'Conclusão, depois do período de observação',
      };
    }

    case 'EM_PRODUCAO':
      return {
        ...base,
        id: 'concluir',
        aba: ABA.PRODUCAO,
        tom: d.acoes.concluir ? 'acao' : 'espera',
        titulo: d.acoes.concluir ? 'Concluir a atualização' : 'Em observação',
        descricao: d.acoes.concluir
          ? 'Aplicada em todos os destinos de produção. Se nada de errado apareceu, conclua.'
          : 'Aplicada em produção. Aguarde o fim do período de observação para concluir.',
        proximo: null,
        acao: d.acoes.concluir ? { tipo: 'concluir', rotulo: 'Concluir', icone: 'check_circle' } : null,
      };
  }
}
