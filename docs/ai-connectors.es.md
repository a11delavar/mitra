---
title: Conectores de IA
description: Conecta herramientas de IA como Claude o Cursor a Mitra para que puedan leer y cambiar tus calendarios.
---

Mitra habla el Model Context Protocol (MCP), así que las herramientas de IA pueden trabajar con tus calendarios: mirar tu semana, encontrar una entrada, planificar una tarea, mover una reunión. Todas se conectan a la misma dirección, `https://<tu Mitra>/api/mcp`, que **Ajustes → IA** muestra en **Conectores de IA**. Claude llama conector a una conexión así; Cursor y otros, servidor MCP.

Una herramienta conectada ve y cambia exactamente lo mismo que tú en Mitra, en todos tus calendarios conectados, y un cambio que hace llega al proveedor igual que llegaría uno tuyo.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/ai-connectors-detail-dark.webp">
  <img src="../assets/screenshots/ai-connectors-detail-light.webp" alt="El cuadro de diálogo de ajustes, abierto en la página IA con la dirección a la que conectar" />
</picture>

## Conectar una herramienta

Donde se [inicia sesión](sso.md), una herramienta necesita un token de acceso:

1. Abre **Ajustes → IA** y elige **Nuevo token** en **Tokens de acceso**.
2. Ponle un nombre según su uso, como el portátil o Claude, y elige **Solo lectura** o **Lectura y escritura**.
3. Copia el token. Mitra solo guarda una huella de él, así que se muestra solo esta vez.

Un token actúa en tu nombre hasta que lo revocas en esa misma lista, que también muestra cuándo se usó cada uno por última vez. Un token de solo lectura ofrece a la herramienta solo lo que lee.

Sin inicio de sesión, Mitra es para una sola persona y no pide ningún token: basta con la dirección. Entonces cualquiera que pueda llegar a esa dirección puede usarla, así que mantén ese servidor privado.

Muchas herramientas también saben configurarse solas: pide a Claude Code o a Cursor que se conecte a la dirección con el token, y escribirá su propia configuración. Los ejemplos de abajo hacen lo mismo a mano y omiten la cabecera `Authorization` donde no hace falta token.

### Claude Code

```sh
claude mcp add --transport http mitra https://mitra.example.com/api/mcp --header "Authorization: Bearer mitra_…"
```

### Cursor

Añade Mitra a `.cursor/mcp.json` en un proyecto, o a `~/.cursor/mcp.json` para todos:

```json
{
  "mcpServers": {
    "mitra": {
      "url": "https://mitra.example.com/api/mcp",
      "headers": { "Authorization": "Bearer mitra_…" }
    }
  }
}
```

### Claude Desktop

Claude Desktop llega a una dirección con token a través de `mcp-remote`, que necesita Node.js. Añádelo a `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mitra": {
      "command": "npx",
      "args": ["mcp-remote", "https://mitra.example.com/api/mcp", "--header", "Authorization:${MITRA_TOKEN}"],
      "env": { "MITRA_TOKEN": "Bearer mitra_…" }
    }
  }
}
```

## Qué puede hacer una herramienta conectada

Una herramienta conectada trabaja con tus calendarios como lo harías tú en Mitra. Puede:

- mirar un día o una semana, con lo que está vencido y lo que sigue sin programar
- encontrar entradas y leerlas completas
- crear, cambiar, completar y eliminar entradas, una sola ocurrencia de una entrada recurrente o todas
- invitar a personas donde el calendario admite [participantes](participants.md); que se les avise depende del proveedor
- relacionar entradas como [dependencias](dependencies.md) y [subtareas](subtasks.md)
- crear y eliminar calendarios donde el proveedor lo permite

Lee todos tus calendarios, incluidos los que has ocultado en la barra lateral, y conoce tu zona horaria y el idioma y la región que elegiste en **Ajustes → General**, así que puede expresar tus fechas tal como tú las escribes.

> [!CAUTION]
> Las entradas vienen de calendarios en los que otras personas pueden escribir, como un calendario compartido o una invitación. Su texto llega a la herramienta como cualquier otra cosa que lea, así que da un token con escritura solo a una herramienta en la que confiarías aunque tuviera delante la nota de un desconocido.

## En el navegador

Donde el propio asistente del navegador puede usar lo que ofrece una página (WebMCP, una función temprana de Chrome), un Mitra abierto ofrece lo mismo, sin nada que configurar.

## Desactivarlo

Define [`MITRA_MCP`](configuration.md) como `off` y ninguna herramienta podrá conectarse. La [demo](https://demo.mitracal.com) nunca acepta conexiones.
