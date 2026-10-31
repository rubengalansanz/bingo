# Plan de ejecución — Fase 2: Tablero · Historial · Deshacer · Reinicio

> Complemento de `plan-bingo.md` (§7.1, §7.3, §7.4, §7.6, §8.5, §10). El spec no se
> modifica con este documento: aquí solo se traduce en unidades de trabajo ejecutables.
>
> Escrito el 2026-10-31, al cerrar la Fase 1 (motor + SQLite + pantalla de sorteo).
> Para retomar: leer §1 (gate), §6 (unidades en orden) y §10 (decisiones abiertas).

---

## 1. Gate de salida (Definition of Done)

- [ ] Flujos E2E en verde: **1, 3, 4, 5** (el **2** queda condicionado a la decisión
      abierta A de §10; ver §8).
- [ ] Tablero navegable con **TalkBack y VoiceOver**: cada celda anuncia número y
      estado, el estado no depende solo del color, el contador se anuncia al cambiar.
- [ ] `pnpm typecheck && pnpm lint && pnpm format:check` limpios.
- [ ] `pnpm test` (core, **100 % ramas**) y `pnpm test:ui` verdes.
- [ ] `npx expo-doctor` 20/20 y `npx expo export --platform android` compila.
- [ ] Ninguna dependencia nueva obliga a recompilar el dev client (o queda documentado
      en §9 si alguna lo hace).

**No se avanza a la Fase 3 (temas, MMKV, formulario de rango) sin este gate.**

---

## 2. Alcance

### En esta fase

| # | Entrega | Referencia |
|---|---------|-----------|
| 1 | Estado de partida compartido entre pantallas (un solo juego en memoria) | §5.4 |
| 2 | Navegación por pestañas: Sorteo · Tablero · Historial · Ajustes | §7.1 |
| 3 | Tablero con los 3 formatos de grilla (90 / 75 con letras / custom) | §7.3 |
| 4 | Historial invertido con timestamp y estado vacío | §7.4 |
| 5 | Deshacer end-to-end (motor → transacción → store) + toast | §2.6, §7.4 |
| 6 | Diálogo de confirmación propio + **Reiniciar partida** | §7.6, ADR-12 |
| 7 | Estados vacío / completo / error en todas las pantallas | §7.7 |
| 8 | Harness de tests de componente y flujos E2E 1-5 (Maestro) | §8.1, §8.5 |

### Fuera de alcance (no tocar en Fase 2)

Temas y tokens (§4, Fase 3) · MMKV y preferencias (§5.5, Fase 3) · formulario de rango
(§3.2-3.3, Fase 3) · animación, sonido, hápticos, `reduceMotion` de usuario (§4.4, Fase 4)
· i18n (Fase 4) · anuncios y publicación (Fase 4) · backlog post-MVP (§11.3).

---

## 3. Punto de partida (estado tras Fase 1)

| Qué ya existe | Qué le toca en Fase 2 |
|---|---|
| `src/core/engine/game.ts` (createGame/draw/undo/reset/integrityCheck) y `range.ts` | **No se toca.** `undo` ya está probado al 100 % |
| `src/core/db/*` (puerto, migración 001, `GameRepository`) | Sin cambios de esquema. Se usa `save()` para persistir el undo |
| `src/shared/db/client.ts` (adaptador expo-sqlite + singleton) | El singleton pasa a inyectarse en el store |
| `src/features/draw/{DrawScreen,useGame}.ts` | La lógica de `useGame` se mueve al store; la pantalla se queda con presentación |
| `app/{_layout,index}.tsx` | `index` se muda a `app/(tabs)/`; `_layout` orquesta el boot |
| `jest.config.js` (ts-jest, `roots: src/core`, 100 %) | **No se toca**: se añade un config aparte para UI |
| `.maestro/smoke.yaml` | Se amplía a los flujos 1-5 |
| `coverage` 100 % en `src/core` con 103 tests | Se mantiene intacto como gate |

---

## 4. Decisiones de arquitectura de la fase

### 4.1 Estado compartido: `gameStore` (Zustand, ADR-07 / §5.4)

Hoy `useGame` vive dentro de `DrawScreen`: en cuanto existan cuatro pestañas, cada una
tendría **su propia partida** y el tablero no se enteraría de las extracciones. Se crea
un único store que espeje lo persistido:

```
UI action → store → engine (puro) → GameRepository (transacción) → store.set(estado)
```

- Zustand **sin** middleware `persist` (ADR-07): la verdad sigue siendo motor + SQLite;
  el store es caché de lectura, y toda escritura pasa por `GameRepository`.
- El store se construye con **inyección de dependencias**: `createGameStore(deps)` recibe
  `{ repository, now, rng }`. El singleton real se ata en `app/_layout.tsx`; los tests
 用品 la fábrica con el repositorio `better-sqlite3` de `src/core/db/__tests__`. Sin
  `jest.mock` global y sin tocar `src/core`.
- API propuesta (ajustable al implementar):

```ts
type GameStore = {
  phase: 'loading' | 'ready' | 'error';
  game: Game | null;
  banner: Banner | null;
  busy: boolean;          // lock de mutación (§7.9): un solo escritor ⇒ vive aquí
  boot(): Promise<void>;  // loadCurrent → integrityCheck → repair/save, o createGame
  drawBall(): void;       // engine → commit → estado (§2.5)
  undoBall(): void;       // engine.undo → repo.save(tx) → estado
  startNewGame(): void;   // createGame + repo.saveNew (archiva la anterior)
};
```

- `boot()` se dispara una sola vez desde `app/_layout.tsx` y debe ser **idempotente**
  (guard `phase !== 'loading'`) para sobrevivir a doble montaje en desarrollo.
- Lo transitorio sigue local (§5.4): el toast y el sheet/dialog abierto son `useState`
  de la pantalla, no del store.

### 4.2 Navegación: `(tabs)` con Sorteo como inicial

```
app/
  _layout.tsx          # boot del store + Stack + ToastHost (si se comparte)
  (tabs)/
    _layout.tsx        # Tabs: Sorteo · Tablero · Historial · Ajustes
    index.tsx          # "/" → DrawScreen
    board.tsx          # "/board"
    history.tsx        # "/history"
    settings.tsx       # "/settings" (stub de PARTIDA, §4.6)
  +not-found.tsx
```

- Tab bar con iconos + label y targets ≥ 44 pt (§7.1); iconos con
  `npx expo install @expo/vector-icons` (Ionicons).
- La fila de acciones secundarias de Sorteo (**Deshacer · Historial · Tablero**, §7.2)
  usa `router.push`, no pestañas propias.

### 4.3 La grilla del tablero es dominio puro

La geometría y el estado de cada celda se calculan en `src/core/board/grid.ts` (entra en
el gate del 100 % y se testea en milisegundos, sin render):

- `gridColumns(range)`: 90 → 10 · 80 → 10 · 75 → 5 (columnas B-I-N-G-O, celdas en orden
  **column-major**: B=1-15, I=16-30, N=31-45, G=46-60, O=61-75) · custom →
  `clamp(ceil(sqrt(total)), 5, 12)` con `rows = ceil(total / columns)` (§7.3).
- `boardRows(game)`: devuelve `Cell[][]` en orden visual con `{ number, label, drawn,
  position, drawnAt }`. `label` sale de `formatLabel` (§3.1): historial, tablero y bola
  imprimen exactamente lo mismo.
- La pantalla solo renderiza: 10 columnas en presets, encabezados *sticky* `B I N G O`
  en 75, leyenda obligatoria **"Verde = extraída · Gris = pendiente"** + icono/tachado
  (nunca solo color, §7.3), contador "23 extraídas · 67 pendientes" y auto-scroll a la
  celda recién extraída con `AccessibilityInfo.isReduceMotionEnabled()` (API de RN, sin
  preferencia de usuario todavía). Tap en celda = no-op.

### 4.4 Deshacer persistido: `repo.save()` en transacción

`undo` cambia pool + historial + status en el mismo paso; `GameRepository.save()` ya
escribe fila + log de draws **dentro de una sola transacción**, así que no hace falta
SQL nuevo: `engine.undo → repo.save(estado) → store.set(estado)`. Se añade un test de
persistencia de undo (round-trip tras recargar) y otro de fallo de escritura (rollback ⇒
estado intacto + banner). Si al implementar resulta que el coste del re-escribir-log
molesta (hoy, 90 filas, es despreciable), se plantea `commitUndo` como mejora aparte.

### 4.5 Componentes propios, no dependencias de UI (ADR-12)

- `src/ui/ConfirmDialog.tsx`: modal propio con `accessibilityViewIsModal`, orden de foco
  y copy exacto de §7.6 (**"¿Reiniciar la partida?"** / "Se perderán las **23**
  extracciones. El historial de esta partida se archivará." / `[Cancelar]` `[Reiniciar]`).
- `src/ui/Toast.tsx` + `useToast()`: mensaje autocontenido de ~2.5 s con
  `accessibilityLiveRegion="polite"` ("Bola 67 devuelta al bombo", §7.4). Cada pantalla
  lo monta donde lo necesita.
- Nada de `Alert.alert` (ADR-12) ni librerías de toast/dialog.

### 4.6 La pestaña Ajustes entra como stub

El flujo E2E 5 exige **Ajustes → Reiniciar → confirmar**, pero la pantalla completa de
Ajustes es Fase 3. Entra un stub con **solo la sección PARTIDA**:

- `Reiniciar partida` → `ConfirmDialog` → `store.startNewGame()` (visible solo con
  partida activa; §7.5).
- La fila `Rango numérico` **no** se muestra todavía (abriría el formulario de Fase 3);
  se añade junto con él para no dejar filas muertas.

### 4.7 Dependencias nuevas (todas sin código nativo nuevo)

| Paquete | Para qué | Comando | Rebuild dev client |
|---|---|---|---|
| `zustand` | store de partida (ADR-07) | `pnpm add zustand` | No (JS puro) |
| `@expo/vector-icons` | iconos del tab bar | `npx expo install @expo/vector-icons` | No* |
| `jest-expo@58` | preset de tests de UI | `npx expo install jest-expo` | No (dev) |
| `@testing-library/react-native` | tests de componente | `npx expo install @testing-library/react-native` | No (dev) |

\* `@expo/vector-icons` usa `expo-font`, que ya es dependencia de `expo` y está linkeado;
**verificar en el primer arranque**. Si el icono no carga, alternativas: (a) `pnpm android`
para recompilar el dev client, o (b) tab bar sin iconos hasta Fase 4. Nada de esto bloquea
el resto de la fase.

---

## 5. Unidades de trabajo

Cada unidad = **un commit/PR revisable** (tests y docs van con su código, no aparte),
verificada con su comando antes de pasar a la siguiente. Presupuesto orientativo:
~400 líneas autorizadas por unidad; si una se pasa, se parte en dos (p. ej. `grid.ts`
separado de `BoardScreen.tsx`).

### U1 · Harness de tests de UI — ~0,5 día · riesgo medio

- **Objetivo:** poder testear componentes sin tocar el gate de `src/core`.
- **Archivos:** `jest.ui.config.js` (preset `jest-expo`, `testMatch` en
  `src/**/__tests__/**/*.test.{ts,tsx}`), script `"test:ui"`, paso en
  `.github/workflows/ci.yml`, primer test de humo de `DrawScreen` con
  `jest.mock('@/shared/db/client')`.
- **Regla:** `jest.config.js` no cambia; el 100 % de `src/core` sigue como está.
- **Pruebas:** render inicial muestra "Sacar bola" y la bola `—`.
- **Verificación:** `pnpm test:ui` (+ `pnpm peers check` tras instalar: `jest-expo`
  declara peers como `@react-native/jest-preset`).
- **Riesgo:** compatibilidad `jest-expo 58` + React 19.3/RN 0.88 → si falla, degradar a
  `react-test-renderer` para componentes puros y dejar anotado el bloqueo.

### U2 · `gameStore` compartido — ~1 día · riesgo alto (es la base)

- **Objetivo:** una sola partida en memoria, con la misma semántica de commit que hoy.
- **Archivos:** `src/features/game/gameStore.ts` (+ `__tests__/gameStore.test.ts`),
  `app/_layout.tsx` (bind + `boot()`), `src/features/draw/useGame.ts` eliminado o
  convertido en selectores; `DrawScreen` pasa a leer del store.
- **Tests (proyecto UI, repositorio real sobre better-sqlite3):** boot crea la partida si
  no hay · boot repara y persiste si el pool vino dañado · `drawBall` = motor → commit →
  estado · fallo de commit ⇒ banner de error y estado sin tocar · doble tap ⇒ no-op ·
  `busy` se libera a los 300 ms · boot idempotente.
- **Verificación:** `pnpm test && pnpm test:ui && pnpm typecheck && pnpm lint`; humo
  manual: dibujar y ver `pool_json` cambiar con un `sqlite3` local.
- **Rollback:** se elimina `gameStore.ts` y se restaura `useGame.ts` (los tests de
  Fase 1 no cambian).

### U3 · Navegación por pestañas — ~0,5 día · riesgo medio

- **Archivos:** mover `app/index.tsx` → `app/(tabs)/index.tsx`; crear
  `app/(tabs)/_layout.tsx` (Tabs con 4 ítems, iconos, labels, altura generosa),
  `board.tsx` / `history.tsx` / `settings.tsx` de reserva, `app/+not-found.tsx`.
- **Pruebas:** smoke de Maestro ampliado (arranca en Sorteo y las 4 pestañas son
  visibles y tocables); tests de UI del tab bar (4 ítems con label).
- **Verificación:** `pnpm typecheck && pnpm lint && pnpm test:ui`, y
  `npx expo export --platform android` para confirmar que los iconos empaquetan.

### U4 · Rejilla en el dominio — ~0,5 día · riesgo bajo

- **Archivos:** `src/core/board/grid.ts` + `src/core/board/__tests__/grid.test.ts`
  (**entra en el gate del 100 %**).
- **Tests:** columnas por preset (10/5/10) y `clamp(ceil(sqrt(total)),5,12)` para
  custom en los bordes (total 1, 10, 200) · filas del preset 75 en orden column-major ·
  todas las celdas del rango exactamente una vez · `drawn`/`position` correctos ·
  `label` coherente con `formatLabel` · rango degenerado no revienta.
- **Verificación:** `pnpm test:coverage` (sigue al 100 %).

### U5 · Pantalla Tablero — ~1 día · riesgo medio

- **Archivos:** `src/features/board/{BoardScreen.tsx,useBoard.ts}` (+ tests).
- **Contenido:** header con "23 extraídas · 67 pendientes", grilla, encabezados sticky
  `B I N G O` (75), leyenda obligatoria, celda extraída = relleno + tachado sutil + check
  (no solo color), pendiente = contorno tenue, tap no hace nada, auto-scroll a la última
  celda respetando `isReduceMotionEnabled()`, estados vacío ("Todavía no salió ninguna
  bola") y completo.
- **Rendimiento:** `React.memo` por celda y `useMemo` del Set de extraídas: con 200
  celdas y un draw por segundo no debe re-renderizar la grilla entera.
- **Pruebas de UI:** labels no vacíos en todas las celdas (requisito TalkBack), estado
  visual accesible sin depender del color, scroll enfoca la última celda.

### U6 · Pantalla Historial — ~1 día · riesgo medio

- **Archivos:** `src/features/history/{HistoryScreen.tsx,useHistory.ts}` (+ tests).
- **Contenido:** `FlatList` **invertida**, `getItemLayout` fijo, fila `#23 · 67 · HH:mm`,
  badge "Última" en el primer ítem, botón **Deshacer** inline, estado vacío ("Todavía no
  salió ninguna bola."), virtualización sin saltos con 90-200 ítems.
- **Pruebas de UI:** orden invertido (la última arriba), formato de hora, estado vacío,
  deshabilitado sin historial.

### U7 · Deshacer end-to-end + toast — ~1 día · riesgo alto (INV-1)

- **Archivos:** `store.undoBall()` (§4.4), `src/ui/Toast.tsx` + `useToast()`, fila
  secundaria de `DrawScreen` (**Deshacer · Historial · Tablero**), botón inline de
  Historial.
- **Pruebas:** undo con historial ⇒ pool +1, historial -1, status `exhausted → running` ·
  undo persiste y **sobrevive a recargar** (round-trip por repositorio) · undo sin
  historial ⇒ no-op con el botón deshabilitado · fallo de escritura ⇒ estado intacto y
  banner · "la próxima bola es la que se deshizo" (§2.6) tras undo + draw.
- **Verificación:** flujo E2E 4.

### U8 · ConfirmDialog + Ajustes stub + estados — ~1 día · riesgo medio

- **Archivos:** `src/ui/ConfirmDialog.tsx`, `app/(tabs)/settings.tsx` (solo PARTIDA),
  estados vacío/completo/error unificados en Sorteo/Tablero/Historial.
- **Pruebas de UI:** diálogo con `accessibilityViewIsModal` y foco; **Reiniciar**
  crea partida nueva (contador a `0 de 90` y tablero limpio); **Cancelar** no cambia
  nada; Ajustes sin partida activa no muestra la fila destructiva.
- **Verificación:** flujo E2E 5.

### U9 · E2E, CI y docs — ~1 día · riesgo medio

- **Entorno (una vez):** emulador Android + `pnpm android` (primera compilación del dev
  client, varios minutos) + CLI de Maestro.
- **Flujos:** `.maestro/` — `01-primer-arranque.yaml`, `03-persistencia.yaml`
  (`am force-stop` entre medias), `04-deshacer.yaml`, `05-reinicio.yaml`
  (+ `02-partida-corta.yaml` si se adopta la opción 1 o 3 de §10).
- **CI:** paso `pnpm test:ui` además del actual; `pnpm test:coverage` intacto.
- **Docs:** README → estado "Fase 2 completada", árbol de carpetas y "Decisiones tomadas
  en Fase 2"; `plan-bingo.md` no se toca.
- **Manual:** checklist TalkBack (§1) ejecutado y anotado.

---

## 6. Estructura final

```
app/
  _layout.tsx                 # boot del store · Stack
  (tabs)/
    _layout.tsx               # Sorteo · Tablero · Historial · Ajustes
    index.tsx · board.tsx · history.tsx · settings.tsx
  +not-found.tsx
src/
  core/
    engine/                   # SIN CAMBIOS (Fase 1)
    db/                       # SIN CAMBIOS de esquema (Fase 1)
    board/grid.ts             # NUEVO: geometría y estado de celdas (puro)
  features/
    game/gameStore.ts         # NUEVO: store Zustand con DI
    draw/                     # DrawScreen (presentación + acciones secundarias)
    board/ · history/ · settings/
  ui/
    ConfirmDialog.tsx · Toast.tsx     # NUEVO: componentes propios (ADR-12)
  shared/db/ · shared/random/ # SIN CAMBIOS
jest.config.js                # SIN CAMBIOS (gate 100 % de src/core)
jest.ui.config.js             # NUEVO (jest-expo)
```

---

## 7. Matriz de pruebas

| Nivel | Dónde | Qué cubre | Gate |
|---|---|---|---|
| Unit (dominio) | `src/core/board/__tests__` | grilla, labels, celdas | 100 % ramas |
| Unit (store) | `src/features/game/__tests__` | boot, draw, undo, errores | verde |
| Componente | `src/features/**/__tests__` | celdas, filas, diálogo, toast, tab bar | verde |
| E2E (Maestro) | `.maestro/*.yaml` | flujos 1, 3, 4, 5 (+2 según §10) | verdes |
| Manual a11y | dispositivo real | TalkBack/VoiceOver en tablero | checklist §1 |

---

## 8. Flujos E2E y una ambigüedad heredada

| Flujo | Descripción | ¿En Fase 2? |
|---|---|---|
| 1 | Primer arranque → "Sacar bola" → `1 de 90` | ✅ U9 |
| 2 | Partida completa corta (rango 1-5) → `Nueva partida` | ⚠️ **requiere el formulario de rango (Fase 3)** |
| 3 | 3 extracciones → `am force-stop` → reabrir → sigue en 3 | ✅ U9 |
| 4 | 3 extracciones → deshacer → `2 de 90` → sacar = bola deshecha | ✅ U9 |
| 5 | 5 extracciones → Ajustes → Reiniciar → `0 de 90` y tablero limpio | ✅ U8+U9 |
| 6 | Cambio de rango bloqueado con partida en curso | ❌ Fase 3 |

§10 declara "flujos E2E 1-5 en verde" para Fase 2, pero el flujo 2 solo puede
ejecutarse con rango 1-5, y ese formulario es Fase 3. Opciones en §10 (decisión A).

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| `jest-expo` choca con React 19.3 / RN 0.88 | Comprobar peers tras instalar (U1); plan B: `react-test-renderer` para componentes puros |
| Estado duplicado entre pestañas (el bug clásico de esta fase) | El store existe **antes** de crear las pestañas (U2 antes que U3) |
| Doble `boot()` en desarrollo | Guard idempotente + test específico en U2 |
| 200 celdas re-renderizando en cada extracción | `React.memo` + `useMemo` del Set (U5) |
| `FlatList` invertida con `getItemLayout` incorrecto → scroll tembloroso | Altura fija por fila y test con 90 e 200 ítems (U6) |
| Iconos del tab bar rompen el bundle o piden rebuild | Verificar con `expo export` en U3; alternativas en §4.7 |
| Maestro frágil con animaciones | Esperar por texto, nunca por tiempo (§8.1) |
| Undo mal persistido ⇒ INV-1 en riesgo | Tests de round-trip y de rollback en U7 (la más crítica) |

---

## 10. Decisiones abiertas (confirmar antes de empezar)

**A · Flujo E2E 2 (rango 1-5).** Opciones:
   1. *(recomendado)* Dejar el flujo 2 para Fase 3 y cerrar Fase 2 con los flujos
      **1, 3, 4, 5**.
   2. Adelantar el formulario de rango mínimo a esta fase (+1 día, solapa con Fase 3).
   3. Añadir un hook de test tipo `__DEV__` que fije el rango por deep link/argumento de
      lanzamiento (medio día; ya hay precedente con
      `__TEST_ONLY_DELAY_AFTER_COMMIT` en §8.6).

**B · Stub de Ajustes.** ¿De acuerdo con mostrar solo `Reiniciar partida` (§4.6), o
prefieres esperar a Fase 3 y mover el flujo 5 también?

**C · Tests de componente.** Incluidos aquí (U1, +0,5-1 día) como manda §8.1. Si se
prefiere la Fase 2 "más rápida", U1 puede aplazarse y los tests de componente subir a
Fase 3; el gate de a11y sería entonces solo manual.

**D · Toast.** Componente propio (§4.5) en lugar de una librería: confirmado por ADR-12
para diálogos, se asume lo mismo para toast.

---

## 11. Orden y estimación

| Orden | Unidad | Días | Depende de |
|---|---|---|---|
| 1 | U1 · harness de tests de UI | 0,5 | — |
| 2 | U2 · `gameStore` compartido | 1 | U1 |
| 3 | U3 · navegación (tabs) | 0,5 | U2 |
| 4 | U4 · rejilla en el dominio | 0,5 | — |
| 5 | U5 · pantalla Tablero | 1 | U3, U4 |
| 6 | U6 · pantalla Historial | 1 | U3 |
| 7 | U7 · deshacer + toast | 1 | U2, U6 |
| 8 | U8 · ConfirmDialog + Ajustes stub | 1 | U3 |
| 9 | U9 · E2E + CI + docs | 1 | todas |
| | **Total** | **~7,5** | |

El plan original estimaba 4 días para Fase 2; la diferencia es el harness de tests de
componente (U1) y el entorno E2E de U9, que el §10 no descontaba. Con la opción C1 de
§10 (aposponer component tests) se vuelve a ~6 días.

---

## 12. Comandos

```bash
# instalación (una vez)
pnpm add zustand
npx expo install @expo/vector-icons jest-expo @testing-library/react-native
pnpm peers check

# por cada unidad
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test            # gate 100 % de src/core — no puede bajar
pnpm test:ui         # tests de componente/store
npx expo-doctor
npx expo export --platform android --output-dir .export-check   # compila el bundle

# E2E (U9, requiere emulador)
pnpm android && pnpm e2e
```

Criterio de commit por unidad (checklist): un propósito claro · el repo tiene sentido
solo con ese commit · tests/docs incluidos · comando de verificación con su resultado
exacto · rollback posible sin tocar lo demás.
