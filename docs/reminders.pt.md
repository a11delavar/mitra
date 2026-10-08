---
title: Lembretes
description: Adicione lembretes a eventos e tarefas, escolha os lembretes com que as novas entradas começam e gerencie os dispositivos que os recebem.
---

Um lembrete avisa você de um evento ou de uma tarefa com antecedência, como uma notificação do seu sistema, mesmo com o Mitra fechado. Ele vem do seu próprio servidor do Mitra, então não há outro serviço para assinar. Em um iPhone ou iPad, os lembretes exigem o Mitra [instalado como aplicativo](install-app.md); em qualquer outro lugar, o navegador basta.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/notifications-detail-dark.webp">
  <img src="../assets/screenshots/notifications-detail-light.webp" alt="A página de configurações de Notificações, com os lembretes padrão, a permissão do navegador e a lista de dispositivos" />
</picture>

## Adicionar um lembrete

Abra uma entrada e pressione **＋** na linha de lembretes, a que tem o sino. Escolha quando ele deve disparar: **No início do evento** (**Na hora da tarefa** para uma tarefa), 5 ou 10 minutos, meia hora, uma hora ou um dia antes, ou **Personalizado…** para qualquer outro horário. Uma entrada pode ter vários, e o **✕** ao lado de um o remove.

Um lembrete conta a partir do início da entrada ou, para uma tarefa sem início, a partir da data de vencimento. Na primeira vez que você adiciona um, o navegador pergunta se o Mitra pode mostrar notificações. Se você disser não, o lembrete continua salvo com a entrada.

Uma entrada recorrente avisa você a cada ocorrência. Tarefas que você marcou como concluídas ou canceladas ficam em silêncio, mas um calendário que você oculta não: para silenciar um, desative-o em **⋯ → Editar** da conta dele. Os calendários do [Notion](integrations/notion.md) e do [Tempo](integrations/tempo.md) não guardam lembretes.

## Lembretes padrão

**Configurações → Notificações** define os lembretes com que as novas entradas começam: 30 minutos antes para um evento e na hora da tarefa para uma tarefa, a menos que você os altere ou escolha **Nenhum**. Entradas de dia todo começam sem lembretes.

## Quando um lembrete dispara

A notificação mostra o título da entrada, quando ela acontece e o local, no idioma e no fuso horário do dispositivo. Ela fica até você dispensá-la, e tocar nela abre a entrada. **Em 10 min** a traz de volta mais tarde e, em uma tarefa, **Concluído** marca a tarefa como concluída sem abrir o Mitra. O Safari e o Firefox não mostram esses botões.

Um dispositivo que estava offline quando um lembrete foi enviado o descarta cinco minutos depois do início da entrada, em vez de mostrá-lo atrasado.

## Seus dispositivos

Cada navegador ou aplicativo instalado em que você permite notificações é um dispositivo, e cada dispositivo recebe todos os seus lembretes. **Configurações → Notificações** os lista, com aquele em que você está marcado como **este dispositivo**. Renomeie um com o lápis, remova um com o **✕** e envie um exemplo para você mesmo com **Evento de teste** ou **Tarefa de teste**.

## Solução de problemas

- Se um lembrete não chega, envie um **Evento de teste**. Se o teste chegar, a entrada provavelmente está em um calendário desativado. A permissão vale por navegador e por endereço, então permitir o Mitra em um endereço não vale para outro.
- Se não há a linha **Notificações de lembrete** em **Configurações → Notificações**, este navegador não pode receber notificações do Mitra: em um iPhone ou iPad, abra o [aplicativo instalado](install-app.md) em vez do Safari, e em qualquer outro lugar o Mitra precisa ser servido por HTTPS.
- Se a linha mostra **Bloqueadas**, permita as notificações do Mitra nas configurações de site do navegador.
- Se nada chega no Windows enquanto o Chrome está fechado, ative **Continue running background apps when Google Chrome is closed** nas configurações do Chrome, ou instale o Mitra pelo Edge.

## No servidor

Os lembretes não exigem configuração, só [HTTPS](configuration.md#put-it-behind-https). O Mitra assina suas notificações com uma chave que ele cria na primeira inicialização e guarda no próprio banco de dados, então restaure a pasta de dados inteira a partir dos seus [backups](backups.md): em um banco de dados novo, o Mitra cria uma chave nova, e os dispositivos registrados com a antiga deixam de receber lembretes. Os [logs](logging.md) registram cada lembrete conforme ele sai.
