---
title: Links
description: "Como o Mitra mostra os links de uma entrada: a reunião em que entrar, a nota a abrir, a página a ler."
---

Os links de uma entrada mostram para onde levam em vez do endereço bruto. Um link de reunião aparece como **Entrar no Google Meet**, um link para uma nota do Obsidian mostra o nome da nota, e uma página da web mostra o site e o caminho, como `example.atlassian.net/browse/DEV-9177`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/links-detail-dark.webp">
  <img src="../assets/screenshots/links-detail-light.webp" alt="O editor de uma entrada com uma linha Links acima da descrição, contendo um link para uma nota no Obsidian" />
</picture>

## No editor

Quando a descrição de uma entrada contém links, o editor os reúne em uma linha **Links** logo acima da descrição, para você abri-los sem ler o texto todo. Clique em um para abri-lo: uma página da web abre em uma nova aba, e qualquer outro link abre o seu aplicativo. Passando de duas linhas, a linha rola.

A linha não tem armazenamento próprio: ela mostra o que a descrição contém. Para adicionar ou remover um link, edite a descrição e a linha acompanha. Todos os outros aplicativos de calendário que você usa veem os mesmos links na descrição.

## Na descrição

Os links da descrição começam com um pequeno ícone do que eles abrem. Um endereço solto, como um colado do navegador, é encurtado para o site e o caminho. Um link que você escreveu com palavras suas mantém as suas palavras.

O Mitra também reconhece links de aplicativos, como `obsidian://open?vault=…`, que a maioria dos aplicativos de calendário deixa como texto simples. Links que executariam código, como `javascript:`, aparecem como texto simples e nunca como links.

## Links de reunião e de aplicativo no local

Um local que é um único link é tratado como esse link em vez de um lugar. Um link do Zoom, Google Meet, Microsoft Teams, Webex, Jitsi, Whereby, FaceTime ou Skype aparece como **Entrar** com o nome do serviço, no editor, no calendário e na tabela. Ele não ganha botão de mapa. Clique ao lado do link para editá-lo.

## Links para aplicativos

O Mitra dá nome ao aplicativo a que um link pertence a partir do endereço. Ele conhece Obsidian, Notion, Slack, Linear, Figma, Things, OmniFocus, Bear, Craft, Drafts, DEVONthink, Evernote, OneNote, Visual Studio Code, Cursor e Spotify. Todo link de aplicativo, conhecido ou não, mostra o mesmo ícone para abrir em outro aplicativo.

> [!NOTE]
> Uma página da web não sabe dizer se um aplicativo está instalado. Na primeira vez que você abre um link de aplicativo, o navegador pergunta se deve abrir o aplicativo. Se o aplicativo não existir, nada acontece.
