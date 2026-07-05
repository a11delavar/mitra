// Runtimes have begun shipping *partial*, experimental native Temporal implementations (Node 26's
// `ZonedDateTime.add` throws "Not yet implemented" for date units, for instance), and `@3mo/date-time`
// only falls back to its polyfill when no global `Temporal` exists at all (`globalThis.Temporal ??=`).
// This file is `inject`ed ahead of everything else in every esbuild bundle — backend, frontend, and
// tests — so the complete polyfill wins deterministically on every runtime, whatever it happens to
// ship natively. Delete once the native implementations are whole.
import { Temporal } from 'temporal-polyfill'

globalThis.Temporal = Temporal
