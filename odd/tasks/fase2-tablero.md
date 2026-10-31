# Fase 2 — Tablero · Historial · Deshacer · Reinicio

Objetivo: una sola partida compartida entre pestañas, tablero, historial, deshacer
persistido y reinicio con confirmación propia. Rama: `main`. Runner: `pnpm test`
(core, 100 % ramas) + `pnpm test:ui` (componentes/store).

## Specs

- **S1 — Estado compartido.** Un único `gameStore` (Zustand vanilla, sin middleware
  `persist`) es espejo de lectura de motor + SQLite. Toda mutación:
  `motor (puro) → GameRepository (transacción) → store.set(estado)`. El store se crea con
  inyección de dependencias (`openRepository`, `now`, `rng`) y no importa módulos nativos.
  `boot()` es idempotente: dos llamadas producen una sola carga.
- **S2 — Navegación.** `app/(tabs)/` con 4 pestañas: Sorteo (inicial), Tablero, Historial,
  Ajustes. Iconos + label, targets ≥ 44 pt. La fila secundaria de Sorteo
  (`Deshacer` · `Historial` · `Tablero`) navega con `router.push`.
- **S3 — Grilla en dominio.** `src/core/board/grid.ts`, puro y dentro del gate del 100 %:
  `gridColumns`: 90 → 10, 80 → 10, 75 → 5 (column-major, `B: 1-15 · I: 16-30 ·
N: 31-45 · G: 46-60 · O: 61-75`), custom → `clamp(ceil(sqrt(total)), 5, 12)`.
  `label` sale de `formatLabel`, nunca de la UI.
- **S4 — Tablero.** Grilla con todo el rango; extraída = relleno + tachado + `check`,
  pendiente = contorno tenue. Contador de header `"23 extraídas · 67 pendientes"`.
  Leyenda obligatoria `"Verde = extraída · Gris = pendiente"`. Encabezados sticky
  `B I N G O` en 75. Auto-scroll a la última celda respetando
  `AccessibilityInfo.isReduceMotionEnabled()`. Tap en celda: no-op. Estado vacío
  `"Todavía no salió ninguna bola"`.
- **S5 — Historial.** `FlatList` invertida (última arriba), `getItemLayout` fijo, fila
  `#23 · 67 · HH:mm`, badge `"Última"` en el primer ítem, botón `Deshacer` inline.
  Estado vacío `"Todavía no salió ninguna bola."`.
- **S6 — Deshacer.** End-to-end y persistido: `engine.undo → repo.save(tx) → store`.
  Deja el pool en `len+1`, historial `len-1`, `exhausted → running`, y la próxima
  extracción devuelve exactamente la bola deshecha (§2.6). Sin diálogo; toast
  `"Bola 67 devuelta al bombo"`. Sin historial: botón deshabilitado, no-op.
- **S7 — Confirmación propia.** `ConfirmDialog` propio (nunca `Alert.alert`), con
  `accessibilityViewIsModal` y orden de foco controlado. Copy de reinicio:
  `"¿Reiniciar la partida?"` / `"Se perderán las 23 extracciones. El historial de esta
partida se archivará."` / `[Cancelar]` / `[Reiniciar]`.
- **S8 — Ajustes stub.** Solo sección `PARTIDA`: `Reiniciar partida` visible únicamente
  con partida activa; confirma → partida nueva (`0 de 90`, tablero limpio). La fila
  `Rango numérico` no se muestra todavía.
- **S9 — Estados.** Vacío / cargando / error unificados en Sorteo, Tablero e Historial.
  Un fallo de escritura deja el estado intacto y muestra banner.
- **S10 — Harness de UI.** `jest.ui.config.js` aparte (preset `jest-expo`); `jest.config.js`
  y el gate del 100 % de `src/core` no cambian. `pnpm test:ui` en CI.
- **S11 — E2E.** Flujos Maestro 1, 3, 4 y 5 en verde. Flujo 2 (rango 1-5) queda para
  Fase 3 porque necesita el formulario de rango.
- **S12 — Dependencias.** `zustand`, `@expo/vector-icons`, `jest-expo`,
  `@testing-library/react-native`. Ninguna debe obligar a recompilar el dev client; si
  alguna lo hace, se documenta.

## Tasks

| ID  | Unidad                       | Specs            | Ruta   | Estado    | Commit |
| --- | ---------------------------- | ---------------- | ------ | --------- | ------ |
| T1  | Harness de tests de UI       | S10              | inline | hecho     | TBD    |
| T2  | `gameStore` compartido       | S1, S6 (dominio) | inline | pendiente | —      |
| T3  | Navegación por pestañas      | S2               | inline | pendiente | —      |
| T4  | Grilla en dominio            | S3               | inline | pendiente | —      |
| T5  | Pantalla Tablero             | S4               | inline | pendiente | —      |
| T6  | Pantalla Historial           | S5               | inline | pendiente | —      |
| T7  | Deshacer end-to-end + toast  | S6, S9           | inline | pendiente | —      |
| T8  | ConfirmDialog + Ajustes stub | S7, S8           | inline | pendiente | —      |
| T9  | E2E, CI y docs               | S11, S12         | inline | pendiente | —      |

## Log

- **L1 (2026-10-31, verbatim):** "Mira el archivo @plan-fase2.md y dime qué debo hacer ahora."
  Seguido de: "Haz lo que veas oportuno, por favor." → autoriza ejecutar la Fase 2 con las
  decisiones recomendadas.
- **L2 (2026-10-31, decisiones §10 del plan de fase):** A1 (flujo E2E 2 pasa a Fase 3),
  B sí (stub de Ajustes con solo `Reiniciar partida`), C incluido (tests de componente en
  esta fase), D propio (toast propio, sin librería).
- **L3 (2026-10-31, hallazgo):** el directorio **no era un repositorio Git** aunque el plan
  exige un commit por unidad. Se hizo `git init` y un commit base con el estado de Fase 1
  (`84c335a`), que es el punto de rollback.
- **L4 (2026-10-31, congelado):** `src/core/engine/*` y `src/core/db/*` no se tocan en esta
  fase. `undo` ya está probado al 100 %.

- **L5 (2026-10-31, T1 hecho):** `jest.ui.config.js` (preset `jest-expo`, `roots: src`,
  ignora `src/core/`), `jest.ui.setup.js` (mock de `react-native-safe-area-context`
  usando `.default`), scripts `test:ui`/`test:ui:watch`, y humo de `DrawScreen`.
  Dependencias: `zustand 5.0.16`, `@expo/vector-icons 15.1.1`, `jest-expo 58.0.13`,
  `@testing-library/react-native 14.1.0` (estas dos últimas movidas a `devDependencies`).
  Hallazgo: en RNTL 14 `render()` es **async**; hay que `await render(...)`.
  `pnpm peers check` solo reporta `react-dom@19.3.1` pidiendo `react ^19.3.1` (19.3.0
  instalado): inconsistencia del SDK, no de esta fase.
  Verificación: `pnpm test:ui` 1/1 verde · `pnpm test:coverage` 103/103 y 100 % ·
  `pnpm typecheck`, `pnpm lint`, `pnpm format:check` limpios.
