---
title: Notion
description: Traga as visualizações dos seus bancos de dados de tarefas do Notion para o Mitra como calendários de tarefas sincronizados nos dois sentidos.
---

O Mitra se conecta ao Notion para tarefas. Cada visualização de um banco de dados de tarefas, como "Todas as tarefas", "Minhas tarefas" ou um quadro de sprint, vira um calendário no Mitra que guarda exatamente as tarefas que a visualização mostra: o Notion aplica os filtros da visualização, e o Mitra coloca o resultado no seu calendário. O título, o estado, as datas e a descrição de uma tarefa são sincronizados nos dois sentidos.

Você conecta pelo aplicativo com um token de integração. Não há nada para configurar no servidor.

## Conectar um workspace

1. Crie uma integração em [notion.so/profile/integrations](https://www.notion.so/profile/integrations). Uma integração interna basta.
2. Compartilhe seus bancos de dados de tarefas com ela. Abra cada banco de dados no Notion, escolha **•••** → **Connections** e adicione a sua integração.
3. No Mitra, escolha **Adicionar integração** no fim da barra lateral, depois **Notion**, e cole o segredo da integração, que começa com `ntn_`, em **Token de integração**.
4. Pressione **Conectar**. O Mitra lista as visualizações dos bancos de dados que você compartilhou, com o nome do banco de dados e da visualização.
5. Escolha as visualizações que você quer e pressione **Salvar**.

O Mitra ativa uma visualização por banco de dados para começar. Uma tarefa pertence a toda visualização cujos filtros ela atende, então, com duas visualizações do mesmo banco de dados ativadas, ela apareceria duas vezes. Você ainda pode ativar mais de propósito.

O Mitra oferece visualizações de tabela, quadro, lista, calendário, linha do tempo e galeria. Outros tipos de visualização não são listados.

## Quais bancos de dados funcionam

Um banco de dados aparece quando tem uma propriedade do tipo Status e uma do tipo Date. Os modelos de tarefas do próprio Notion têm as duas.

O Mitra lê o estado de uma tarefa a partir do grupo ao qual o status dela no Notion pertence:

| Grupo de status do Notion | Estado no Mitra |
| --- | --- |
| To-do | A fazer |
| In progress | Em andamento |
| Complete | Concluído |

Quando você muda um estado no Mitra, o Notion recebe a primeira opção do grupo correspondente.

A propriedade Date é onde o Mitra coloca a tarefa, então ela é o agendamento da tarefa. Se um banco de dados tem várias propriedades Date, o Mitra prefere uma cujo nome começa com "Due", depois uma chamada "Date", "When", "Deadline", "Scheduled" ou "Do date", e, caso contrário, pega a primeira.

## O que é sincronizado

O título, o estado e a data são sincronizados nos dois sentidos, como datas de dia todo ou com horário. Os horários aparecem no seu próprio fuso horário. Uma tarefa sem data espera na lista **Sem agendamento** da [aba Planeamento](../planning.md#the-planning-tab).

A descrição de uma tarefa é o corpo da página dela no Notion, escrito em Markdown, incluindo listas de tarefas e callouts. Quando você edita a descrição no Mitra, o Mitra substitui apenas o que a descrição mostra. Imagens, incorporações, subpáginas e blocos sincronizados permanecem no Notion como estão, e o Mitra não os mostra.

As propriedades de relação que ligam tarefas dentro do mesmo banco de dados viram vínculos no Mitra, nos dois sentidos. Uma propriedade chamada "Parent task" ou "Sub-tasks" cria [subtarefas](../subtasks.md), uma chamada "Blocked by" ou "Depends on" cria [dependências](../dependencies.md), e as outras relações aparecem com o próprio nome. As relações com outros bancos de dados não são mostradas.

Para abrir uma tarefa no Notion, escolha **Abrir no Notion** no menu **⋯** do editor. Excluir uma tarefa no Mitra move a página dela para a lixeira do Notion, de onde você ainda pode restaurá-la.

O Notion limita a frequência com que aplicativos podem chamá-lo, então o Mitra o sincroniza cerca de uma vez por minuto (veja [como funciona a sincronização](README.md#how-syncing-works)). Uma tarefa nova nunca desaparece por um instante enquanto o Notion se atualiza.

## O que o Notion não consegue guardar

Um banco de dados do Notion guarda tarefas com uma data cada, e isso define o que um calendário do Notion pode guardar:

- Ele guarda apenas tarefas, então não há eventos nem [disponibilidade](../availability.md).
- A única data de uma tarefa é o agendamento dela, então não há data de vencimento nem estimativa.
- As tarefas não podem se repetir e não têm lembretes, local nem participantes.
- Não há estado **Cancelado**, já que o Notion não tem grupo para ele.
- Uma tarefa não pode ter fuso horário próprio, percentual de progresso, ocupado ou disponível, nem visibilidade.

O Mitra oculta esses campos nas tarefas do Notion, então nada do que você digita ali desaparece na próxima sincronização. Para mover para o Notion entradas que os usam, veja [Mover ou copiar cada entrada para outro calendário](../calendars.md#move-or-copy-every-entry-to-another-calendar), que mostra antes o que não chegaria lá.

## Visualizações e filtros

Um calendário mostra o que a visualização dele no Notion mostra, e uma tarefa que você cria nele recebe os valores de filtro da visualização, para cair nela. Uma tarefa adicionada a uma visualização "University" recebe "Area = University", como se você tivesse adicionado a linha no Notion.

O Mitra preenche os filtros que um único valor consegue satisfazer: uma seleção, um status, uma seleção múltipla, uma caixa de seleção ou uma relação com uma página específica. Alguns filtros nenhum valor único consegue atender, como uma fórmula, um intervalo de datas ou uma entre várias opções. Uma tarefa que você cria numa visualização assim não a atende e, como no Notion, não aparece ali. Ela continua no banco de dados, e uma visualização com menos filtros, como "Todas as tarefas", a mostra.

> [!TIP]
> Se uma visualização filtra por uma relação com outro banco de dados, por exemplo tarefas cuja "Area" aponta para uma página "University" num banco de dados "Areas", compartilhe esse banco de dados com a sua integração também. Caso contrário, o Mitra não consegue definir a relação nas tarefas novas, e elas não aparecem na visualização.

## Solução de problemas

- Se um banco de dados não está listado, falta nele uma propriedade Status ou Date, ou ele não está compartilhado com a sua integração (**•••** → **Connections** no Notion). Depois de compartilhá-lo, abra **⋯ → Editar** da conta no Mitra e pressione **Atualizar**.
- Se uma tarefa aparece duas vezes, você ativou duas visualizações do mesmo banco de dados que a incluem. Desative uma delas em **⋯ → Editar** da conta.
