---
title: Integrações
description: Guarde calendários no próprio Mitra ou conecte CalDAV, Google Calendar, Apple Calendar, assinaturas de calendário, Notion e Tempo, e veja como funciona a sincronização.
sidebar:
  label: Visão geral
---

Há duas maneiras de manter um calendário no Mitra. Você pode guardá-lo no próprio Mitra, no seu servidor, sem nenhuma conta por trás. Ou pode conectar uma conta que você já tem, e o Mitra mantém os calendários dela sincronizados nos dois sentidos. A maioria das pessoas acaba com uma mistura das duas, e as entradas passam livremente de uma para a outra.

Para adicionar qualquer uma, escolha **Adicionar integração** no fim da barra lateral.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/integrations-detail-dark.webp">
  <img src="../../assets/screenshots/integrations-detail-light.webp" alt="A caixa de diálogo Adicionar integração, oferecendo Mitra, CalDAV, Google Calendar, Apple Calendar, assinaturas de calendário, Notion e Tempo" />
</picture>

## O que cada uma guarda

| Integração | O que ela guarda | Configuração no servidor |
| --- | --- | --- |
| [Mitra](mitra.md) | Eventos e tarefas, guardados no Mitra | Nenhuma |
| [CalDAV](caldav.md) | Eventos e tarefas de qualquer servidor CalDAV | Nenhuma |
| [Google Calendar](google.md) | Os calendários de uma conta do Google | Uma configuração OAuth única |
| [Apple Calendar](apple.md) | Os calendários de uma conta do iCloud | Nenhuma |
| [Assinaturas de calendário](subscriptions.md) | Um feed `webcal://` ou `.ics` publicado, somente leitura | Nenhuma |
| [Notion](notion.md) | Tarefas de visualizações de bancos de dados do Notion | Nenhuma |
| [Tempo](tempo.md) | As horas que você registra em itens do Jira | Nenhuma |

Cada provedor guarda coisas diferentes. As tarefas do Notion não podem se repetir, por exemplo, e um worklog do Tempo não tem local. O Mitra oculta os campos que um calendário não consegue guardar, então nada do que você digita desaparece na próxima sincronização.

## Como funciona a sincronização

Ao conectar uma conta, o Mitra encontra os calendários dela e os lista, todos marcados. Desmarque os que você não quer antes de salvar, e o Mitra importa o resto. Os calendários que aparecerem na conta depois chegam desmarcados, então nada novo cai no seu calendário sem que você escolha. O Mitra nunca baixa um calendário que está desativado.

Depois disso, o servidor sincroniza em segundo plano por conta própria. Ele verifica com mais frequência enquanto alguém está com o Mitra aberto e espaça as verificações quando ninguém está:

| | Com o Mitra aberto | Com ninguém usando |
| --- | --- | --- |
| CalDAV e Apple Calendar | a cada 10 segundos | a cada 5 minutos |
| Google Calendar, Notion e Tempo | cerca de uma vez por minuto | a cada 5 minutos |
| Assinaturas de calendário | a cada 15 minutos | a cada 15 minutos |
| Calendários do Mitra | nada a sincronizar | nada a sincronizar |

Google, Notion e Tempo limitam a frequência com que aplicativos podem chamá-los, e por isso são mais lentos. Quando você abre o Mitra, toda conta que está na vez sincroniza na hora, então não há botão de atualizar para apertar.

As mudanças vão nos dois sentidos. Quando você cria, edita, move ou exclui uma entrada, o Mitra grava a alteração no calendário a que ela pertence. Se uma conta falhar, as outras não esperam: o Mitra tenta de novo um minuto depois.

Alguns calendários não podem ser alterados pelo Mitra, como as assinaturas e os calendários compartilhados com você apenas para visualização. Você ainda pode renomeá-los, mudar a cor e ocultá-los; veja [Calendários somente leitura](../calendars.md#read-only-calendars).

> [!NOTE]
> A sincronização busca apenas o que mudou. Se um calendário parecer errado, **Reimportar entradas** no menu **⋯** dele descarta a cópia do Mitra e importa tudo de novo do provedor; veja [Reimportar um calendário](../calendars.md#re-import-a-calendar). Em ambos os casos, nada muda no provedor.

## Alterar uma conta

Cada conta pode ser conectada uma vez. Para trocar a senha dela, ou os calendários dela que o Mitra mostra, escolha **Editar** no menu **⋯** da conta, em vez de adicioná-la de novo. O Google Calendar é a exceção: conectar a mesma conta do Google outra vez renova o acesso do Mitra a ela.
