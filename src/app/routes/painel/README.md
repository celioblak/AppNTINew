# Painel de TV

Telas que ficam ligadas numa televisão, **sem login**. Substituem o projeto
`PainelConsultoria`.

## Endereços

| URL | O que é |
|---|---|
| `/painel` | escolha do painel; aceita o formato antigo `/painel?tipo=incidente` |
| `/painel/incidente` | incidentes + servidores + locks (**visual novo**) |
| `/painel/requisicao` | requisições em análise e execução (**visual novo**) |
| `/painel/classico/incidente` | **visual anterior**, mantido para rollback |
| `/painel/classico/requisicao` | **visual anterior**, mantido para rollback |

Rotas sem guard, registradas antes do `AdminLayout` em `app.routes.ts`. Os
endpoints `/api/painel/**` já são públicos no backend (`SecurityConfiguration`),
e as chamadas usam `semTratamentoDeErro()` para um erro de rede não abrir toast
nem mandar a TV para a tela de login.

## Rollback do visual

Se a equipe não se adaptar ao visual novo, **basta apontar a TV para
`/painel/classico/...`** — nada precisa ser recompilado ou revertido.

A pasta `classico/` é uma cópia congelada das telas como estavam antes da
repaginação (mesmas cores, mesma tabela, mesmas fontes). Ela não deve evoluir:
correções de regra de negócio entram só nas telas novas.

**Quando o visual novo for aceito**, apague:

- a pasta `classico/`;
- as duas rotas `classico/*` em `painel.routes.ts`;
- o bloco `&--classico` em `painel-layout.scss` e o método
  `marcarCargaNoClassico()` em `painel-layout.ts`;
- o bloco "Visual anterior" em `painel-escolha.ts`.

## O que mudou no visual novo

| Antes | Agora | Por quê |
|---|---|---|
| lista com `overflow: hidden` | páginas de 8 cards em rodízio (10s) + "Página X de Y" | o que passava da altura da TV sumia sem ninguém perceber |
| "Atualizado às" em 0,85rem no rodapé | relógio grande + "dados de X s atrás", que fica âmbar acima de 30s | a pergunta de quem olha é se o painel ainda está vivo |
| modal cobrindo a tela quando a conexão cai | tarja no topo | os dados continuam chegando por HTTP; cobrir a tela esconde o que funciona |
| tabelas de 6 colunas em 1,2rem | cards de servidor e resumo de locks | tabela densa não se lê a 4 metros |
| 10 contadores, 10 cores | cores só em reprovado / pausado / aprovação | quando tudo é colorido, nada se destaca |
| layout alternava entre empilhado e lado a lado | proporção fixa 62/38 | a tela saltava de forma inexplicável para quem assistia |
| cor como único sinal | etiquetas ATENÇÃO / CRÍTICO junto da cor | daltonismo não distingue âmbar de vermelho |
| fundo claro | tema escuro + deriva lenta de 4px | TV ligada o dia todo: menos cansaço e menos burn-in |
| sem idade do chamado | "há 2h14" em cada card, mais antigo primeiro | é o que mostra o que está travado |
| — | realce de 6s no chamado que acabou de entrar | achar a novidade sem reler a tela |

Tamanhos usam `clamp()` com `vh`/`vw`, então a mesma tela serve 1080p e 4K, e há
margem de segurança nas bordas por causa do overscan da TV.

## Alertas: SSE no lugar do WebSocket

`painel-sse.service.ts` consome `GET /api/painel/alertas/stream`
(`text/event-stream`). O WebSocket/STOMP **não é mais usado pelo painel**.

Motivo: com mais de uma instância, o alerta nasce num nó e a TV pode estar
conectada em outro. O broker STOMP em memória só alcança os clientes do próprio
nó, e a volta era cada nó reenviar o alerta aos outros por HTTP usando a lista
fixa da configuração `WEBSOCKET_SERVERS` — instância fora da lista ficava muda e
instância desligada gerava erro a cada alerta.

Agora todo alerta é gravado em `TB_PAINEL_EVENTO` (ver
`ntiapi/sql/painel_sse_eventos.sql`) e **todas as instâncias leem a mesma
tabela**. Não importa onde o alerta nasceu nem onde a TV se conectou. De quebra,
SSE é HTTP comum — atravessa proxy e balanceador sem configuração de upgrade — e
o `EventSource` reconecta sozinho mandando `Last-Event-ID`, então o painel volta
do ponto onde parou.

Detalhes da implementação (`PainelEventoService` no backend):

- cada conexão lê a tabela a cada 2s e manda um `ping` como comentário a cada 15s
  para o proxy não fechar a conexão ociosa;
- a conexão expira em 30 min e o navegador reconecta — assim nenhuma conexão vive
  para sempre;
- eventos com mais de 30 min são apagados pelo próprio insert (a cada 10 min), sem
  precisar de job novo no Quartz;
- quem conecta sem `Last-Event-ID` começa do evento atual, para a TV não receber
  uma enxurrada de alerta velho ao ligar;
- **evento com mais de 2 min não é entregue** (`IDADE_MAXIMA_ENTREGA_MINUTOS`), só
  avança o cursor. Alerta é foto do momento: "load alto" das 10h não diz nada às
  11h, porque o servidor pode ter normalizado. Sem esse corte, um painel que
  ficasse sem conexão e reconectasse com `Last-Event-ID` despejaria — e **falaria**,
  via TTS — uma fila de problema que já passou.

## Por que a tela não mostra problema que já acabou

O fluxo de alertas é só o aviso momentâneo (toast de 6 a 15s e voz). **O que está
quebrado agora vem sempre do polling**, a cada 2s: cards de chamado, servidores em
atenção e locks são recarregados inteiros, então um servidor que normalizou
simplesmente para de aparecer no ciclo seguinte. Não existe estado antigo preso na
tela.

O risco oposto é mais traiçoeiro e também está tratado: se a API para de responder,
o painel **segura o último dado bom** em vez de limpar a tela. Devolver lista vazia
na falha mostraria "Nenhum chamado em aberto" e nenhum servidor em atenção — um
"tudo certo" falso, que ninguém desconfia. Como o ciclo só conta como atualizado
quando as três consultas voltam bem, o indicador "dados de X s atrás" começa a
subir e fica âmbar acima de 30s.

O broadcast WebSocket continua no backend porque o `PainelConsultoria` ainda o
usa. Quando aquele projeto for desligado, dá para remover `WebSocketController`,
`WsBroadcastSendThread` e as configurações `WEBSOCKET_SERVERS` / `WEBSOCKET_URI`.

Limitação conhecida: a entrega é por `COD_EVENTO` crescente. Se duas instâncias
inserirem no mesmo instante e a de número menor comitar depois, aquele evento
pode não ser entregue a quem já leu além dele. São avisos de vida curta (toast e
voz) e o volume é de poucos por minuto, então o risco é baixo; se um dia
incomodar, a saída é ler por janela de tempo com sobreposição e descartar
repetidos pelo id.
