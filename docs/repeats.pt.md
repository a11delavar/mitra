---
title: Repetições
description: "Faça uma entrada se repetir, altere ou exclua uma ocorrência ou a série inteira, e veja que calendários podem guardar repetições."
---

Uma entrada recorrente é uma só entrada com uma regra de repetição, como uma reunião de equipe toda segunda-feira ou o aluguel que vence no dia 1 de cada mês. Esta página chama o conjunto de série, e cada uma das suas datas de ocorrência. Cada ocorrência mostra um pequeno ícone de repetição nas vistas.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-detail-dark.webp">
  <img src="../assets/screenshots/repeat-detail-light.webp" alt="O editor de uma reunião semanal de equipe com a sua lista Repetir aberta: Não se repete, Todos os dias, Todos os dias úteis, Todas as semanas em ter, A cada 2 semanas, Todos os meses no dia 1, no 1º ter, Todos os anos e Personalizado" />
</picture>

## Fazer uma entrada se repetir

Abra a entrada e escolha uma regra na sua linha **Repetir**. A linha aparece quando a entrada tem uma data: um início, ou uma data de vencimento para uma tarefa sem agendamento.

A lista oferece regras construídas a partir da data em que a série começa, mesmo que você tenha aberto uma ocorrência posterior. Para uma entrada na terça-feira, dia 13, ela oferece **Todos os dias**, **Todos os dias úteis** (de segunda a sexta), **Todas as semanas** na terça, **A cada 2 semanas** na terça, **Todos os meses** no dia 13, **Todos os meses** na 2ª terça e **Todos os anos** nessa data. Quando o início cai nos últimos sete dias do seu mês, há também **Todos os meses** na última terça.

Para uma entrada deixar de se repetir, escolha **Não se repete**. Uma alteração à regra se aplica sempre à série inteira, por isso o Mitra não pergunta a quais ocorrências você se refere.

### Regras personalizadas

Para qualquer outra coisa, escolha **Personalizado…**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-custom-detail-dark.webp">
  <img src="../assets/screenshots/repeat-custom-detail-light.webp" alt="O diálogo Repetir: a cada 1 semana na terça, termina nunca, em uma data, ou depois de um número de vezes" />
</picture>

Depois de **A cada**, digite um número e escolha dias, semanas, meses ou anos. Uma regra semanal mostra então os dias da semana: ative cada dia em que a entrada se repete, e pelo menos um fica ativo. Uma regra mensal se repete no mesmo número de dia do início, como o dia 13, ou no mesmo dia da semana do mês, como a 2ª terça. Quando o início está nos últimos sete dias do seu mês, ela também pode se repetir na última terça.

Em **Termina**, escolha **Nunca**, **Em** uma data, ou **Depois** de um número de vezes. Pressione **Concluído**, e a linha **Repetir** passa a descrever a regra, como "A cada 2 semanas em qui até 18 de dez".

## Alterar ou excluir uma ocorrência

Quando você altera uma ocorrência, o Mitra pergunta a quais entradas você se refere. Ele pergunta quando você arrasta a ocorrência para outro horário, arrasta a sua borda, a exclui, ou altera um campo no seu editor, como o título.

- **Esta entrada** altera apenas a ocorrência que você escolheu.
- **Esta e as seguintes entradas** altera-a e a todas as posteriores. A série termina logo antes dela, e uma nova série começa ali com a sua alteração, de modo que as ocorrências anteriores ficam como estavam. A primeira ocorrência não a oferece, pois ali significaria a série inteira.
- **Todas as entradas** altera todas as ocorrências. Mover uma por um dia move todas, de modo que uma reunião semanal na segunda-feira se torna uma reunião semanal na terça. Redimensionar uma dá a todas a nova duração.

Excluir funciona da mesma forma: **Esta entrada** remove uma data, **Esta e as seguintes entradas** termina a série antes dela, e **Todas as entradas** exclui a série.

Para pular a pergunta e alterar apenas esta ocorrência, segure <kbd>Ctrl</kbd> (<kbd>⌘</kbd> em um Mac) ao soltá-la, ou pressione <kbd>Ctrl</kbd> + <kbd>Delete</kbd> enquanto ela está aberta.

Algumas alterações nunca perguntam. Marcar uma ocorrência de tarefa como concluída se aplica apenas a essa ocorrência, e o mesmo vale para agendar uma ocorrência de uma tarefa que se repete pela sua data de vencimento.

## Ocorrências alteradas e excluídas

Uma ocorrência que você altera com **Esta entrada** sai da série e se torna uma entrada própria. A série pula a sua data, de modo que ela nunca aparece duas vezes, e as alterações posteriores à série inteira não a alcançam.

Uma ocorrência excluída continua excluída. Ela não volta quando você depois move ou altera a série inteira, e os outros aplicativos que usam o mesmo calendário também a deixam de fora.

## Mover uma série para outro calendário

Escolha outro calendário no editor de uma ocorrência, e a mesma pergunta decide se essa ocorrência, o resto da série ou a série inteira é movida, como descrito em [Mover uma única entrada](calendars.md#move-a-single-entry).

## Tarefas recorrentes

Cada ocorrência de uma tarefa recorrente é uma tarefa própria a marcar como concluída. Uma tarefa também pode se repetir apenas pela sua data de vencimento, como pagar o aluguel até o dia 1 de cada mês: veja as [datas de vencimento recorrentes](planning.md#repeating-due-dates). As tarefas recorrentes nunca estão em atraso e não podem ficar sem agendamento, pois as suas datas é que compõem a série.

## Como as repetições aparecem

Algo que se repete com frequência, como um treino diário, aparece como uma [rotina](routines.md) nas vistas de mês e de ano: uma linha de pequenas marcas em vez de uma barra para cada dia. A [linha do tempo](views/timeline.md) mostra apenas as ocorrências de uma tarefa recorrente que vencem, de modo que uma tarefa diária não a enche.

## Que calendários podem se repetir

Os [calendários guardados no Mitra](integrations/mitra.md) e os [servidores de calendário](integrations/caldav.md), incluindo o Google e a Apple, guardam entradas recorrentes. Os calendários do [Notion](integrations/notion.md) e do [Tempo](integrations/tempo.md) não podem, por isso o seu editor não tem uma linha **Repetir**, e o editor de uma série não os oferece como o seu calendário.

Quando você [move todas as entradas de um calendário](calendars.md#move-or-copy-every-entry-to-another-calendar) para um que não pode se repetir, o Mitra pergunta o que fazer com as recorrentes. **Deixá-las aqui** as mantém onde estão. **Desdobrar em entradas individuais** escreve cada ocorrência do próximo ano como uma entrada separada que deixa de se repetir.

A [disponibilidade](availability.md) também é uma entrada recorrente, e começa semanal. Pela mesma razão, não pode ficar em calendários do Notion ou do Tempo.
