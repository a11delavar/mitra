---
title: Location autocomplete
description: The keyless, privacy-preserving geocoder behind Mitra's location field — and how to point it at your own Photon instance.
sidebar:
  order: 3
---

The entry editor's **location** field autocompletes as you type. It works out of the box with **no API key and no signup**, powered by [Photon](https://photon.komoot.io) — a free, open-source, OpenStreetMap-based geocoder built for search-as-you-type.

## How it works

- Suggestions combine **recently used locations** from your own entries with **geocoder results** from Photon.
- Queries are **proxied through your own server** — location keystrokes leave from the Mitra backend, never directly from the browser, so no user IPs are exposed to the geocoder.
- The UI language and (when granted) your position bias the results toward nearby, sensibly-labelled places.
- A picked suggestion just fills in a nicely formatted string; the location stays plain text, so you can always type anything freely.

By default Mitra queries komoot's public Photon instance. Nothing needs configuring for this to work.

## Self-hosting the geocoder

If you'd rather not rely on komoot's public instance — for privacy, for reliability, or to avoid its fair-use limits at scale — [host Photon yourself](https://github.com/komoot/photon) and point Mitra at it:

```yaml
environment:
  MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```

Mitra will query your instance instead. No frontend changes are needed — the swap is entirely server-side.

## Troubleshooting

- **No suggestions appear.** The public Photon instance may be rate-limiting or briefly down; the field still accepts free text. Consider self-hosting Photon for a dependable experience.
- **Results are in the wrong language or too street-level.** Mitra forwards a supported UI language where it can and biases to a city-level zoom; exact-name matches elsewhere are still returned.
