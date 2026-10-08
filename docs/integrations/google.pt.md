---
title: Google Calendar
description: Configure o login do Google uma vez para o seu servidor Mitra, depois conecte contas do Google pelo aplicativo e sincronize os calendários delas nos dois sentidos.
---

O Mitra se conecta ao Google Calendar por CalDAV, como faz com qualquer servidor de calendário. A diferença está no login: o Google não aceita senha, ele pede que você conceda acesso na própria página. Para isso, o Google precisa conhecer o seu servidor Mitra, então quem administra o servidor o registra no Google uma vez e entrega ao Mitra o ID de cliente e o segredo que o Google fornece.

Depois disso, cada pessoa que usa o Mitra conecta a própria conta do Google pelo aplicativo, cada uma com a sua autorização. A configuração tem três passos:

1. [Registrar o Mitra no Google](#register-mitra-with-google).
2. [Entregar ao Mitra o ID de cliente e o segredo](#give-mitra-the-client-id-and-secret).
3. [Conectar uma conta](#connect-an-account).

Os dois primeiros você faz uma vez por servidor Mitra.

## Registrar o Mitra no Google

1. Crie um projeto no [Google Cloud console](https://console.cloud.google.com) e, em **APIs & Services**, ative a **CalDAV API**.
2. Configure a **OAuth consent screen**. Adicione você e todas as outras pessoas que vão conectar uma conta como **test user**, ou publique o aplicativo.
3. Crie um **OAuth client** do tipo **Web application**. Como **authorized redirect URI**, informe o endereço do seu servidor Mitra seguido de `/api/integrations/google/callback`:

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Copie o **client ID** e o **client secret** que o Google mostra.

> [!CAUTION]
> Enquanto a tela de consentimento está em modo de teste, o Google encerra cada autorização após 7 dias, e todo mundo precisa conectar a conta de novo toda semana. Publique o aplicativo para manter as autorizações de forma permanente.

## Entregar ao Mitra o ID de cliente e o segredo

Defina-os como variáveis de ambiente, junto com `MITRA_URL`, o endereço do seu servidor:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'
    # …
```

Depois reinicie o Mitra:

```bash
docker compose up -d
```

Defina as duas variáveis ou nenhuma. O Mitra se recusa a iniciar com um ID de cliente e sem o segredo, para que uma configuração pela metade nunca passe despercebida.

`MITRA_URL` precisa corresponder ao endereço do seu URI de redirecionamento. Sem ela, o Mitra usa o endereço em que você o abriu, o que basta para experimentar em `localhost`. O Google só aceita endereços de redirecionamento `https://` para qualquer coisa que não seja `localhost`, então um servidor de verdade precisa de [HTTPS](../configuration.md#put-it-behind-https) e de `MITRA_URL`. Todas as variáveis estão listadas em [Configuração](../configuration.md#all-variables).

## Conectar uma conta

1. Escolha **Adicionar integração** no fim da barra lateral e depois **Google Agenda**.
2. Pressione **Continuar com o Google**. O Google pede que você escolha uma conta e permita que o Mitra veja e altere seus calendários.
3. De volta ao Mitra, os calendários da conta aparecem listados, todos ativados. Desative os que você não quer e pressione **Salvar**.

Conectar a mesma conta do Google de novo renova a autorização dela em vez de adicioná-la uma segunda vez.

O Google limita a frequência com que aplicativos podem chamá-lo, então o Mitra sincroniza as contas do Google cerca de uma vez por minuto (veja [como funciona a sincronização](README.md#how-syncing-works)).

## Calendários compartilhados com você

Os calendários que você possui aparecem assim que você conecta. Os calendários que outras pessoas compartilharam com você, como o de uma equipe ou de um colega, só chegam a outros aplicativos depois que você permite isso nas configurações do Google:

1. Conectado ao Google, abra [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect).
2. Em **Shared Calendars**, marque cada calendário que você quer no Mitra e pressione **Save**.
3. No Mitra, abra o menu **⋯** da conta na barra lateral, escolha **Editar** e pressione **Atualizar**.
4. Ative os calendários que aparecerem e pressione **Salvar**.

Um calendário compartilhado com você como **See all event details** é somente leitura no Mitra: você vê tudo nele, mas não pode adicionar, alterar nem excluir eventos. Se o dono depois der a você **Make changes to events**, a edição é ativada na próxima sincronização. Veja [Calendários somente leitura](../calendars.md#read-only-calendars).

## O que é sincronizado

Tudo é sincronizado como no [CalDAV](caldav.md#what-syncs), exceto as relações entre entradas. O Google as descarta da sua cópia de um evento, então o Mitra não as oferece nos calendários do Google.

A [disponibilidade](../availability.md) que você marca como ocupado num calendário do Google é adicionada a esse calendário como eventos ocupados, para que os outros vejam o horário como tomado. Ela funciona como descrito para o [CalDAV](caldav.md#busy-availability).

## Seu token do Google

O token que o Google emite nunca sai do servidor. Seu navegador apenas passa pela página do Google para conceder o acesso. O Mitra guarda o token junto com a conta e o usa para obter um acesso de curta duração sempre que sincroniza.

## Desconectar uma conta

Escolha **Excluir** no menu **⋯** da conta para removê-la, e o token dela, do Mitra. Para retirar também o acesso do Mitra do lado do Google, remova o Mitra das [conexões de terceiros da sua conta do Google](https://myaccount.google.com/permissions). Fazer só isso também interrompe a sincronização: a conta continua no Mitra, mas toda sincronização falha até você conectá-la de novo.

## Solução de problemas

- Se, ao escolher **Google Agenda**, aparecer um aviso de que ele não está configurado neste servidor em vez do botão **Continuar com o Google**, `MITRA_GOOGLE_CLIENT_ID` e `MITRA_GOOGLE_CLIENT_SECRET` não estão definidos, ou o Mitra não foi reiniciado desde que você os definiu.
- Se o Google responder `redirect_uri_mismatch`, o URI de redirecionamento no Google Cloud console não corresponde a `MITRA_URL` seguido de `/api/integrations/google/callback`. Ele precisa corresponder exatamente, incluindo `https://` e sem barra no final.
- Se as contas param de sincronizar após 7 dias, a sua tela de consentimento ainda está em modo de teste. Publique o aplicativo e depois conecte as contas de novo.
