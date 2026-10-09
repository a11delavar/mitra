---
title: Ubicación
description: "Cómo sugiere lugares el campo de ubicación, qué envía y adónde, y cómo usar tu propio geocodificador en lugar del público."
---

El campo de ubicación del editor de entradas sugiere lugares mientras escribes. No necesita clave de API ni registro: Mitra usa [Photon](https://photon.komoot.io), un geocodificador gratuito y de código abierto basado en OpenStreetMap.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/location-detail-dark.webp">
  <img src="../assets/screenshots/location-detail-light.webp" alt="Una entrada nueva con Ginebra escrito en su ubicación y, debajo, sugerencias: la ciudad, su aeropuerto, su estación principal, el Palacio de las Naciones, un parque y Ginebra en Illinois" />
</picture>

## Sugerencias

Haz clic en el campo de ubicación para ver los lugares usados hace poco en tus calendarios. A medida que escribes, se reducen a los que coinciden y, a partir de la segunda letra, se les suman lugares de Photon. Elige uno para rellenar su nombre y su dirección, o sigue escribiendo: una ubicación es texto sin formato y puedes escribir lo que quieras. El botón de mapa junto al campo abre la ubicación en Google Maps.

Las sugerencias favorecen los lugares cercanos a ti. La primera vez que haces clic en el campo, tu navegador puede preguntar si Mitra puede usar tu ubicación. Si lo permites, tu posición acompaña a cada búsqueda y los lugares cercanos salen primero. Si no, las sugerencias siguen funcionando, sin esa preferencia.

Photon nombra los lugares en inglés, alemán o francés cuando tu navegador está configurado en uno de ellos y, en caso contrario, en el idioma local.

Los calendarios de [Notion](integrations/notion.md) y [Tempo](integrations/tempo.md) no tienen ubicación, así que sus entradas no tienen campo de ubicación.

## Privacidad

Tu navegador nunca contacta con Photon. Las búsquedas van a tu servidor de Mitra, que consulta a Photon y te devuelve las respuestas, así que Photon solo ve la dirección de tu servidor, no la tuya. Sí ve lo que escribes y, si lo permitiste, tu posición.

Los lugares recientes vienen solo de tus propios calendarios. En un servidor con varios usuarios, nadie ve los lugares de otro usuario.

## Usar tu propio servidor de Photon

De forma predeterminada, Mitra consulta el servidor público de Photon de komoot, que tiene límites de uso razonable y ninguna promesa de seguir disponible. Para dejar de depender de él, [aloja Photon tú mismo](https://github.com/komoot/photon) y apunta Mitra hacia él con `MITRA_PHOTON_URL`:

```yaml
environment:
  MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```

Tras un reinicio, las búsquedas van a tu servidor. En la aplicación no cambia nada. Consulta [Configuración](configuration.md) para ver los demás ajustes.

## Solución de problemas

Si solo aparecen lugares recientes, Photon no respondió en cinco segundos o rechazó la búsqueda, algo que ocurre cuando el servidor público está ocupado o limita las solicitudes. Mitra escribe un aviso en su [registro](logging.md). El campo sigue aceptando lo que escribas, y [tu propio servidor de Photon](#use-your-own-photon-server) evita el problema.

Si los lugares aparecen en un idioma inesperado, es un límite de Photon: solo conoce inglés, alemán y francés, y usa el nombre local de cada lugar para cualquier otro idioma.
