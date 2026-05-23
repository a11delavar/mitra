# AI Agent Instructions

When writing code for this project, you must adhere to the following architectural constraints:

- You are an expert in TypeScript, Lit, and modern CSS.
- Use standard Lit decorators (`@component`, `@property`, `@state`).
- Keep components small and reactive. Use shadow DOM encapsulation.
- Do not use heavy frontend frameworks (React/Vue). Stick to standard web components.
- Write concise, performant code. Avoid over-engineering.
- For CSS, use standard nested CSS or modern native features (Container Queries, `color-mix`, native CSS variables).
- When generating Calendar layouts, strictly use the CSS Grid approach.
- **Prefer CSS over JS:** If a layout can be solved with CSS Grid or Flexbox, do not use JavaScript math.
- **Calendar Grid:** The vertical time-grid uses `1440` rows. Map minutes directly to grid rows (e.g., 9:00 AM = row `540`).
- **Overlaps:** Do not write JavaScript collision detection for concurrent events within a single day. Rely on CSS `grid-auto-flow: column`.
- **Responsiveness:** Use CSS Container Queries (`@container`) instead of media queries. Components should adapt to their parent container's size, not the viewport.
- Strongly type all JSON API contracts from the backend proxies.
- **Always update README.md after you make changes and treat that file as the documentation source of truth.**