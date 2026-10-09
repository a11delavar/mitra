---
title: Mitra, um calendário só seu
---
A primeira versão do Mitra: um calendário que coloca suas tarefas na mesma linha do tempo dos seus eventos, sincronizado nos dois sentidos com os calendários que você já mantém.

## Por que o Mitra
Existem bons aplicativos de calendário e existem calendários que você pode hospedar por conta própria, e por muito tempo eles não eram os mesmos.

Os aplicativos bem-acabados vivem nos servidores de outra pessoa e leem tudo o que você escreve neles. Os que você pode rodar em casa são, em sua maioria, servidores: guardam seus calendários com fidelidade e deixam para você olhá-los por meio de qualquer aplicativo que consiga achar. O Mitra nasceu da vontade de ter os dois ao mesmo tempo: um calendário em que é agradável passar o dia, rodando em uma máquina sua e sem prestar contas a ninguém.

Ele não pede que você se mude. O Mitra é uma camada sobre os calendários que você já mantém, e não mais um lugar para mantê-los. Cada fonte do seu tempo é uma integração que se encaixa ao lado das outras, primeiro um servidor CalDAV e muitas outras desde então, e todas se encontram em uma só linha do tempo, enquanto cada uma mantém seus dados onde eles vivem. Seus eventos e suas tarefas também dividem essa linha do tempo, de modo que o trabalho de encaixar uma coisa na outra deixa de acontecer na sua cabeça.

Ele também é uma aposta na web como ela é hoje, e não como era dez anos atrás. O Mitra é escrito para os navegadores atuais e se apoia no que eles já sabem fazer por conta própria: layouts que se adaptam ao próprio espaço, popovers ancorados no lugar, transições entre vistas, um modelo de verdade para datas e fusos horários. Não carregar camadas de compatibilidade nem um framework pesado é o que o mantém pequeno e rápido, deixa que ele seja instalado como aplicativo e o faz sentir-se em casa tanto no celular quanto no computador. O preço é que ele exige um navegador recente, e vai continuar exigindo.

Por baixo disso há uma crença simples: seu tempo é o registro mais pessoal que você mantém. Onde ele fica, quem pode lê-lo e quanta calma dá olhar para ele deveriam ser decisões suas. O Mitra é uma tentativa de tornar isso fácil.

[@a11delavar](https://github.com/a11delavar)

## Vista semanal
Um dia é uma coluna de 24 horas com uma linha na hora atual, e uma semana são sete delas lado a lado. Volte para hoje com um único botão.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="week-dark.webp">
	<img src="week-light.webp" alt="A vista semanal, com a linha na hora atual">
</picture>

Documentação: [Vista semanal](../../docs/views/week.md)

## Vista mensal
O mês rola sem fim, com uma linha para cada semana e uma barra para cada entrada ao longo dos seus dias. Alterne entre ele e a semana pelo cabeçalho.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="month-dark.webp">
	<img src="month-light.webp" alt="A vista mensal, uma linha para cada semana">
</picture>

Documentação: [Vista mensal](../../docs/views/month.md)

## Eventos e tarefas
Uma tarefa fica no dia como um evento, com uma caixa para marcar quando estiver concluída. Arraste na grade para criar uma entrada, arraste-a para movê-la e dê a cada calendário a sua cor.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="entries-dark.webp">
	<img src="entries-light.webp" alt="Eventos e tarefas lado a lado em um dia">
</picture>

Documentação: [Entradas](../../docs/entries.md)

## CalDAV
Conecte um servidor CalDAV, escolha quais dos seus calendários mostrar, e o Mitra os mantém em sincronia nos dois sentidos, com as mudanças feitas em outros lugares aparecendo assim que acontecem.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="caldav-dark.webp">
	<img src="caldav-light.webp" alt="Conectando um servidor CalDAV">
</picture>

Documentação: [CalDAV](../../docs/integrations/caldav.md)

## Notas em Markdown
A descrição de uma entrada é em Markdown: títulos, listas e links aparecem como tais e continuam sendo texto simples para qualquer outro aplicativo.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="markdown-dark.webp">
	<img src="markdown-light.webp" alt="Uma pauta na descrição de uma entrada, escrita em Markdown">
</picture>

## Colaboradores
- [@a11delavar](https://github.com/a11delavar)
