---
title: Calendários
description: Escolha que calendários o Mitra importa, renomeie, altere a cor, reordene e oculte-os, defina para onde vão as novas entradas e mova entradas entre calendários.
---

Cada linha da aba **Calendários** da barra lateral é um calendário. Alguns estão [guardados no Mitra](integrations/mitra.md), e outros vêm de uma conta que você conectou. Ficam sob o título da integração a que pertencem, e tudo nesta página funciona da mesma forma para todos eles, salvo indicação em contrário.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/calendars-detail-dark.webp">
  <img src="../assets/screenshots/calendars-detail-light.webp" alt="A barra lateral, listando uma conta e os seus cinco calendários, cada um na sua própria cor" />
</picture>

Um calendário é uma linha, mesmo quando guarda eventos e tarefas, como a maioria dos calendários CalDAV. Saber se uma determinada entrada é um evento ou uma tarefa é uma questão da entrada.

## Escolher o que é importado

Quando você conecta uma conta, o Mitra encontra os seus calendários e os lista, todos marcados, cada um dizendo o que guarda, como "Eventos · Tarefas". Desmarque os que você não quer antes de salvar. Você pode mudar de ideia depois em **⋯ → Editar** da conta, onde os calendários adicionados à conta desde então esperam desmarcados. O Mitra só sincroniza e guarda os calendários que estão ativados, por isso os outros não custam nada.

## Adicionar ou excluir um calendário

Um calendário de uma conta conectada é criado e excluído no provedor, e o Mitra percebe na sincronização seguinte. Os calendários do Mitra são a exceção: adicione um com **Novo calendário** no menu **⋯** do título do Mitra, e exclua um com **Excluir calendário** no seu próprio menu **⋯**. Se ele ainda tiver entradas, o Mitra oferece **Mover as entradas primeiro…**, para que nada se perca por acidente.

## Ocultar um calendário

O olho no fim de uma linha oculta as entradas desse calendário. Ocultar diz respeito apenas ao que você vê: o calendário continua sincronizando, e as suas entradas voltam logo que você o mostra de novo.

Ocultar não silencia um calendário, por isso os seus [lembretes](reminders.md) continuam disparando. Para parar um calendário por completo, desative-o em **⋯ → Editar** da sua conta.

### Mostrar apenas um calendário

Para afastar todo o resto, escolha **Mostrar apenas este calendário** no menu **⋯** de um calendário, ou clique no seu olho com <kbd>Alt</kbd>. Todos os outros calendários são ocultados, e o Mitra lembra quais você tinha visíveis. O mesmo item de menu passa então a dizer **Mostrar os calendários anteriormente visíveis** e os traz de volta.

Os calendários que já estavam ocultos antes continuam ocultos. Um calendário que você conectou nesse meio-tempo aparece, pois não fazia parte do que você pôs de lado. Mostrar um calendário manualmente também não faz você perder o caminho de volta para os restantes. Você também pode fazer ambos pela [paleta de comandos](shortcuts.md), pesquisando o nome de um calendário.

## Renomear

Clique duas vezes no nome de um calendário, ou escolha **Renomear** no seu menu **⋯**. O nome é seu: a sincronização nunca o sobrescreve. O Mitra só adota de novo o nome do provedor quando o calendário é de fato renomeado lá.

## Alterar a cor

Escolha uma cor no menu **⋯** do calendário. Até você fazê-lo, um calendário usa a cor que o seu provedor lhe dá. Se o provedor não der nenhuma, o Mitra escolhe uma a partir do endereço do calendário, de modo que ela é a mesma em todos os dispositivos. As entradas assumem a cor do seu calendário, a menos que tenham uma cor própria.

## Reordenar

Os calendários começam na ordem em que o Mitra os encontrou, e as contas na ordem em que você as conectou. Para organizá-los você mesmo, arraste um calendário para cima ou para baixo dentro da sua conta, ou arraste uma conta pelo título para movê-la com todos os seus calendários. Em uma tela sensível ao toque, mantenha pressionado por um instante antes de arrastar, pois um simples deslizar rola a lista. **Mover para cima** e **Mover para baixo** no menu **⋯** fazem o mesmo sem arrastar.

Um calendário só se move dentro da sua própria conta. Um calendário que você ativa depois entra no fim da sua conta, de modo que não perturba a ordem que você definiu.

## Onde caem as novas entradas

O calendário com o ícone preenchido é o seu padrão: as novas entradas vão para lá, a menos que você escolha outro. Clique no ícone de um calendário para torná-lo o padrão, e clique de novo no ícone do padrão para limpá-lo. Sem um padrão, as novas entradas vão para o primeiro calendário da lista, por isso mover um calendário para o topo também o torna o padrão. A mesma escolha está em **Configurações → Entradas**.

As novas entradas são eventos, a menos que o calendário só possa guardar tarefas, como uma vista do Notion. Enquanto uma entrada é nova, o seu editor tem um seletor **Evento** / **Tarefa**. Depois de salva, altere-a com **Tipo** no editor, desde que o seu calendário possa guardar o outro tipo. Uma entrada recorrente mantém o seu tipo.

## Mover ou copiar todas as entradas para outro calendário

**Mover as entradas para…** no menu **⋯** de um calendário, ou **Mover as entradas de …** na paleta de comandos, move tudo o que ele contém para outro calendário de uma só vez. Escolha para onde devem ir e, antes de qualquer coisa acontecer, o Mitra mostra o que a mudança custaria:

```
19 of 21 entries move to Personal
✓ 15 arrive with everything they carry
! 4 lose their reminders
⨯ 2 repeat and stay here
```

O relatório depende do que o destino pode guardar, por isso é diferente para um calendário CalDAV e para uma vista do Notion. As entradas que o destino não pode receber de forma alguma, como uma entrada recorrente indo para o Notion, ficam onde estão e são listadas pelo nome.

**Copiar em vez disso** deixa os originais onde estão e coloca uma cópia de cada um no destino. É também assim que você retira entradas de um calendário somente leitura, como uma assinatura: pode-se copiar a partir dele, mas não mover para fora dele.

Os vínculos entre as entradas que você move vão junto, mesmo para o Notion, que dá a cada página um novo ID. Os vínculos de entradas que ficam para trás continuam apontando para as que foram movidas.

Se o destino não puder repetir entradas, o Mitra pergunta o que fazer com as recorrentes: deixá-las aqui, ou desdobrá-las em entradas individuais, uma para cada ocorrência no próximo ano, que deixam de se repetir. Ele nunca desdobra sem perguntar.

> [!NOTE]
> O Mitra copia primeiro e só exclui os originais depois que as cópias chegaram. Não há como desfazer entre dois provedores, por isso esta ordem é a rede de segurança: se algo correr mal, você pode acabar com uma entrada nos dois calendários, mas nunca com uma em falta. Se a cópia falhar, a mudança inteira para e nada é excluído.

### Mover uma única entrada

Para mover uma entrada, abra-a e escolha outro calendário no seu editor. Para uma entrada recorrente, o Mitra pergunta a quais você se refere. **Esta entrada** move essa ocorrência isoladamente, **Esta e as seguintes entradas** move o resto da série e deixa as ocorrências anteriores para trás, e **Todas as entradas** move a série inteira, com a regra de repetição e tudo.

## Calendários somente leitura

Alguns calendários não podem ser alterados a partir do Mitra: as [assinaturas de calendário](integrations/subscriptions.md) e os calendários que alguém compartilhou com você apenas para visualização. O Mitra percebe isso por conta própria e os marca como somente leitura.

Você pode abrir as suas entradas e ler, selecionar e copiar tudo o que contêm, mas não pode criar, alterar, mover ou excluir entradas ali, e uma entrada não pode ser movida para um deles. Renomear, alterar a cor, reordenar e ocultar continuam funcionando, pois são a sua própria vista do calendário. Se o dono depois lhe permitir fazer alterações, o Mitra percebe na sincronização seguinte.

## Reimportar um calendário

**Reimportar entradas**, no menu **⋯** de um calendário ou de uma conta inteira, descarta a cópia que o Mitra tem das entradas e as importa de novo do provedor. Nada muda no provedor. Você não deve precisar disso no dia a dia, pois a [sincronização](integrations/README.md#how-syncing-works) cuida de si mesma; está ali para quando um calendário parece errado ou desatualizado depois de uma atualização. Os calendários do Mitra não o oferecem, pois não há provedor de onde importar.
