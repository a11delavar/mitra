---
title: IA, anexos, regiões e idiomas
---
O Mitra 0.7 permite anexar arquivos às suas entradas, escreve as datas no formato da sua região, mantém o fuso horário de casa com você quando viaja e mostra o que mudou direto no aplicativo. Ele também arrasta, amplia e carrega mais rápido, e traz muitas pequenas melhorias e correções desde a 0.6.

## IA
Estamos explorando como a IA pode ajudar você a planejar seu tempo, no próprio Mitra e nos assistentes que você já usa.

## Regiões & idiomas
Escolha o seu país junto com o seu idioma. O Mitra então escreve datas, horas e números como se faz lá. A sua semana começa no dia em que começa lá, e o fim de semana cai nos seus dias de folga. Uma prévia mostra como tudo vai ficar antes de você decidir. Os atalhos de teclado agora também funcionam quando o seu teclado escreve em outro alfabeto, como o persa.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="locales-dark.webp">
	<img src="locales-light.webp" alt="A configuração Idioma, aberta nos seus idiomas, com o italiano mostrando os países onde é escrito">
</picture>

Documentação: [Configurações](../../docs/settings.md)

## Fuso horário de casa
O Mitra agora conhece o fuso horário da sua casa e o guarda na sua conta. Quando você viaja, o calendário acompanha o seu dispositivo, e a sua casa fica na coluna ao lado. A sua lista de fusos continua como estava, então, ao voltar, você vê uma única coluna de novo. Os fusos que você adiciona e os nomes que dá a eles são os mesmos em todos os dispositivos. Cada coluna tem o nome curto que as pessoas realmente usam para aquele fuso.

O seletor de fuso horário também foi redesenhado. Fusos com o mesmo nome e o mesmo horário ficam juntos em uma linha, e os do seu próprio país vêm primeiro. Uma casa marca a sua casa, e um alfinete marca o fuso em que você está durante uma viagem.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="time-zones-dark.webp">
	<img src="time-zones-light.webp" alt="O seletor de fuso horário, aberto na sua casa entre os fusos agrupados ao redor">
</picture>

> [!NOTE]
> Se você deu um nome próprio ao fuso horário em que está, dê esse nome a ele mais uma vez, por favor. Até agora, esses nomes ficavam no dispositivo onde você os deu. A partir de agora, um nome acompanha você em todos os dispositivos.

Documentação: [Fusos horários](../../docs/time-zones.md)

## Anexos
Agora você pode anexar arquivos a uma entrada, como um ingresso, uma pauta ou a foto de um quadro branco. Adicione-os com o clipe no editor da entrada, ou arraste-os para a entrada aberta. Clique em um arquivo para abri-lo. Você também pode adicionar um arquivo à descrição, onde uma imagem aparece como imagem e qualquer outro arquivo como link. Se depois você remover o arquivo, o Mitra o remove da descrição também.

Os anexos são sincronizados com o seu calendário. Em um calendário CalDAV, outros apps que usam o mesmo calendário veem os arquivos que você anexa, e o Mitra mostra os arquivos que eles anexaram. No Google Agenda, o Mitra mostra os arquivos do Google Drive anexados a um evento, mas não pode adicionar nem remover nenhum, porque o Google só mantém arquivos do Drive. As imagens de uma página do Notion agora aparecem na descrição da tarefa.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="attachments-dark.webp">
	<img src="attachments-light.webp" alt="Uma tarefa aberta ao lado da sua entrada na semana, cujo clipe mostra que ela tem arquivos: o editor lista um PDF, um esboço e uma planilha acima da descrição, que mostra o esboço">
</picture>

> [!NOTE]
> O Mitra guarda os arquivos que você anexa na pasta de dados dele, então fazer backup dessa pasta também faz backup dos seus arquivos. Você pode limitar o tamanho de um único arquivo com `MITRA_FILE_MAX_SIZE`, e quanto cada pessoa pode guardar no total com `MITRA_FILE_QUOTA`.

Documentação: [Anexos](../../docs/attachments.md)

## Notas de versão no aplicativo
Agora você pode ver o que mudou sem sair do Mitra. A janela Sobre mostra cada versão como o site mostra. Ela traz as notas e as imagens da versão que você usa, junto com as correções que vieram depois. Cada commit também aparece, recolhido até você precisar.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="about-dark.webp">
	<img src="about-light.webp" alt="A caixa Sobre, aberta nas notas e nas imagens de uma versão">
</picture>

## Chinês
O Mitra aprende chinês, em caracteres simplificados: o aplicativo, seu calendário de exemplo, a documentação e o site, com uma fonte feita para ele.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="chinese-detail-dark.webp">
	<img src="chinese-detail-light.webp" alt="O editor de entradas em chinês, com o seletor de datas aberto no mês">
</picture>

Documentação: [Configurações](../../docs/settings.md)
