---
title: Arquivos de calendário
description: "Abra arquivos .ics e links webcal:// com o Mitra e faça dele o aplicativo de calendário que seu computador usa para eles."
---

Arquivos de calendário (`.ics`) e links de assinatura (`webcal://`) são como a web distribui eventos: um convite anexado a um e-mail, um botão "Adicionar ao calendário" em uma página de reservas, um link "Assinar" para os jogos de uma equipe. Depois de instalado, o Mitra pode abrir os dois, e você pode fazer dele o aplicativo que seu computador usa para eles.

> [!NOTE]
> Abrir arquivos e links exige o Mitra [instalado como aplicativo](install-app.md) a partir de um navegador baseado em Chromium em um computador, como Chrome, Edge, Brave ou Opera. Em qualquer navegador, você ainda pode arrastar um arquivo `.ics` para o Mitra.

## Tornar o Mitra o padrão

Instale o Mitra primeiro. Na primeira vez que um arquivo ou link de calendário o abrir, o navegador pode perguntar se o Mitra pode tratá-lo: escolha **Permitir**. Depois, diga ao seu sistema para abrir arquivos `.ics` com o Mitra.

No Windows, clique com o botão direito em um arquivo `.ics` no Explorador de Arquivos e escolha **Abrir com → Escolher outro aplicativo**. Escolha **Mitra** e depois **Sempre**. Você também pode mudar isso depois em **Configurações → Aplicativos → Aplicativos padrão**.

No macOS, clique com Control em um arquivo `.ics` no Finder e escolha **Obter Informações**. Em **Abrir com**, escolha **Mitra**, clique em **Alterar Tudo…** e confirme.

No Linux, clique com o botão direito em um arquivo `.ics` no seu gerenciador de arquivos e abra **Propriedades → Abrir com**. Escolha **Mitra** e defina-o como padrão.

Se o Mitra já estiver aberto, um arquivo ou link que você abrir vai para essa janela em vez de abrir uma segunda.

## Adicionar um arquivo de calendário

Abra um arquivo `.ics` com o Mitra, ou arraste-o para o Mitra a partir da área de trabalho ou do gerenciador de arquivos. Arrastar funciona também em uma aba comum do navegador, sem instalar nada. Vários arquivos abrem um depois do outro.

O Mitra pergunta a qual calendário adicionar as entradas. Antes de adicionar qualquer coisa, ele mostra o que esse calendário não pode guardar: as entradas que ele deixaria de fora e os detalhes que algumas entradas perderiam, como lembretes em um calendário que não os tem. Para prosseguir, pressione o botão que diz quantas entradas são adicionadas, como **Adicionar 12 entradas**. Para escolher outro calendário, volte com a seta. O arquivo em si nunca muda.

Cada entrada é adicionada como uma cópia nova, então adicionar o mesmo arquivo duas vezes dá todas as entradas em dobro. Nada que já esteja no seu calendário é sobrescrito.

As subtarefas e as dependências entre entradas do mesmo arquivo continuam vinculadas depois da importação. Uma série recorrente mantém excluídas as ocorrências excluídas. Uma série com ocorrências editadas, como uma reunião movida para outro dia, fica de fora, porque o Mitra não consegue adicionar uma série junto com as edições dela.

Se a adição falhar no meio, o Mitra remove as entradas que já tinha adicionado, então nada do arquivo fica pela metade. Se ele não conseguir remover algumas, avisa quantas você deve excluir à mão.

## Assinar a partir de um link webcal

Sites que deixam você assinar um calendário, como jogos esportivos, períodos escolares ou feriados, costumam apontar para um endereço `webcal://`. Clique em um, e o Mitra abre o formulário **Subscrição de calendário** com o endereço preenchido. Confira, preencha **Usuário (opcional)** e **Senha (opcional)** se o feed precisar e pressione **Conectar**. Depois ative o calendário e pressione **Salvar**.

Clicar no link nunca assina por conta própria: o Mitra só busca o feed quando você pressiona **Conectar**.

Uma assinatura é um calendário somente leitura que o Mitra mantém atualizado a partir do feed. Veja [Subscrições de calendário](integrations/subscriptions.md) para saber como isso funciona.
