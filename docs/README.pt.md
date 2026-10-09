---
title: Primeiros passos
description: Instale o Mitra com Docker Compose, tenha seu primeiro calendário e conheça algumas coisas para experimentar.
sidebar:
  label: Primeiros passos
---

O Mitra é um calendário self-hosted para seus eventos e tarefas. Para dar uma olhada antes, [experimente a demo](https://demo.mitracal.com).

## Instale o Mitra

Com o [Docker](https://docs.docker.com/get-docker/) e o plugin Compose, crie um `compose.yaml`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
```

Execute `docker compose up -d` e abra [http://localhost:3000](http://localhost:3000).

Antes de depender dele, faça [backup](backups.md) de `~/mitra` e [coloque-o atrás de HTTPS](configuration.md#put-it-behind-https). Se outras pessoas forem usá-lo, ative o [login](sso.md) primeiro, pois ativá-lo depois faz todo mundo recomeçar com uma conta vazia.

## Tenha um calendário

O Mitra se oferece para adicionar um quando você o abre pela primeira vez: um [calendário do Mitra](integrations/mitra.md) guardado no seu servidor, ou uma conta que você já tem, como [CalDAV](integrations/caldav.md) ou [Google Calendar](integrations/google.md).

## Coisas para experimentar

- Arraste sobre uma hora vazia na [vista semanal](views/week.md) para criar um evento.
- Pressione **Adicionar tarefa** na aba [Planeamento](planning.md) da barra lateral e, mais tarde, arraste a tarefa para a sua semana.
- Pressione <kbd>/</kbd> e execute **Adicionar disponibilidade** para sombrear seu [horário de trabalho](availability.md).
- [Instale o Mitra no seu celular](install-app.md) para receber [lembretes](reminders.md).
- Pressione <kbd>?</kbd> para ver todos os [atalhos de teclado](shortcuts.md).
