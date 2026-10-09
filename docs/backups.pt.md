---
title: Backups
description: Tudo o que o Mitra guarda fica em uma única pasta. Faça backup dela com a ferramenta que você já usa.
---

O Mitra guarda tudo em uma única pasta: `/app/data` dentro do contêiner, que é `~/mitra` no host se você seguiu os [Primeiros passos](README.md#install-mitra). Faça backup dessa pasta e você terá feito backup da instância inteira. Não há servidor de banco de dados para exportar nem arquivos de configuração para separar.

> [!CAUTION]
> Para parte do que você guarda no Mitra, esta pasta é a única cópia. Cada entrada de um [calendário do Mitra](integrations/mitra.md) vive aqui e em nenhum outro lugar. O mesmo vale para suas contas e sessões de login, as credenciais das contas conectadas, suas configurações, as cores, a ordem e os nomes dos seus calendários, sua [disponibilidade](availability.md), a ordem das suas tarefas, alguns vínculos entre entradas e a chave de que dependem os [lembretes](reminders.md) dos seus dispositivos. Se você perder a pasta, um provedor pode devolver seus eventos e tarefas, mas nada além disso.

## Fazer backup

Aponte para a pasta o que você já usa: [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, um snapshot do sistema de arquivos ou da VM, ou um arquivo compactado simples.

A cópia mais segura é a feita com o Mitra parado:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

Se você não puder pará-lo, copiar a pasta com o Mitra em execução geralmente funciona bem, pois o SQLite lida bem com isso. Um snapshot do sistema de arquivos ou da VM dá uma cópia consistente sem parar nada.

## Restaurar

Pare o Mitra, coloque a pasta de volta e inicie-o de novo:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Restaure a pasta inteira. Seus arquivos formam um conjunto, e misturar arquivos de dias diferentes pode quebrar a instância. Um backup de uma versão mais antiga é restaurado sem problemas em uma imagem mais nova, já que o Mitra atualiza o banco de dados ao iniciar.

## O que um backup não cobre

Eventos e tarefas de contas conectadas, como um servidor [CalDAV](integrations/caldav.md), o [Google Calendar](integrations/google.md) ou o [Notion](integrations/notion.md), ficam com esses provedores. O backup inclui a cópia que o Mitra tem deles, e depois de uma restauração o Mitra os sincroniza de novo.

Suas variáveis de ambiente ficam no seu `compose.yaml` ou `.env`, não na pasta de dados. Guarde-os com segurança também, no controle de versão ou no seu cofre de segredos.
