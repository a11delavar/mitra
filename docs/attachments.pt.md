---
title: Anexos
description: "Adicione arquivos a um evento ou a uma tarefa. O Mitra os guarda no seu servidor e os salva com a entrada, então outros apps de calendário também os veem."
---

Uma entrada pode ter **anexos**: arquivos como um ingresso, a foto de um quadro branco ou uma receita. O Mitra guarda o arquivo no seu servidor e o salva com a entrada no formato padrão de calendário, então outros apps que usam o mesmo calendário, como o Nextcloud ou o Apple Calendar, mostram o mesmo arquivo no mesmo evento.

## Adicionar um arquivo

Abra a entrada e pressione **＋** na linha com o clipe, ou a palavra **Anexos** enquanto a linha ainda estiver vazia, e escolha um ou mais arquivos. Cada anexo mostra um ícone do seu tipo, o nome e o tamanho. Clique em um para abri-lo em uma nova aba, e pressione o **✕** dele para tirá-lo da entrada.

Um clipe na entrada no calendário mostra quais entradas têm arquivos.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/attachments-detail-dark.webp">
  <img src="../assets/screenshots/attachments-detail-light.webp" alt="Uma tarefa aberta ao lado da sua entrada na semana, cujo clipe mostra que ela tem arquivos: o editor lista um PDF, um esboço e uma planilha acima da descrição, que mostra o esboço" />
</picture>

Links não são anexos. Para adicionar um link a uma entrada, escreva-o na descrição, e a linha [Links](links.md) o mostra.

## Onde os arquivos ficam

Os arquivos que você adiciona ficam na pasta `files` da pasta de dados do Mitra, ao lado do banco de dados, então um [backup](backups.md) dessa pasta os inclui. Cada arquivo é salvo com um nome aleatório em vez do próprio, e o mesmo arquivo adicionado duas vezes é guardado uma só vez.

> [!IMPORTANT]
> Quem tiver o endereço de um arquivo pode abri-lo sem entrar no Mitra. É isso que permite que outros apps de calendário abram o arquivo: o Mitra escreve o endereço no seu calendário, e esses apps não podem entrar no Mitra. O endereço contém uma parte aleatória que não dá para adivinhar, mas trate-o como qualquer link de compartilhamento. Para ter um endereço novo, remova o anexo e adicione o arquivo de novo.

Imagens, vídeos, áudio, PDFs e texto simples abrem no navegador. Qualquer outro tipo de arquivo é baixado, então um arquivo nunca pode executar código dentro do Mitra.

## Limites

Um único arquivo pode ter até 25 MB, e não há limite para quanto uma pessoa pode guardar. Quem administra o servidor pode mudar os dois, ou desativar o envio de arquivos; veja [Configuração](configuration.md#attachments). Na [demonstração](https://demo.mitracal.com), adicionar arquivos está sempre desativado.

Um arquivo que nenhuma entrada usa mais é apagado cerca de um dia depois de ser adicionado. Até lá, você ainda pode adicioná-lo a uma entrada que ainda não salvou, ou colocá-lo de volta depois de removê-lo por engano.

## Que calendários suportam isto

Os calendários de um [servidor CalDAV](integrations/caldav.md) e do [Apple Calendar](integrations/apple.md) guardam anexos, assim como os [calendários do Mitra](integrations/mitra.md). Em uma [assinatura de calendário](integrations/subscriptions.md), você vê os anexos que o feed traz, mas não pode alterá-los.

Um arquivo também pode aparecer na descrição: o botão de imagem ou de link na linha dele o acrescenta ao fim do texto, como imagem para imagens e como link para o resto. Remover o anexo remove isso também.

Em um [calendário do Google](integrations/google.md), os anexos são os arquivos do Google Drive anexados no Google Agenda: o Mitra os mostra, mas não pode adicionar nem remover nenhum. Os calendários do [Notion](integrations/notion.md), do [Todoist](integrations/todoist.md) e do [Tempo](integrations/tempo.md) não têm linha de anexos. Mover uma entrada com anexos para um deles perde os arquivos, e o Mitra avisa antes de mover qualquer coisa.

> [!NOTE]
> Anexos que outros apps adicionaram também aparecem no Mitra, incluindo arquivos que o seu próprio servidor de calendário guarda, que abrem com o endereço desse servidor. O Mitra deixa exatamente como estão os anexos que não reconhece, então editar uma entrada no Mitra nunca muda os anexos de outro app.
