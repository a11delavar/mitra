---
title: Logi
description: Ustaw w MITRA_LOG_LEVEL, ile Mitra zapisuje w logach, i sprawdź, który poziom pomaga przy jakim problemie.
---

Mitra zapisuje logi na standardowe wyjście, więc `docker compose logs` pokazuje wszystko:

```bash
docker compose logs -f mitra
```

Sprawny serwer jest celowo cichy: domyślnie zapisuje tylko to, co ważne. Podnieś poziom, gdy szukasz przyczyny problemu, i obniż go, gdy skończysz.

## Ustawianie poziomu

```yaml
environment:
  MITRA_LOG_LEVEL: 'debug'
```

Każdy poziom obejmuje wszystko, co zapisują poziomy cichsze od niego:

| `MITRA_LOG_LEVEL` | Co dostajesz |
| --- | --- |
| `error` | Tylko błędy. |
| `warn` | Także problemy, które Mitra obeszła, na przykład przypomnienie, którego nie udało się dostarczyć, geokoder, który nie odpowiedział, albo dostawcę logowania, z którym nie udało się połączyć. |
| `info` *(domyślny)* | Także to, co ważne na co dzień: uruchomienie, logowania, połączone konta, zmiany zsynchronizowane od dostawców i wysłane przypomnienia. |
| `debug` | Także każde żądanie z jego statusem i czasem, każdą synchronizację, przyspieszanie i zwalnianie synchronizacji, gdy ktoś otwiera lub zamyka aplikację Mitra, sesje, zmiany we wpisach oraz komunikację z serwerami CalDAV. |
| `trace` | Także każde zapytanie do bazy danych i surowe dane kalendarzy. Jest tego dużo. |

Przy uruchomieniu Mitra zapisuje w logu, na jakim poziomie działa.

> [!NOTE]
> Hasła, tokeny i inne sekrety nigdy nie trafiają do logów, na żadnym poziomie. `debug` i `trace` mogą jednak pokazywać tytuły wpisów i dane kalendarzy, więc przejrzyj log, zanim go komuś udostępnisz.

## Który poziom wybrać

- Gdy kalendarz się nie synchronizuje, `debug` pokazuje każdą synchronizację i zapytania do CalDAV i Notion.
- Gdy przypomnienia nie docierają, już `info` zapisuje każde wysłane przypomnienie, a `debug` dodaje każdą próbę dostarczenia i usunięte urządzenia.
- Gdy widzisz stronę błędu, `error` zawiera ten błąd ze śladem stosu, a domyślny poziom `info` również go obejmuje.
- Gdy musisz zobaczyć dokładnie, co przysłał dostawca, `trace` dodaje surowe dane i zapytania do bazy danych. Włączaj go tylko na krótko.
