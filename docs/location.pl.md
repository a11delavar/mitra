---
title: Lokalizacja
description: "Jak pole lokalizacji podpowiada miejsca, co i dokąd wysyła oraz jak zamiast publicznego geokodera używać własnego."
---

Pole lokalizacji w edytorze wpisu podpowiada miejsca podczas pisania. Nie wymaga klucza API ani rejestracji: Mitra korzysta z [Photon](https://photon.komoot.io), darmowego geokodera open source opartego na OpenStreetMap.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/location-detail-dark.webp">
  <img src="../assets/screenshots/location-detail-light.webp" alt="Nowy wpis z wpisaną w polu lokalizacji Genewą i podpowiedziami poniżej: miasto, jego lotnisko, dworzec główny, Pałac Narodów, park i Geneva w stanie Illinois" />
</picture>

## Podpowiedzi

Kliknij pole lokalizacji, aby zobaczyć miejsca ostatnio używane w twoich kalendarzach. Gdy piszesz, lista zawęża się do pasujących miejsc, a od drugiej litery dołączają do nich miejsca z Photona. Wybierz jedno z nich, aby wstawić jego nazwę i adres, albo pisz dalej: lokalizacja to zwykły tekst i możesz wpisać cokolwiek. Przycisk mapy obok pola otwiera lokalizację w Mapach Google.

W podpowiedziach pierwszeństwo mają miejsca w pobliżu. Gdy po raz pierwszy klikniesz pole, przeglądarka może zapytać, czy aplikacja Mitra może korzystać z twojej lokalizacji. Jeśli się zgodzisz, twoja pozycja jest wysyłana z każdym wyszukiwaniem, więc pobliskie miejsca pojawiają się na początku. Jeśli nie, podpowiedzi nadal działają, tylko bez uwzględniania twojej pozycji.

Photon podaje nazwy miejsc po angielsku, niemiecku lub francusku, gdy aplikacja Mitra używa jednego z tych języków, a w pozostałych przypadkach w języku lokalnym.

Kalendarze [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) i [Tempo](integrations/tempo.md) nie przechowują lokalizacji, więc ich wpisy nie mają pola lokalizacji.

## Prywatność

Twoja przeglądarka nigdy nie łączy się z Photonem. Wyszukiwania trafiają do twojego serwera Mitra, który odpytuje Photona i przekazuje odpowiedzi dalej, więc Photon widzi tylko adres twojego serwera, a nie twój. Widzi natomiast to, co wpisujesz, oraz, jeśli na to zezwolisz, twoją pozycję.

Ostatnie miejsca pochodzą wyłącznie z twoich własnych kalendarzy. Na serwerze z wieloma użytkownikami nikt nie widzi miejsc innego użytkownika.

## Własny serwer Photon

Domyślnie Mitra odpytuje publiczny serwer Photon firmy komoot, który ma limity uczciwego użytkowania i nie gwarantuje dostępności. Aby przestać od niego zależeć, [uruchom własny serwer Photon](https://github.com/komoot/photon) i wskaż go aplikacji Mitra w zmiennej `MITRA_PHOTON_URL`:

```yaml
environment:
  MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```

Po ponownym uruchomieniu wyszukiwania trafiają do twojego serwera. W samej aplikacji nic się nie zmienia. Pozostałe ustawienia opisuje strona [Konfiguracja](configuration.md).

## Rozwiązywanie problemów

Jeśli pojawiają się tylko ostatnio używane miejsca, Photon nie odpowiedział w ciągu pięciu sekund albo odrzucił wyszukiwanie. Zdarza się to, gdy publiczny serwer jest przeciążony lub ogranicza liczbę zapytań. Mitra zapisuje wtedy ostrzeżenie w [logu](logging.md). Pole nadal przyjmuje wszystko, co wpiszesz, a [własny serwer Photon](#use-your-own-photon-server) rozwiązuje ten problem.

Jeśli nazwy miejsc są w nieoczekiwanym języku, to ograniczenie Photona: zna tylko angielski, niemiecki i francuski, a dla pozostałych języków używa lokalnej nazwy każdego miejsca.
