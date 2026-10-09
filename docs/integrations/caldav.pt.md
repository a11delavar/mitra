---
title: CalDAV
description: Conecte qualquer servidor CalDAV, como Nextcloud, Radicale, Fastmail ou mailbox.org, e sincronize seus eventos e tarefas nos dois sentidos.
---

CalDAV é o padrão aberto que a maioria dos servidores de calendário fala. Você conecta uma conta CalDAV pelo aplicativo, sem nada para configurar no servidor, e o Mitra sincroniza os eventos e as tarefas dela nos dois sentidos.

Seus calendários continuam no seu servidor, então todo outro aplicativo CalDAV que você usa, como o calendário do celular, vê as mesmas entradas. Essa é a diferença para os [calendários do Mitra](mitra.md), que só o Mitra consegue abrir.

## Conectar uma conta

1. Escolha **Adicionar integração** no fim da barra lateral e depois **CalDAV**.
2. Preencha o formulário:
   - **URL do servidor** é o endereço CalDAV do seu servidor, como `https://caldav.example.com`. A [tabela abaixo](#server-urls-for-common-providers) o lista para provedores comuns.
   - **Nome de usuário** costuma ser o nome da sua conta ou seu endereço de e-mail.
   - **Senha** é a senha da sua conta, ou uma senha de aplicativo, se o seu provedor oferecer uma.
3. Pressione **Conectar**. O Mitra lista os calendários da conta, todos ativados, e diz o que cada um guarda, como "Eventos · Tarefas".
4. Desative os que você não quer e pressione **Salvar**.

O Mitra importa os calendários que você manteve e depois os sincroniza a cada 10 segundos enquanto você estiver com ele aberto (veja [como funciona a sincronização](README.md#how-syncing-works)).

Para mudar a senha depois, abra o menu **⋯** da conta na barra lateral, escolha **Editar**, digite a nova senha e pressione **Salvar**. A URL do servidor e o nome de usuário continuam como estão; para uma conta diferente, conecte-a separadamente.

## URLs de servidor de provedores comuns

Informe ao Mitra o endereço CalDAV do provedor, e ele encontra os calendários a partir dali.

| Provedor | URL do servidor |
| --- | --- |
| Nextcloud | `https://<your-nextcloud>/remote.php/dav` |
| Radicale | `https://<your-radicale>/` (ou `.../<user>/`) |
| Fastmail | `https://caldav.fastmail.com/` |
| mailbox.org | `https://dav.mailbox.org/` |
| Baïkal | `https://<your-baikal>/dav.php` |

Google Calendar e iCloud também falam CalDAV, mas não aceitam a sua senha normal: o Google conecta você pela própria página, e a Apple exige uma senha específica do aplicativo. Use os blocos próprios deles, como descrito em [Google Calendar](google.md) e [Apple Calendar](apple.md).

## O que é sincronizado

Cada calendário do servidor é um calendário no Mitra. Ele guarda eventos, tarefas ou ambos, conforme o servidor permitir. A maioria dos servidores permite ambos; num calendário que aceita apenas um tipo, as novas entradas são sempre desse tipo.

Tudo o que o Mitra guarda sobre uma entrada é sincronizado, até onde o seu servidor o mantém:

- Entradas de dia todo e de vários dias, locais, descrições, cores e lembretes.
- Se uma entrada aparece como ocupado ou disponível, e a visibilidade dela.
- O estado e o progresso de uma tarefa.
- [Participantes](../participants.md). Seu servidor envia os convites e recolhe as respostas.
- [Subtarefas](../subtasks.md) e [dependências](../dependencies.md).

Uma entrada recorrente continua sendo uma única série no servidor. Quando você altera uma única ocorrência, o Mitra pergunta se você quer dizer **Esta entrada**, **Esta e as seguintes entradas** ou **Todas as entradas**, e altera a série de acordo.

Uma tarefa mantém o agendamento, a [data de vencimento e a estimativa](../planning.md#schedule-constraints-and-planning). Se você tem curiosidade sobre como: o início é salvo como `DTSTART`, a duração do agendamento (ou a estimativa, enquanto a tarefa não está agendada) como `ESTIMATED-DURATION`, e a data de vencimento como `DUE`, então os outros aplicativos veem o início e a data de vencimento. Uma tarefa que outro aplicativo, ou uma versão antiga do Mitra, salvou com um início e um `DUE`, mas sem duração, é lida como agendada de um ao outro, sem data de vencimento.

Os calendários compartilhados com você apenas para visualização são marcados como somente leitura. Você ainda pode renomeá-los, mudar a cor, reordená-los e ocultá-los; veja [Calendários somente leitura](../calendars.md#read-only-calendars).

## Disponibilidade ocupada

A [disponibilidade](../availability.md) que você marca como **Ocupado** é adicionada ao calendário dela como eventos ocupados, então o horário aparece como tomado no seu celular e para quem convidar você. Não há nada para configurar.

- Cada disponibilidade ocupada vira um evento recorrente com os mesmos horários e a mesma regra de repetição, marcado como ocupado. Ele leva o nome da disponibilidade, ou "Ocupado" se ela não tiver nome, além do local e da visibilidade dela, como **Privado**.
- Dentro do Mitra você vê a própria disponibilidade em vez desses eventos, então o horário não aparece duas vezes.
- O Mitra mantém os eventos em sintonia com a sua disponibilidade. Se um for alterado, movido ou excluído em outro aplicativo, o Mitra o restaura na próxima sincronização.
- Marcar a disponibilidade como **Disponível** de novo, excluí-la, desativar o calendário dela ou excluir a conta remove os eventos. Mover a disponibilidade para outro calendário move os eventos dela junto.
- Um calendário que só guarda tarefas, ou no qual você não pode gravar, não recebe eventos.

> [!NOTE]
> As alterações em um único dia de disponibilidade ocupada não são transferidas. O evento continua seguindo a regra de repetição, então um dia que você moveu ou encurtou ainda mostra o horário habitual para os outros.

Isso funciona do mesmo jeito para o [Google Calendar](google.md) e o [Apple Calendar](apple.md), aos quais o Mitra também se conecta por CalDAV.

## Solução de problemas

- Se um calendário está faltando, ele está desativado. Isso acontece com os calendários que você desativou ao conectar e com os calendários criados depois no servidor, que o Mitra adiciona desativados. Ative-o em **⋯ → Editar** da conta e pressione **Salvar**. **Atualizar** ali lista os calendários criados no servidor desde a última sincronização.
- Se o Mitra disser "This account is already connected", a conta já está na sua barra lateral. Altere-a em **⋯ → Editar**, por exemplo para digitar uma nova senha.
- Se a conexão falhar, verifique se a URL do servidor começa com `https://` e aponta para o endereço CalDAV, não para a página da web em que você faz login. Para ver todas as requisições que o Mitra faz ao servidor, defina o [nível de log](../logging.md) como `debug`.
- Se um calendário parecer errado depois que você atualizar o Mitra, use **Reimportar entradas** no menu **⋯** dele. A sincronização busca apenas o que mudou no servidor, então as entradas que não mudaram nunca são lidas de novo; uma reimportação lê todas. Veja [Reimportar um calendário](../calendars.md#re-import-a-calendar).
