---
title: Configuração
description: Como configurar o Mitra com variáveis de ambiente, as que a maioria dos servidores precisa e todas as variáveis com seus valores padrão.
---

O Mitra é configurado inteiramente por variáveis de ambiente. Não há arquivo de configuração para montar: você define variáveis no contêiner, e o Mitra as lê quando inicia. Toda variável é opcional, e uma que você não definir usa o padrão listado [abaixo](#all-variables).

Com o Docker Compose, elas vão no bloco `environment`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

Um arquivo `.env` ou os segredos do Docker funcionam igualmente bem, se você preferir manter os segredos fora do arquivo compose. Uma alteração entra em vigor na próxima vez que o Mitra iniciar:

```bash
docker compose up -d
```

## O que precisa ser configurado no servidor

Quase nada. As pessoas adicionam [calendários do Mitra](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Apple Calendar](integrations/apple.md), [assinaturas de calendário](integrations/subscriptions.md), [Notion](integrations/notion.md) e [Tempo](integrations/tempo.md) elas mesmas, no aplicativo.

Duas coisas precisam de credenciais que você registra antes com outra parte: o [Google Calendar](integrations/google.md) (`MITRA_GOOGLE_*`) e o [login](sso.md) (`MITRA_OIDC_*`).

## Coloque-o atrás de HTTPS

Assim que o Mitra puder ser acessado de qualquer lugar além da sua própria máquina, coloque-o atrás de um proxy reverso como Caddy, Traefik ou nginx e deixe o proxy cuidar do HTTPS. O próprio Mitra fala HTTP simples dentro do contêiner. Alguns recursos só funcionam com HTTPS:

- Os navegadores só permitem [lembretes](reminders.md) e a [instalação do aplicativo](install-app.md) em endereços `https://` (e em `http://localhost`).
- Os cookies do [login](sso.md) só são marcados como seguros em `https://`, e a maioria dos provedores de identidade exige um endereço de redirecionamento `https://`.
- O [Google Calendar](integrations/google.md) exige um endereço de redirecionamento `https://`.

Depois defina [`MITRA_URL`](#set-the-public-url) com o endereço público.

Com o [Caddy](https://caddyserver.com/), basta isto:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

Com o [Traefik](https://traefik.io/), direcione para o Mitra com labels no serviço:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    volumes:
      - ~/mitra:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mitra.rule=Host(`mitra.example.com`)"
      - "traefik.http.services.mitra.loadbalancer.server.port=3000"
    environment:
      MITRA_URL: 'https://mitra.example.com'
```

## Defina a URL pública

`MITRA_URL` é o endereço que as pessoas digitam no navegador para acessar o Mitra, não o endereço interno do contêiner:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

O Mitra monta a partir dela os endereços de retorno do Google Calendar e do login, e marca seus cookies como seguros quando ela começa com `https://`. Você pode omiti-la enquanto experimenta o Mitra em `http://localhost`. Defina-a assim que o Mitra tiver um endereço de verdade, e é obrigatório defini-la para ativar o login.

## Dê um nome à sua instância

`MITRA_NAME` substitui "Mitra" na barra lateral e na aba do navegador:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Clicar no nome abre a caixa de diálogo **Sobre**, que mostra a versão e o commit que você está executando. O [aplicativo instalado](install-app.md) mantém o nome e o ícone "Mitra", porque eles são fixados quando o aplicativo é compilado.

## Todas as variáveis

### Núcleo

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `MITRA_URL` | *(não definida)* | O [endereço público](#set-the-public-url) pelo qual as pessoas acessam o Mitra, como `https://mitra.example.com`. Os endereços de retorno do login e do Google Calendar, e se os cookies são seguros, vêm dela. Opcional enquanto você experimenta o Mitra em localhost, obrigatória para o [login](sso.md) e recomendada para o [Google Calendar](integrations/google.md) e para qualquer servidor público. |
| `MITRA_NAME` | *(Mitra, no idioma de cada pessoa)* | O [nome](#name-your-instance) exibido na barra lateral e na aba do navegador. O [aplicativo instalado](install-app.md) continua "Mitra". |
| `MITRA_PORT` | `3000` | A porta em que o servidor escuta. Com o Docker, altere o lado do host do mapeamento de porta; defina esta apenas quando o próprio processo precisar escutar em outra. A verificação de integridade embutida a acompanha. |
| `MITRA_LOG_LEVEL` | `info` | [Quanto o Mitra registra em log](logging.md): `error`, `warn`, `info`, `debug` ou `trace`. Cada nível inclui tudo o que é mais silencioso que ele. |
| `MITRA_UPDATE_CHECK` | *(ativada)* | Defina como `off` (ou `false`, `0`, `no`) para desativar a [verificação de atualizações](updates.md). |

### Lembretes

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | O contato que os serviços de push veem para os [lembretes](reminders.md) do seu servidor, geralmente um endereço `mailto:`. Ninguém que usa o Mitra o vê. As chaves de assinatura são geradas automaticamente, então não há mais nada para definir. |

### Local

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | O [geocodificador Photon](location.md) por trás do campo de local. Aponte-a para a sua própria instância do Photon em vez da pública da komoot. |

### Google Calendar

Defina as duas para permitir que as pessoas conectem o [Google Calendar](integrations/google.md). Definir só o ID impede o Mitra de iniciar.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(não definida)* | O ID de cliente OAuth do Google Cloud console. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(não definida)* | O segredo de cliente OAuth. Obrigatório sempre que `MITRA_GOOGLE_CLIENT_ID` está definida. |

### Login único

Definir `MITRA_OIDC_ISSUER` ativa o [login](sso.md). Se as variáveis de que ele precisa estiverem faltando, o Mitra se recusa a iniciar.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(não definida)* | A URL do emissor do seu provedor OIDC. Exige `MITRA_OIDC_CLIENT_ID` e `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(não definida)* | O ID de cliente registrado no seu provedor. |
| `MITRA_OIDC_CLIENT_SECRET` | *(não definida)* | O segredo do cliente. Deixe-o de fora para um cliente público; o Mitra sempre usa PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Os escopos que o Mitra solicita, separados por espaços. `openid` é obrigatório; `profile` e `email` dão ao Mitra o nome e o e-mail de cada pessoa. |

### Definidas pela compilação

Você não define estas em um servidor. A compilação ou a imagem as define, ou elas servem para trabalhar no próprio Mitra.

| Variável | Definida por | Descrição |
| --- | --- | --- |
| `MITRA_VERSION` | Compilação | A versão embutida na imagem. |
| `MITRA_COMMIT` | Compilação | O commit embutido na imagem. |
| `MITRA_DEV` | Desenvolvimento | Oferece a integração **Demonstração**, um conjunto de calendários de exemplo, enquanto se trabalha no Mitra. |
| `NODE_ENV` | Imagem | `production` na imagem do contêiner. |

### Exemplo

Um servidor com login, Google Calendar e geocodificador próprio:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'

      # Sign-in
      MITRA_OIDC_ISSUER: 'https://auth.example.com'
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'

      # Google Calendar
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'

      # Your own geocoder
      MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```
