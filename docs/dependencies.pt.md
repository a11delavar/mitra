---
title: Dependências
description: "Faça uma entrada esperar por outra, veja a ordem como linhas no calendário e mova uma cadeia inteira junta."
---

Uma **dependência** diz que uma entrada não pode começar até que outra termine: o rascunho antes da revisão, a revisão antes do lançamento. A entrada que espera é bloqueada pela outra.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/week-detail-dark.webp">
  <img src="../assets/screenshots/week-detail-light.webp" alt="Uma semana com três tarefas de estudo ligadas por linhas, cada uma levando à seguinte e depois à prova" />
</picture>

## Adicionar uma dependência

Abra a entrada que espera, pressione **＋** em **Bloqueado por** e digite parte do título da entrada que precisa terminar primeiro. A pesquisa abrange todos os seus calendários, então uma entrada pode esperar por outra em outro calendário ou conta. A outra entrada então lista esta em **Bloqueia**, que só lista vínculos: você sempre adiciona um a partir da entrada que espera.

No editor, clique no título de uma entrada vinculada para abri-la, ou pressione o **✕** ao lado para remover o vínculo, de qualquer um dos lados. O Mitra recusa um vínculo que formaria um círculo, como duas entradas que esperam uma pela outra.

Com o mouse, você também pode desenhar uma dependência nas vistas de semana ou de mês. Aponte para a entrada que vem primeiro, pegue a linha curta no fim dela e solte-a sobre a entrada que deve esperar por ela. Enquanto você arrasta, a linha fica vermelha sobre uma entrada que já começa cedo demais.

## Linhas no calendário

A vista de semana, a vista de mês e a linha do tempo desenham uma linha do fim de cada entrada até o início da entrada que espera por ela. Aponte para uma entrada para trazer suas linhas para a frente. As linhas de cada vista podem ser desativadas em **Configurações → Calendário**, com **Linhas de conexão na vista de semana**, **Linhas de conexão na vista de mês** e **Linhas de conexão na linha do tempo**.

## Dependências quebradas

Quando uma entrada começa antes de terminar aquela por que ela espera, a dependência está quebrada. A linha dela no calendário fica vermelha e, nas linhas **Bloqueado por** e **Bloqueia** do editor, a entrada do outro lado aparece nomeada em vermelho. Coloque qualquer uma das entradas de volta na ordem e o aviso some.

## Mover uma cadeia

Quando você arrasta uma entrada, ou uma das bordas dela, e outras entradas dependem dela, o Mitra pergunta **Mover também as entradas dependentes?**. As opções que movem outras entradas informam quantas são:

- **Apenas esta entrada** move só esta e deixa as demais onde estão.
- **Manter a cadeia intacta** move as outras só o quanto for preciso para manter a ordem. As entradas depois desta vão para mais tarde e, se você moveu esta para mais cedo, as entradas antes dela vão para mais cedo. Uma entrada com folga suficiente fica onde está.
- **Mover todas pela mesma quantidade** move a cadeia inteira, antes e depois desta entrada, pelo mesmo intervalo de tempo, então os espaços entre elas continuam iguais.

O Mitra só pergunta quando as opções dariam resultados diferentes. Alterar horários no editor nunca move outras entradas.

Quando uma entrada se move como parte de uma cadeia, as subtarefas dela se movem com ela. Entradas recorrentes e tarefas sem agendamento em uma cadeia nunca são movidas.

> [!TIP]
> Segure <kbd>Ctrl</kbd> (<kbd>⌘</kbd> em um Mac) ao soltar para pular a pergunta e mover só essa entrada. Veja os [atalhos de teclado](shortcuts.md).

## Quais calendários oferecem suporte

Um vínculo é salvo com a entrada que espera, no calendário da própria entrada. Os [servidores de calendário](integrations/caldav.md), o [Apple Calendar](integrations/apple.md) e os [calendários do Mitra](integrations/mitra.md) guardam qualquer vínculo, e em um servidor de calendário ele é escrito no formato padrão de calendário, para que outros aplicativos que usam o mesmo calendário possam lê-lo.

- No [Notion](integrations/notion.md), um vínculo para uma tarefa do mesmo banco de dados vai para a propriedade de relação correspondente, como "Blocked by". O Mitra guarda por conta própria os vínculos para qualquer outra coisa.
- O [Google Calendar](integrations/google.md) descarta vínculos, então uma entrada de um calendário do Google não pode ter algo pelo que esperar. Entradas de outros calendários ainda podem vincular a ela.
- As [subscrições de calendário](integrations/subscriptions.md) são somente leitura, e o [Tempo](integrations/tempo.md) não tem vínculos.
