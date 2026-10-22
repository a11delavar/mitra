---
title: Todoist
description: Traga seus projetos do Todoist para o Mitra como calendários de tarefas sincronizados nos dois sentidos.
---

O Mitra se conecta ao Todoist para tarefas. Cada um dos seus projetos do Todoist vira, no Mitra, um calendário que guarda as tarefas dele. O título, a descrição, as datas e a conclusão de uma tarefa são sincronizados nos dois sentidos.

Você se conecta pelo app com o seu token de API. Não há nada para configurar no servidor.

## Conectar uma conta

1. No Todoist, abra **Configurações** → **Integrações** → **Desenvolvedor** e copie o seu token de API.
2. No Mitra, escolha **Adicionar integração** no fim da barra lateral, depois **Todoist**, e cole o token em **Token de API do Todoist**.
3. Pressione **Conectar**. O Mitra lista os seus projetos, cada um com a sua cor do Todoist. Um projeto dentro de outro leva o nome dos dois, como "Trabalho · Lançamento".
4. Escolha os projetos que você quer e pressione **Salvar**.

Você pode conectar mais de uma conta do Todoist. Projetos arquivados não são listados.

## O que é sincronizado

O título, a descrição e a conclusão são sincronizados nos dois sentidos, assim como as datas:

| No Todoist | No Mitra |
| --- | --- |
| Data | O agendamento da tarefa: um dia ou um horário |
| Duração | Por quanto tempo a tarefa está agendada, ou a sua [estimativa](../planning.md#set-an-estimate) enquanto ela não tem data |
| Prazo | A sua [data de vencimento](../planning.md#set-a-due-date) |
| Subtarefa | Uma [subtarefa](../subtasks.md) |

Uma tarefa sem data espera na lista **Sem agendamento** da [aba Planeamento](../planning.md#the-planning-tab). As tarefas que você concluiu nas últimas doze semanas chegam quando você conecta, e depois cada conclusão.

O Todoist guarda um horário como flutuante, o mesmo em qualquer relógio onde você estiver, ou fixo em um fuso horário. O Mitra mantém os dois como são: um horário flutuante continua [o mesmo em todo lugar](../time-zones.md#same-time-everywhere), e um fixo mantém o seu fuso.

Os prazos e as durações fazem parte dos planos Pro e Business do Todoist. Em uma conta gratuita, as tarefas do Todoist não têm data de vencimento, fim nem estimativa no Mitra: uma tarefa com horário é um momento, e uma tarefa em um dia ocupa só esse dia. Quando o seu plano muda, como quando um período de teste começa ou termina, o Mitra lê todas as tarefas de novo. Um prazo é um dia, então uma data de vencimento a que você dá um horário no Mitra mantém só o seu dia.

O Mitra não mostra a prioridade, as etiquetas, a seção, os comentários nem os lembretes de uma tarefa, e os deixa como estão no Todoist. Mover uma tarefa para outro calendário do Todoist a move para aquele projeto, mantendo todos eles.

Para abrir uma tarefa no Todoist, escolha **Abrir no Todoist** no menu **⋯** do editor. Excluir uma tarefa no Mitra a exclui no Todoist.

O Todoist limita a frequência com que aplicativos podem chamá-lo, então o Mitra o sincroniza cerca de uma vez por minuto (veja [como funciona a sincronização](README.md#how-syncing-works)).

## Tarefas que se repetem

Uma tarefa que se repete no Todoist aparece na sua próxima data, como o Todoist a guarda, sem a sua regra. Concluí-la no Mitra a conclui no Todoist, que a passa para a data seguinte, como sempre faz. Movê-la para outro dia muda só a sua próxima data, e a regra continua como está. Para mudar a regra em si, edite a tarefa no Todoist.

## O que fica no Mitra

O Todoist não tem dependências, então as [dependências](../dependencies.md) entre tarefas do Todoist ficam só no Mitra. Elas se perdem se você desconectar a conta ou [reimportar um calendário](../calendars.md#re-import-a-calendar). A tarefa principal de uma subtarefa fica nos dois, desde que seja uma tarefa da mesma conta do Todoist. O Todoist então move a subtarefa para o projeto da sua tarefa principal.

## O que o Todoist não consegue guardar

- Ele guarda só tarefas, então nada de eventos nem de [disponibilidade](../availability.md).
- Uma tarefa está aberta ou concluída, então não há estado **Em andamento** nem **Cancelado**. Uma tarefa que está em andamento em outro lugar volta a ficar **A fazer** quando você a move para o Todoist.
- Você não pode fazer uma tarefa se repetir pelo Mitra.
- No Mitra, uma tarefa não tem lembretes, local, participantes, anexos, progresso, ocupado ou livre, nem visibilidade.

O Mitra oculta esses campos nas tarefas do Todoist, para que nada do que você digitar ali desapareça na sincronização seguinte. Para mover para o Todoist entradas que os usam, veja [Mover ou copiar todas as entradas para outro calendário](../calendars.md#move-or-copy-every-entry-to-another-calendar), que mostra antes o que não iria junto.

## Solução de problemas

- Se o Mitra disser que o Todoist recusou o token de API, copie-o de novo em **Configurações** → **Integrações** → **Desenvolvedor**. Se você o redefiniu no Todoist, abra **⋯ → Editar** da conta no Mitra e cole o novo.
- Se falta um projeto, talvez ele esteja arquivado. Depois de desarquivá-lo no Todoist, abra **⋯ → Editar** da conta no Mitra e pressione **Atualizar**.
