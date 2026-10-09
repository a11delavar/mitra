---
title: Login único
description: Compartilhe um servidor Mitra com a família ou uma equipe. Todos entram por meio de um provedor OpenID Connect, com uma conta que já têm.
---

De fábrica, o Mitra é para uma pessoa e não tem login, o que serve enquanto só você consegue acessá-lo. Para compartilhar um servidor com a família ou uma equipe, conecte-o a um provedor OpenID Connect (OIDC). Todos passam a entrar com uma conta que já têm e ganham calendários próprios que ninguém mais vê.

O Mitra funciona com qualquer provedor OIDC padrão. As pessoas o usam com Pocket ID, Authelia, Authentik, Keycloak e Google, entre outros.

> [!CAUTION]
> Ativar o login dá a cada pessoa uma conta nova e vazia, inclusive a você. Tudo o que você configurou enquanto o Mitra era para uma pessoa fica com aquela conta antiga e não é transferido: suas contas conectadas, suas configurações e todas as entradas dos seus [calendários do Mitra](integrations/mitra.md). As contas conectadas são rápidas de adicionar de novo, mas as entradas dos calendários do Mitra não podem acompanhar você. Ative o login antes de começar a encher o Mitra, ou mova antes essas entradas para um calendário conectado (**Mover as entradas para…** no menu **⋯** do calendário) e conecte essa conta de novo depois.

## Ativar o login

Defina as variáveis OIDC no contêiner:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'          # the address people use to reach Mitra
      MITRA_OIDC_ISSUER: 'https://auth.example.com'   # your provider's issuer URL
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'                   # leave out for a public client
```

No seu provedor, registre `MITRA_URL` seguida de `/auth/callback` como endereço de redirecionamento:

```text
https://mitra.example.com/auth/callback
```

É tudo de que o provedor precisa. Reinicie o Mitra com `docker compose up -d`, e ele pede a todos que façam login.

Definir `MITRA_OIDC_ISSUER` é o que ativa o login, e ele exige também `MITRA_OIDC_CLIENT_ID` e `MITRA_URL`. Se uma delas estiver faltando, o Mitra se recusa a iniciar. Rodar em silêncio sem login seria muito pior.

## Segredo do cliente e escopos

Se você registrou um segredo de cliente no seu provedor, defina `MITRA_OIDC_CLIENT_SECRET`. Se registrou um cliente público, deixe-o de fora; isso é totalmente suportado, pois o Mitra sempre usa PKCE.

O Mitra solicita os escopos `openid profile email`. O `openid` é obrigatório, e os outros dois dão ao Mitra o nome e o e-mail de cada pessoa. Altere-os com `MITRA_OIDC_SCOPES` apenas se o seu provedor precisar de outra coisa.

## Quem pode entrar

Qualquer pessoa que o seu provedor deixar passar ganha uma conta no Mitra na primeira vez que entra. Não há lista de usuários para gerenciar no Mitra, então decida quem pode entrar no seu provedor, por grupo, atribuição de aplicativo ou como ele tratar o acesso. O nome e o e-mail de cada pessoa são atualizados a partir do provedor a cada login.

## Como o login funciona

O login em si acontece no servidor (o fluxo de código de autorização com PKCE). Seu navegador só recebe um cookie, e nenhum token é guardado no armazenamento dele, então um script malicioso na página não tem nada para roubar.

Uma sessão dura 30 dias a partir da última vez que você usou o Mitra. O cookie é marcado como seguro quando `MITRA_URL` começa com `https://`, e um emissor `http://` é permitido para provedores na sua própria rede sem HTTPS. Se o seu provedor oferecer suporte, sair do Mitra também desconecta você nele.

## Solução de problemas

- **O Mitra não inicia e cita uma variável ausente.** Com `MITRA_OIDC_ISSUER` definida, `MITRA_OIDC_CLIENT_ID` e `MITRA_URL` também precisam estar definidas.
- **O provedor reclama do endereço de redirecionamento.** Ele deve ser exatamente `MITRA_URL` seguida de `/auth/callback`.
- **O log diz que a descoberta falhou.** O Mitra consulta o seu provedor no primeiro login e tenta de novo no seguinte, então um provedor que inicia depois do Mitra se resolve sozinho. Se continuar falhando, verifique a URL do emissor e se o Mitra consegue alcançá-lo, com o [nível de log](logging.md) em `debug`.
- **Meus calendários sumiram depois de ativar o login.** É o esperado: todos começam com uma conta nova. Conecte suas contas de novo.
