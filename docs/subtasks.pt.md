---
title: Subtarefas
description: "Divida uma tarefa em subtarefas ou em uma lista de verificação, acompanhe o progresso e conclua, mova ou exclua toda uma árvore de tarefas de uma vez."
---

Uma tarefa pode ter **subtarefas**: tarefas menores que, juntas, a compõem. Uma subtarefa pode ficar em outro calendário, até em outra conta, pode ter subtarefas próprias e pode estar [sem agendamento](planning.md#the-planning-tab).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/hierarchy-detail-dark.webp">
  <img src="../assets/screenshots/hierarchy-detail-light.webp" alt="Uma tarefa com uma lista de verificação na descrição e uma subtarefa concluída, contada como 1/1" />
</picture>

## Adicionar uma subtarefa

Abra a tarefa menor, pressione **＋** em **Subtarefa de** e digite parte do título da tarefa maior. A pesquisa abrange todos os seus calendários. A tarefa maior então a lista em **Subtarefas**, com a contagem de quantas estão concluídas, como 1/3. O vínculo sempre é adicionado a partir da subtarefa: a linha **Subtarefas** da tarefa maior só as lista.

Cada subtarefa da lista mostra sua caixa de seleção na [cor do calendário](calendars.md#recolor), então você pode marcá-la sem sair da tarefa maior. As subtarefas concluídas e canceladas aparecem riscadas. Clique em um título para abrir essa tarefa, ou pressione o **✕** ao lado para remover o vínculo, de qualquer um dos lados. No calendário, uma linha liga uma tarefa às suas subtarefas quando ambas estão à vista.

O Mitra recusa um vínculo que formaria um círculo, como uma tarefa que acabaria sendo subtarefa dela mesma.

## Listas de verificação

A descrição de uma tarefa também pode conter uma lista de verificação, escrita em Markdown:

```markdown
- [ ] Book the venue
- [x] Send the invitations
```

Marque uma caixa direto na descrição para concluí-la. O Mitra troca `[ ]` por `[x]` no texto, então os outros aplicativos que usam o calendário também veem. Marcar caixas nunca muda o status da tarefa por conta própria. Só as tarefas contam suas listas de verificação: as caixas de um evento podem ser marcadas, mas não contam para nada.

## Progresso

Uma tarefa com subtarefas ou uma lista de verificação mostra o progresso. Cada subtarefa e cada caixa conta como um passo, todos com o mesmo peso, então uma tarefa com três caixas e duas subtarefas tem cinco passos.

Uma subtarefa parcialmente concluída conta em parte, tenha ela um progresso próprio ou subtarefas próprias. Se uma tarefa tem três subtarefas, duas delas concluídas e a terceira em 80%, a tarefa está em 93%. As subtarefas canceladas não contam, então o trabalho abandonado nunca segura a tarefa. Eventos vinculados como subtarefas também não contam.

No calendário, o contorno da caixa de seleção de uma tarefa vai se preenchendo conforme ela avança. Aponte para a caixa para ver a contagem, como "2 de 3 subtarefas concluídas", ou "2 de 4 passos concluídos" quando caixas e subtarefas contam juntas. Clique com o botão direito nela, ou clique com <kbd>Alt</kbd>, para abrir o menu de status com a porcentagem exata.

## Definir o progresso à mão

Uma tarefa sem subtarefas e sem lista de verificação pode ter um progresso definido por você. Clique com o botão direito na caixa de seleção, ou clique com <kbd>Alt</kbd>, e arraste **Progresso** em passos de 5%. Em 100%, a tarefa passa a **Concluído**. Abaixo de 100%, uma tarefa concluída volta para **Em andamento**, ou para **A fazer** em 0%. O **✕** ao lado do valor o limpa.

O calendário precisa ser capaz de guardar o progresso: os [servidores de calendário](integrations/caldav.md), o [Apple Calendar](integrations/apple.md) e os [calendários do Mitra](integrations/mitra.md) conseguem. O Google Calendar, o Notion e o Tempo não conseguem, então as tarefas deles não têm o controle **Progresso**.

## Concluir uma árvore de tarefas

Quando você marca a última subtarefa aberta, o Mitra pergunta se deve marcar também a tarefa maior como concluída. Se isso concluir mais tarefas acima, ele oferece marcá-las todas como concluídas. Ele só pergunta quando a lista de verificação da tarefa maior também está totalmente marcada.

Quando você marca uma tarefa como concluída ou cancelada enquanto algumas das suas subtarefas ainda estão abertas, o Mitra pergunta o que fazer com elas: **Marcar como concluída** ou **Marcar como cancelada**. Feche a pergunta para deixá-las abertas. Você pode voltar a ela depois: no menu de status da tarefa, a contagem de subtarefas leva à mesma pergunta.

## Mover ou excluir uma tarefa com subtarefas

Quando você arrasta uma tarefa com subtarefas para outro horário, o Mitra pergunta **Mover também as subtarefas?**. Escolha **Apenas esta entrada**, ou mova a tarefa com todas as subtarefas pelo mesmo intervalo de tempo. Excluir uma tarefa assim pergunta **Excluir também as subtarefas?** do mesmo jeito.

> [!TIP]
> Segure <kbd>Ctrl</kbd> (<kbd>⌘</kbd> em um Mac) ao soltar ou excluir para pular a pergunta e alterar só essa tarefa. Veja os [atalhos de teclado](shortcuts.md).

## Quais calendários oferecem suporte

Um vínculo é salvo com a subtarefa, no calendário da própria entrada. Os [servidores de calendário](integrations/caldav.md), o [Apple Calendar](integrations/apple.md) e os [calendários do Mitra](integrations/mitra.md) guardam qualquer vínculo, e em um servidor de calendário ele é escrito no formato padrão de calendário, para que outros aplicativos que usam o mesmo calendário possam lê-lo.

- No [Notion](integrations/notion.md), um vínculo para uma tarefa do mesmo banco de dados vai para a propriedade de relação correspondente, como "Parent task". O Mitra guarda por conta própria os vínculos para qualquer outra coisa.
- O [Google Calendar](integrations/google.md) descarta vínculos, então uma entrada de um calendário do Google não pode ter um pai. Entradas de outros calendários ainda podem vincular a ela.
- As [subscrições de calendário](integrations/subscriptions.md) são somente leitura, e o [Tempo](integrations/tempo.md) não tem vínculos.
