---
title: Calendários do Mitra
description: Calendários guardados no próprio Mitra, no seu servidor, sem nenhuma conta por trás.
---

Um calendário do Mitra fica guardado no banco de dados do próprio Mitra, em vez de num provedor. Não há conta para conectar nem nada para sincronizar: você cria um calendário e começa a adicionar entradas. É a maneira mais simples de começar com o Mitra, e um bom lugar para tudo o que não pertence a nenhuma das suas contas existentes.

Os calendários do Mitra ficam no seu servidor, não no seu dispositivo, então estão disponíveis onde quer que você abra o Mitra. Eles podem guardar tudo o que o Mitra suporta: eventos e tarefas, repetições, lembretes, [disponibilidade](../availability.md), [subtarefas](../subtasks.md), [dependências](../dependencies.md), datas de vencimento e estimativas.

## Adicionar calendários do Mitra

1. Escolha **Adicionar integração** no fim da barra lateral e depois **Mitra**.
2. Dê um nome ao seu primeiro calendário.
3. Pressione **Salvar**.

O calendário fica pronto na hora. Você só adiciona a integração uma vez: ela comporta quantos calendários você quiser, então o bloco dela desaparece de **Adicionar integração** depois.

Para adicionar outro calendário, abra o menu **⋯** no título Mitra na barra lateral e escolha **Novo calendário**. Para excluir um, escolha **Excluir calendário** no menu **⋯** desse calendário. Renomear, mudar a cor, reordenar e ocultar funcionam como em qualquer calendário; veja [Calendários](../calendars.md).

> [!CAUTION]
> Excluir um calendário do Mitra exclui todas as entradas dele para sempre, pois não há provedor de onde buscá-las de volta. O Mitra pergunta antes e oferece [mover as entradas](../calendars.md#move-or-copy-every-entry-to-another-calendar) para outro calendário antes de excluir qualquer coisa.

## Mover entradas para dentro e para fora

As entradas passam entre um calendário do Mitra e qualquer outro calendário. Para mover uma, escolha outro calendário no editor dela. Para mover um calendário inteiro, use **⋯ → Mover as entradas para…**, que mostra antes o que o destino não consegue guardar.

Isso também funciona no sentido contrário: você pode começar no Mitra e mover tudo para um calendário CalDAV ou do Google mais tarde.

## Fazer backup deles

Uma conta conectada mantém a própria cópia das suas entradas. Um calendário do Mitra não: as entradas dele existem apenas no banco de dados do Mitra. Certifique-se de que a pasta de dados do Mitra faça parte dos seus [backups](../backups.md).

Se você pretende ativar o [login](../sso.md) mais tarde, saiba que ele começa todo mundo com uma conta nova e vazia. Os calendários do Mitra que você criou antes ficam com a antiga conta de usuário único.

## O que eles não fazem

- Os participantes são guardados como um registro de quem está envolvido, mas ninguém recebe convite e nenhuma resposta chega, porque não há servidor de calendário para enviá-los. Se você mover uma reunião de um calendário CalDAV para cá, o original é excluído lá, e alguns servidores então avisam os participantes de que ela foi cancelada. Copie-a em vez disso se eles não devem ficar sabendo.
- Outros aplicativos não os enxergam. O Mitra não publica seus calendários por CalDAV, então use um servidor [CalDAV](caldav.md) para os calendários que você também quer no aplicativo de calendário do celular.
- Não há nada para reimportar, então **Reimportar entradas** não é oferecido.
