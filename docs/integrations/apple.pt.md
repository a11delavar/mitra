---
title: Apple Calendar
description: Conecte seus calendários do iCloud ao Mitra com uma senha específica do aplicativo, sem nada para configurar no servidor.
---

O Mitra se conecta aos seus calendários do iCloud por CalDAV e sincroniza os eventos deles nos dois sentidos. A Apple não deixa outros aplicativos entrarem com a sua senha da Apple, então você primeiro cria uma senha específica do aplicativo para o Mitra. Leva um minuto, e não há nada para configurar no servidor.

## Criar uma senha específica do aplicativo

1. Entre em [appleid.apple.com](https://appleid.apple.com/).
2. Em **Sign-In and Security**, escolha **App-Specific Passwords**.
3. Crie uma senha nova, dê a ela o nome "Mitra" para reconhecê-la depois e copie-a.

A Apple só oferece senhas específicas do aplicativo quando a autenticação de dois fatores está ativada na sua conta.

## Conectar sua conta

1. Escolha **Adicionar integração** no fim da barra lateral e depois **Calendário da Apple**.
2. Informe seu **ID da Apple**, o endereço de e-mail com o qual você entra na Apple, e a **Senha específica do aplicativo** que você criou para o Mitra.
3. Pressione **Conectar**. O Mitra lista seus calendários do iCloud, todos ativados.
4. Desative os que você não quer e pressione **Salvar**.

O Mitra importa os calendários que você manteve e os sincroniza a cada 10 segundos enquanto você estiver com ele aberto (veja [como funciona a sincronização](README.md#how-syncing-works)).

## O que é sincronizado

Os eventos são sincronizados nos dois sentidos, com tudo o que o [CalDAV](caldav.md#what-syncs) carrega.

> [!NOTE]
> As tarefas são diferentes. As tarefas que o Mitra salva num calendário do iCloud ficam guardadas no iCloud, e outros aplicativos CalDAV conseguem lê-las, mas o aplicativo Lembretes da Apple não as mostra. O Lembretes deixou de usar CalDAV com o iOS 13, e a Apple não oferece a aplicativos como o Mitra nenhum outro caminho de entrada.

A [disponibilidade](../availability.md) que você marca como ocupado num calendário do iCloud é adicionada a esse calendário como eventos ocupados, então o horário aparece como tomado no seu iPhone e para quem convidar você. Ela funciona como descrito para o [CalDAV](caldav.md#busy-availability).

## Desconectar sua conta

Escolha **Excluir** no menu **⋯** da conta na barra lateral para removê-la do Mitra. Para retirar o acesso do Mitra do lado da Apple, exclua a senha "Mitra" na página **Sign-In and Security** onde você a criou. Sua senha da Apple e seus outros aplicativos não são afetados.

## Solução de problemas

- Se a conexão falhar por causa da senha, verifique se você informou a senha específica do aplicativo, e não a sua senha da Apple.
- Se um calendário está faltando, ele está desativado. Ative-o em **⋯ → Editar** da conta e pressione **Salvar**.
