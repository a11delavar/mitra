---
title: Disponibilidade
description: Marque o tempo que você reserva para trabalho, estudo ou qualquer outra coisa no calendário dele e mostre-o como ocupado para os outros quando quiser.
---

**Disponibilidade** é o tempo que você reserva com regularidade, como o trabalho de segunda a quarta, o estudo na quinta e na sexta ou a casa no sábado. O Mitra o sombreia na vista de **Semana**, na cor do seu calendário.

A disponibilidade pertence a um calendário, ao lado dos eventos e das tarefas dele. Seu horário de trabalho vai no calendário do trabalho, e seu tempo de estudo no calendário da universidade. Ela não é um compromisso, então o Mitra a guarda por conta própria em vez de adicioná-la à sua conta. A [disponibilidade ocupada](#busy-or-free) é a única exceção.

Ela é o formato habitual da sua semana, não uma cerca. Uma consulta no dentista no meio do seu horário de trabalho não tem problema.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-detail-dark.webp">
  <img src="../assets/screenshots/availability-detail-light.webp" alt="Três dias da vista de semana: horário de trabalho e tempo de estudo sombreados nas cores dos seus calendários, com o trabalho da tarde de quarta-feira marcado como Home office" />
</picture>

## Com nome ou sem

Sem nome, uma janela é só o seu sombreado. Isso serve para a maior parte da disponibilidade, já que a cor do calendário diz para que serve aquele tempo. Dê a ela um nome ou um local, e esse texto corre pela borda do dia, como Tempo de foco dentro do seu horário de trabalho, ou Escritório e Home office em dias diferentes.

Onde as janelas se sobrepõem, os sombreados se misturam e ficam mais escuros, e os rótulos se afastam: o primeiro vai para o início, o último para o fim.

## Adicionar disponibilidade

Abra a paleta de comandos com <kbd>/</kbd> ou <kbd>Ctrl</kbd> + <kbd>K</kbd> e execute **Adicionar disponibilidade**. Ela vai para o seu calendário padrão:

- Se esse calendário ainda não tem disponibilidade, você recebe um horário de trabalho de segunda a sexta, das 9h às 17h.
- Caso contrário, você recebe uma janela no dia da semana de hoje.

O editor abre, e você pode mudar os horários, os dias, o nome, o local ou o calendário. Uma entrada que não se repete também pode virar disponibilidade pelo seu **Tipo**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-editor-detail-dark.webp">
  <img src="../assets/screenshots/availability-editor-detail-light.webp" alt="O editor do trabalho de quarta-feira: o horário, a repetição semanal, Home office como local e Disponível" />
</picture>

## Editar e mover

- Clique dentro de uma janela para abri-la. Arrastar sobre ela ainda cria uma entrada normal, como em qualquer parte vazia da grade.
- A disponibilidade se repete como qualquer outra entrada. Ela tem fuso horário e regra de repetição, e quando você altera ou exclui um dia dela, o Mitra pergunta se você quer dizer aquele dia ou todos.
- O campo **Calendário** do editor a move para outro calendário. Mover as entradas de um calendário com **Mover as entradas para…** leva junto a disponibilidade dele.
- A disponibilidade só aparece na vista de Semana. Ela não aparece em Mês, Ano, Linha do tempo nem Tabela, nem nos resultados de pesquisa, nem nas relações.

## Mostrar e ocultar

O olho de um calendário na barra lateral oculta a disponibilidade dele junto com os eventos e as tarefas. Para ocultar toda a disponibilidade e mais nada, ative **Ocultar disponibilidade** em **Configurações → Calendário**, ou encontre-a na paleta de comandos.

## Onde a disponibilidade pode ficar

Qualquer calendário em que você possa adicionar entradas pode guardar disponibilidade, incluindo os calendários do [Mitra](integrations/mitra.md). Estes não podem:

- Os calendários do [Notion](integrations/notion.md) e do [Tempo](integrations/tempo.md), já que as entradas deles não se repetem.
- Os calendários somente leitura, como as [subscrições de calendário](integrations/subscriptions.md).

A disponibilidade fica com o seu calendário. Excluir o calendário, ou desconectar a conta a que ele pertence, exclui também a disponibilidade.

## Ocupado ou disponível

A disponibilidade tem a mesma escolha **Mostrar como ocupado ou disponível** que um evento. Ela começa como **Disponível**, o que combina com o horário de trabalho: você aceita ser agendado nesse tempo. Escolha **Ocupado** para o tempo que os outros não devem tomar, como o tempo de foco.

Dentro do Mitra, as duas parecem iguais. A diferença está no que as outras pessoas veem. A disponibilidade livre nunca é gravada em nenhuma das suas contas. A disponibilidade ocupada em um [calendário CalDAV, Google ou Apple](integrations/caldav.md#busy-availability) é adicionada a esse calendário como eventos ocupados, com seu nome e local, de modo que aparece no seu celular e quem convida você vê o horário como tomado.
