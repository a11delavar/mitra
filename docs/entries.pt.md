---
title: Entradas
description: "Abra o editor de entradas e veja tudo o que um evento ou uma tarefa pode ter: o calendário, o tipo, a cor, o estado, a descrição e mais."
---

Tudo no seu calendário é uma **entrada**. A maioria das entradas são **eventos**, que acontecem em determinado horário, ou **tarefas**, que você realiza e marca como concluídas. Um terceiro tipo, a [disponibilidade](availability.md), sombreia o tempo que você reserva para algo, por trás dos seus eventos e tarefas.

Esta página trata do editor de entradas: o seu cabeçalho, as linhas abaixo dele e a descrição.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/due-detail-dark.webp">
  <img src="../assets/screenshots/due-detail-light.webp" alt="O editor de uma tarefa no calendário Work, com a sua caixa de estado e título, o início, o fim e a data de vencimento, um link e uma descrição, a visibilidade, os lembretes e as relações" />
</picture>

## Abrir o editor

Clique em uma entrada para abrir o seu editor ao lado dela. Para criar uma, pressione <kbd>C</kbd> ou **Criar** no topo da página. A nova entrada começa na próxima hora cheia, dura uma hora e vai para o seu [calendário padrão](calendars.md#where-new-entries-land). Na [vista semanal](views/week.md), você também pode arrastar sobre um intervalo vazio.

Cada alteração é salva à medida que você a faz. Feche o editor com o seu **✕**, ou clicando fora dele. Em uma tela estreita, como a de um celular, o editor sobe pela parte inferior como uma folha.

## O cabeçalho

A linha superior do editor contém a cor da entrada, o seu calendário, o seu tipo e o menu **⋯**.

### Dar a uma entrada a sua própria cor

Uma entrada usa a cor do seu calendário. Para dar a uma entrada uma cor própria, clique no ponto no início do cabeçalho e escolha uma. **Redefinir para a cor do calendário**, no mesmo seletor, devolve-lhe a cor do calendário.

### Mover uma entrada para outro calendário

Ao lado do ponto fica o nome do calendário da entrada. Clique nele e escolha outro calendário para mover a entrada para lá. A lista omite os calendários que não poderiam guardar algo que a entrada tem, como uma repetição ou o estado **Cancelado**. Veja [Mover uma única entrada](calendars.md#move-a-single-entry).

### Alterar o tipo de uma entrada

Mais adiante, o cabeçalho mostra o tipo da entrada: **Evento**, **Tarefa** ou **Disponibilidade**. Clique nele e escolha outro. Os servidores de calendário mantêm eventos e tarefas separados, por isso o Mitra salva a entrada de novo como o outro tipo e exclui a antiga. O editor continua aberto sobre o resultado.

Tudo o que o novo tipo não puder guardar é descartado. Uma tarefa que se torna evento perde o estado, o progresso, a data de vencimento e a estimativa. Um evento que se torna tarefa perde ocupado ou disponível. A disponibilidade não tem participantes nem lembretes.

O tipo não pode ser alterado em uma entrada recorrente, nem em um calendário que guarda apenas um tipo, como um calendário do Notion. **Disponibilidade** só é oferecida onde o calendário a pode guardar.

### O menu ⋯

**Duplicar** faz uma cópia no mesmo calendário e a abre. Segurar <kbd>Alt</kbd> ao arrastar uma entrada faz uma cópia onde você a soltar.

**Excluir** remove a entrada. Com o editor aberto, <kbd>Delete</kbd> ou <kbd>Backspace</kbd> também a remove, desde que você não esteja digitando em um campo. Se a entrada se repete ou tem subtarefas, o Mitra pergunta a quais você se refere.

Uma entrada do Notion ou do Tempo também oferece **Abrir no Notion** ou **Abrir no Jira**, que a abre no lugar de onde veio.

## Título e horário

O título é a linha grande sob o cabeçalho. As linhas abaixo dele dizem quando a entrada acontece: o seu início, o seu fim, o seu fuso horário e se ela se repete. Para alternar entre dias e horários, pressione **Dia todo** no fim de uma data, que aparece enquanto você está nessa linha.

Uma tarefa também tem uma data de vencimento e, enquanto não está agendada, uma estimativa. Veja [Planeamento](planning.md). Para os fusos horários, veja [Fusos horários](time-zones.md), e para as repetições, [Repetições](repeats.md).

## Estado da tarefa

Uma tarefa tem uma caixa de seleção antes do título e um de quatro estados: **A fazer**, **Em andamento**, **Concluído** ou **Cancelado**. Clique na caixa para marcar a tarefa como concluída, e clique de novo para reabri-la. Para escolher qualquer estado, clique com o botão direito na caixa ou clique nela com <kbd>Alt</kbd>. Isso também funciona no calendário.

As tarefas concluídas e canceladas aparecem riscadas. Um calendário sem estado cancelado, como o Notion, deixa **Cancelado** fora do menu. Uma tarefa com subtarefas ou uma lista de verificação mostra o seu progresso na caixa; veja [Subtarefas](subtasks.md#progress).

## Ocupado ou disponível e visibilidade

A linha com o olho diz o que as outras pessoas ficam sabendo da entrada quando olham para o seu calendário.

Os eventos escolhem entre **Ocupado** e **Disponível**. Ocupado, o padrão, marca o tempo como tomado, de modo que quem verifica quando você está livre para uma reunião o vê como bloqueado. Disponível mostra a entrada sem bloquear o tempo, o que serve para um lembrete para você mesmo ou um feriado em que você não vai folgar. As tarefas não têm ocupado ou disponível. A disponibilidade tem, e começa como disponível; veja [Disponibilidade](availability.md#busy-or-free).

Toda entrada tem uma visibilidade. **Visibilidade padrão** deixa isso a cargo do calendário. **Público** permite que qualquer pessoa que veja o seu calendário leia a entrada. **Privado** pede a outros aplicativos que mostrem às pessoas com quem você compartilha o calendário apenas que o horário está ocupado, e não o que ele é. **Confidencial** é o mais estrito, para entradas que devem ficar entre você e as pessoas convidadas. O Mitra salva a sua escolha com a entrada, e o servidor e os aplicativos que a leem decidem o que ocultar.

## Local, pessoas e mais

- [Local](location.md) guarda um lugar, com um mapa, ou um link de reunião.
- [Participantes](participants.md) lista as pessoas envolvidas e as suas respostas.
- [Lembretes](reminders.md) avisam você antes de a entrada começar, ou antes da data de vencimento de uma tarefa.
- [Links](links.md) reúne os links da descrição acima dele.
- **Subtarefa de** e **Subtarefas** constroem uma árvore de tarefas; veja [Subtarefas](subtasks.md).
- **Bloqueado por** e **Bloqueia** dizem o que precisa terminar primeiro; veja [Dependências](dependencies.md).

## A descrição

Clique na descrição para editá-la e clique em outro lugar para vê-la formatada de novo. Ela é escrita em Markdown, por isso títulos, listas com marcadores e numeradas, texto em negrito e itálico, código, tabelas e links são todos exibidos. Uma citação que começa com `> [!NOTE]`, `> [!TIP]` ou `> [!WARNING]` se torna um destaque colorido. Clicar em um link o abre em vez de editar.

As linhas que começam com `- [ ]` se tornam uma lista de verificação, que você pode marcar sem abrir o texto. Veja [Listas de verificação](subtasks.md#checklists).

## Relações de outros aplicativos

Outros aplicativos de calendário podem vincular entradas de formas que o Mitra não cria por conta própria. O Mitra mostra esses vínculos em uma seção própria: **Relacionado com** para entradas que pertencem juntas, e uma seção com o nome do tipo do vínculo para os tipos que ele não conhece. Você pode remover um vínculo desses com o seu **✕**, mas não adicionar.

## Que calendários suportam isto

Cada calendário guarda coisas diferentes, e o Mitra oculta as linhas que um calendário não pode guardar, de modo que nada do que você digita desaparece na próxima sincronização. Um calendário do Notion guarda apenas tarefas, por exemplo, e um calendário do Google não tem relações. Veja [Integrações](integrations/README.md#what-each-one-holds) para o que cada uma guarda.
