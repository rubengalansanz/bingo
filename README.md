# Bingo — bombo digital

App móvil offline que reemplaza al bombo físico: **una bola por tap, sin repetición**
(ver `plan-bingo.md`, que es la especificación).

Estado: **Fase 4 completa salvo el envío a tiendas**. El código vive en
[`rubengalansanz/bingo`](https://github.com/rubengalansanz/bingo), rama `master`:
**163 tests de dominio** con 100 % de cobertura y **102 tests de UI**, con typecheck,
lint y formato en verde.

Un único juego compartido entre pestañas (Sorteo · Tablero · Historial · Ajustes), tablero con
los 3 formatos de grilla, historial invertido, deshacer persistido con toast, reinicio
con confirmación, cuatro temas × claro/oscuro con gate de contraste, preferencias en
MMKV y formulario de rango con validación y reinicio confirmado. Fase 4 añade la bola
animada (Reanimated + Skia), sonido y hápticos con sus ajustes, velocidad de animación,
reducir movimiento, pantalla encendida, anuncio accesible tras cada extracción, la
política de privacidad en la app, el catálogo es/en con su fila de idioma y el layout
tablet de dos columnas. E2E: flujos 1-6 escritos y **pendientes de ejecutar en
emulador** (no hay uno en este entorno), igual que la pasada manual con
TalkBack/VoiceOver.

## Stack

- Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript 6 (strict)
- expo-router · expo-dev-client · expo-sqlite · expo-crypto · expo-constants
- expo-audio · expo-haptics · expo-keep-awake · expo-asset (bola con sonido)
- react-native-reanimated 4 + react-native-worklets (animación en el UI thread)
- zustand (store de partida, sin middleware `persist`)
- react-native-mmkv + react-native-nitro-modules (preferencias) ·
  @shopify/react-native-skia (degradado y brillo de la bola) · @expo/vector-icons
- Jest (ts-jest) + Jest (jest-expo) · @testing-library/react-native · fast-check
- ESLint (expo) + Prettier · Maestro

## Comandos

```bash

git clone https://github.com/rubengalansanz/bingo.git && cd bingo
pnpm install
pnpm start # Metro
pnpm android # dev client Android (expo run:android)
pnpm ios # dev client iOS (expo run:ios, requiere macOS)
pnpm typecheck
pnpm lint
pnpm test # dominio puro + persistencia (SQLite real en Node), sin React
pnpm test:coverage # umbral 100 % en src/core (tokens, contraste, ajustes, i18n)
pnpm test:ui # componentes y store (jest-expo + @testing-library/react-native)
pnpm format
pnpm doctor
pnpm e2e # Maestro (requiere emulador + build instalado)

```

> **Fases 3 y 4 exigen reconstruir el dev client una vez.** MMKV v4
> (`react-native-nitro-modules`), Reanimated + worklets, `expo-audio`,
> `expo-haptics` y `expo-keep-awake` son código nativo: `pnpm android` (o EAS Build
> `development`) después de `pnpm install`. No hay cambio de esquema SQL ni migración.

## Dónde está cada cosa

```

app/
_layout.tsx # arranca el store una vez (boot idempotente) + Stack
(tabs)/
_layout.tsx # Sorteo · Tablero · Historial · Ajustes (§7.1)
index.tsx # "/" → DrawScreen
board.tsx · history.tsx · settings.tsx
+not-found.tsx
src/
core/ # dominio puro: 0 imports de react / react-native / expo
result.ts # Result<T, E> — el dominio no lanza para fallos esperados
engine/types.ts # RangeConfig · Game · DrawRecord · EngineError (§6.1)
engine/rng.ts # cryptoRng(port) · mulberry32 · randomInt sin sesgo
engine/shuffle.ts # Fisher-Yates (§2.2)
engine/range.ts # presets · validateRange · formatLabel (§3)
engine/game.ts # createGame · draw · undo · reset · integrityCheck (§6.3)
board/grid.ts # grilla column-major + estado de celda (§7.3)
feedback/feedback.ts # sonido/háptico y duración de animación (§4.4, §5.3)
theme/tokens.ts # 4 temas × claro/oscuro, tokens tipados (§4.1-4.2)
theme/contrast.ts # WCAG AA por par + gate de las 8 paletas (§4.5, §8.4)
settings/settings.ts # Settings + parse por campo + puerto KeyValueStorage (§4.7)
i18n/messages.ts # catálogo tipado es/en + códigos de banner (§7.5)
db/sqlite.ts # puerto síncrono Sqlite (exec/run/get/all/transaction)
db/migrations/ # runner + 001_init con el esquema v1 (§5.5)
db/repositories/ # GameRepository transaccional (INV-1 también en la BD)
features/
game/gameStore.ts # el único juego en memoria (Zustand con DI, §5.4)
game/useGame.ts # binding: repositorio real + CSPRNG + rango preferido → store
settings/ # settingsStore + useSettings · SettingsScreen · RangeSheet
i18n/LocaleProvider.tsx # catálogo en contexto; el idioma no toca la partida
settings/PrivacySheet.tsx # política de privacidad en la app (§9.3)
theme/ThemeProvider.tsx # tokens en contexto; modo automático vía useColorScheme (§4.2)
feedback/ # useDrawFeedback (puerto inyectable) · useMotionPlan · KeepAwakeWhen
draw/ # DrawScreen + Ball (Skia/Reanimated) + CompactBoard (§7.8) + FocusedDrawScreen (foco de pestaña)
board/ · history/ # BoardScreen · HistoryScreen con sus view models
ui/ # componentes propios (ADR-12): Toast · ConfirmDialog · ChoiceSheet
shared/random/ # adaptador expo-crypto (CSPRNG del sistema)
shared/db/ # adaptador expo-sqlite + singleton del repositorio
shared/kv/ # adaptador MMKV de las preferencias (§5.4)
shared/feedback/ # adaptador expo-audio + expo-haptics (fire-and-forget, §4.4)
assets/sounds/ # ball.wav · complete.wav (generados, incluidos en el bundle)
**tests**/ # navegación por pestañas y Ajustes
.maestro/ # E2E: 01 arranque · 02 partida corta · 03 persistencia
         # 04 deshacer · 05 reinicio · 06 rango bloqueado
.github/workflows/ci.yml # typecheck · lint · format · tests+cobertura · test:ui · expo-doctor

```

Regla que no se rompe: `src/core` no importa nada de React, RN ni Expo. Los servicios
nativos entran por puertos inyectados (ej. `Uint32Source`).

## Decisiones tomadas en Fase 0

1. **SDK 58, no 54.** El plan fijaba SDK 54; está cuatro majors por detrás del `latest`
   y obligaría a un upgrade en plena Fase 4. Aprobado por el usuario.
2. **`rng.ts` es puro.** El plan importaba `expo-crypto` dentro de `core/engine`, lo que
   rompe §5.2 y obliga a un emulador para testear. El CSPRNG se inyecta como puerto
   (`Uint32Source`); el adaptador vive en `src/shared/random/`.
3. **`randomInt` acota los reintentos.** El rechazo de cola es obligatorio para quitar
   el sesgo de módulo, pero con un RNG roto un `while` clásico cuelga la pantalla de
   sorteo. Tras 64 rechazos lanza `RangeError` en vez de esperar para siempre.
4. **Umbral de cobertura 100%** (ramas incluidas) sobre `src/core`, incluida la capa
   de persistencia.
5. **`pnpm` con `node-linker=hoisted`.** Metro + módulos nativos; evita los symlinks de
   pnpm como fuente de bugs raros de resolución.

## Decisiones tomadas en Fase 1

6. **El orden del pool es único: `pop()` al final.** El plan se contradecía (§2.2/§2.6
   consumen por el final para que `undo` con `push` devuelva exactamente la misma bola;
   §6.1/§5.5 decían `pool[0]`). Se eligió `pop()` y se alineó dominio, `pool_json` y
   tests: el **último** elemento del array es la próxima bola. Documentado en
   `engine/types.ts`.
7. **Las migraciones son cadenas TS, no `.sql`.** Metro no importa SQL en runtime y el
   mismo texto debe correr en la app y en el test de Node (§8.1). El fichero
   `001_init.ts` es la única fuente.
8. **El puerto `Sqlite` es síncrono.** `commitDraw` es una transacción que debe cerrar
   antes de que la UI se entere (§2.5); con API sincrónica no hay interleaving posible
   y el mismo reposorio corre contra `better-sqlite3` en tests. El adaptador
   `expo-sqlite` vive en `src/shared/db/`, igual que el CSPRNG: `core` no toca nativos.
9. **El id del juego es UUID v4 derivado del CSPRNG inyectado**, no
   `expo-crypto.randomUUID()`: `createGame` sigue siendo puro y testeable en Node
   (§5.2), y en modo reproducible el id es determinista como el resto del estado.
10. **`integrityCheck(g, rng)` añade `rng`.** Reparar exige re-barajar el pool
    reconstruido desde el historial (§2.5); como `core` no tiene aleatoriedad propia,
    el rng entra por parámetro y solo se consume cuando hay daño real.

## Decisiones tomadas en Fase 2

11. **Zustand sin middleware `persist` (ADR-07, §5.4).** El store es caché de lectura: la
    verdad sigue siendo motor + SQLite, y toda escritura pasa por `GameRepository`.
    Guardar un blob reescrito perdería la transacción que protege `INV-1`.
12. **El store se construye con dependencias inyectadas** (`openRepository`, `now`,
    `rng`): `gameStore.ts` no importa código nativo, se prueba contra SQLite real en
    Node y los tests no necesitan `jest.mock` global ni tocar `src/core`.
13. **La grilla del tablero es dominio puro** (`src/core/board/grid.ts`): columnas,
    etiquetas y estado de cada celda se calculan sin render, y entran en el gate del
    100 % de ramas. Las pantallas solo pintan.
14. **Diálogo y toast propios, sin librerías (ADR-12).** `ConfirmDialog` expone
    `accessibilityViewIsModal`, fija el orden de foco (título → mensaje → botones) y
    ata el botón atrás de Android a _Cancelar_; `Toast` anuncia con `polite`.
15. **Ajustes entra como stub con solo la sección PARTIDA** (§4.6): la fila destructiva
    solo aparece con partida activa, para no dejar filas muertas. Rango, temas y MMKV
    son de Fase 3.
16. **El flujo E2E 2 quedó para Fase 3** (opción A de `plan-fase2.md` §10): necesita el
    rango 1-5, y ese formulario se construye con el resto de la Fase 3. La Fase 2 cerró
    con los flujos 1, 3, 4 y 5; los flujos 2 y 6 se añadieron después, con el formulario.
17. **Dos proyectos de Jest.** `jest.config.js` sigue intacto (ts-jest, `src/core`, 100 %
    de ramas) y `jest.ui.config.js` corre componentes con `jest-expo`; ninguno puede
    bajar el umbral del otro. En CI son dos pasos.
18. **`smoke.yaml` se reemplaza por los flujos numerados** `01/03/04/05`. Se selecciona
    con `id:` (el `testID` de React Native) allí donde un texto es ambiguo, y los flujos
    03 y 04 comparan la bola capturada con `copyTextFrom` en vez de adivinar el número.

19. **`expo-font` es dependencia directa** (`~58.0.11`): `@expo/vector-icons` lo declara
    como peer y `expo-doctor` lo marcaba como faltante (§4.7). Es JS + fuentes ya
    linkeadas en el dev client, así que no obliga a recompilarlo; con él el doctor pasa
    a 20/20. `npx expo install --fix` subió además los parches de SDK (expo, router,
    sqlite, dev-client) sin cambios nativos de por medio.

## Decisiones tomadas en Fase 3

20. **Los temas son datos puros en `src/core/theme`.** Cuatro temas × dos esquemas, sin
    un solo `if (theme === …)` en componentes: `ThemeProvider` expone tokens y las
    pantallas leen colores. Entra en el gate del 100 % como la grilla.
21. **El contraste es un gate de release, no una revisión manual (§4.5, §8.4).**
    `contrast.ts` define los 18 pares que la UI pinta de verdad (texto 4.5:1, gráficos
    3:1) y `findContrastFailures()` recorre las 8 paletas; el test falla nombrando tema,
    esquema, par y ratio. La primera pasada encontró cuatro aros de bola en oscuro por
    debajo de 3:1 y se corrigieron antes de escribir pantallas.
22. **Parser de ajustes propio, sin Zod.** El spec pedía Zod (§4.7), pero son seis
    campos con default individual; una dependencia de esquema en runtime no se justifica.
    El contrato se mantiene: JSON corrupto ⇒ defaults, campo inválido ⇒ solo ese campo.
    Corre como dominio puro y con 100 % de ramas.
23. **`labelMode` es preferencia de presentación, no estado de partida.** Tablero e
    historial la aplican **en vivo** (§3.4) sobre una copia del rango; el rango de la
    partida sigue inmutable. Así cambiar etiquetas no reinicia nada (DoD §11.2.3) y las
    tres superficies no pueden discrepar.
24. **El rango es preferencia + materialización, con reinicio confirmado (§3.3).**
    Ajustes guarda el borrador siempre; si hay partida y el rango difiere, cierra el
    formulario, pide confirmación con «De 90 a 5 bolas. Se perderán las 5 extracciones.» y solo
    entonces crea la partida con `startNewGame(range)`. Si el rango es el mismo, no hay
    diálogo ni reinicio. El primer `boot()` crea la partida con el rango guardado.
25. **MMKV v4 + `react-native-nitro-modules`.** El puerto `KeyValueStorage` vive en el
    dominio y el adaptador en `src/shared/kv`; los tests usan un `Map` (y el setup de
    jest-ui sustituye el adaptador). Es módulo nativo: **el dev client se reconstruye
    una vez** (no hay cambio de esquema SQL).
26. **Diálogos con concordancia real.** «Se perderán las 5 extracciones» / «Se perderá 1
    extracción» / «No se perderá ninguna extracción» salen de `extractionsLost()`, no de
    una plantilla fija: el flujo 6 opera con una sola bola.
27. **`ChoiceSheet` propio para las filas con valor (§7.5, ADR-12).** Aplica en vivo, se
    cierra con _Listo_, anuncia el valor como `radio` y muestra una bola de muestra con
    los tokens del tema elegido. Sin librería de bottom sheets.
28. **FEEDBACK e IDIOMA siguen fuera de Fase 3.** Sonido, hápticos, velocidad, reducir
    movimiento e idioma son Fase 4; sus filas no se muestran todavía para no dejar
    controles muertos (misma regla que el stub de Fase 2). ACERCA DE muestra versión y la
    nota de privacidad offline; la página de política es de Fase 4.

## Decisiones tomadas en Fase 4

29. **La política de sonido/hápticos es dominio puro.** `core/feedback/feedback.ts`
    decide qué se reproduce (impacto, éxito al agotar el bombo), si el movimiento se
    reduce y cuánto dura la animación; los adaptadores nativos solo ejecutan. Así el
    100 % de ramas cubre las combinaciones sin emulador y el mismo plan alimenta los
    tests de componente.
30. **Audio y hápticos son fire-and-forget de verdad.** `shared/feedback/native.ts`
    envuelve cada llamada en `try/catch`, crea los reproductores de forma perezosa y
    nunca espera: si el clip no carga o el dispositivo no tiene motor háptico, el
    sorteo ocurre igual (§4.4). El modo de audio pide `playsInSilentMode` porque el
    interruptor del usuario es el ajuste de Sonido, no el botón físico.
31. **La animación sigue al estado ya commiteado.** La bola se anima al cambiar el
    número de extracciones, nunca antes de que SQLite confirme; solo se animan
    `transform` y `opacity` (§5.3). Con `reduceMotion` no hay escala ni traslación: un
    cross-fade de 120 ms y el anuncio de accesibilidad con la bola y lo que queda.
32. **Reanimated 4 en Jest resuelve por su propio resolver.** Los worklets nativos no
    existen en Node, así que `jest.ui.config.js` usa `react-native-reanimated/jest/resolver`
    y el setup reemplaza Skia por vistas. La animación se verifica por su política
    (duración/velocidad/reduceMotion), no por frames.
33. **El gancho de foco vive en la ruta, no en la pantalla.** Las pestañas siguen
    montadas al cambiar de tab, así que `keepAwake` necesita foco real:
    `FocusedDrawScreen` usa `useFocusEffect` y pasa `focused` a `DrawScreen`, que así
    sigue siendo renderizable en un test sin navegador.
34. **Privacidad comprobable.** El texto vive en la app (ACERCA DE → Privacidad) y
    `blockedPermissions: ['android.permission.INTERNET']` se aplica **solo** cuando
    `EAS_BUILD_PROFILE=production`: activarlo en desarrollo rompería Metro. `expo-audio`
    se configura sin micrófono, sin grabación y sin reproducción en segundo plano.
35. **Sin fila de Idioma hasta que exista i18n.** El catálogo es/en era el trozo que
    faltaba de la fase; mostrar un selector que no cambia ningún texto habría sido una
    fila muerta, la misma regla que dejó FEEDBACK fuera de la Fase 3.
36. **El catálogo es/en es dominio puro.** `core/i18n/messages.ts` define el tipo
    `Messages`, las dos traducciones y `messagesFor(language)`. El tipo obliga a que
    ninguna clave falte en inglés; el test recorre las dos para detectar cadenas vacías
    y llama a cada formateador (lo que también mantiene honesto el 100 % de funciones de
    `src/core`). `LocaleProvider` lee la preferencia y expone el catálogo en contexto.
37. **Los banners son códigos, no frases.** El store guarda `{ tone, code }`, así el
    mismo fallo se lee en el idioma activo; formatear la frase en el store habría
    congelado el idioma del momento del error. `BANNER_CODES` vive en `core/i18n` para
    que el store dependa del catálogo y nunca al revés.
38. **Tablet es una columna más, no una pantalla nueva (§7.8).** A partir de 600 pt
    Sorteo reparte bola y acciones a la izquierda y un `CompactBoard` a la derecha,
    proyectado con el mismo `boardRows` del Tablero: ninguna lógica se duplica. El test
    cambia el tamaño de ventana con `Dimensions.set` en vez de mockear el hook.

## Accesibilidad (gate de Fases 2-4)

Lo que el código garantiza y los tests de componente comprueban — sin depender del color:

- [x] **Contraste AA en las 8 paletas**: texto 4.5:1 y gráficos 3:1 sobre los 18 pares
      reales de la UI, verificado por `pnpm test` (§4.5, §8.4). Un tema que no pasa no
      entra al bundle.
- [x] **Ajustes y rango**: cada fila anuncia etiqueta y valor (`«Tema: Clásico»`), las
      opciones son `radio` con `accessibilityState.checked`, el error del formulario es
      `alert` y el botón _Aplicar_ queda deshabilitado (no oculto) si el rango no valida.
      Con un preset fijo los campos muestran los límites de ese preset (no los números
      sobrantes de una edición personalizada anterior), porque son los que se aplican.

- [x] **Tablero, cada celda** anuncia número y estado: `«67, extraída en la posición 4»` /
      `«90, pendiente»` (75: `«B, 12, extraída…»`).
- [x] **Estado no solo por color**: relleno + tachado + check en la extraída, contorno en
      la pendiente, y la leyenda «Verde = extraída · Gris = pendiente» siempre visible.
- [x] **Contadores anunciados al cambiar**: `progressbar` con `accessibilityValue` en
      Sorteo y contador con `accessibilityLiveRegion="polite"` en el Tablero.
- [x] **Historial**: cada fila es un solo elemento y se anuncia con posición, bola y hora;
      «Deshacer» indica la bola a la que se refiere y su estado deshabilitado.
- [x] **Diálogo**: `accessibilityViewIsModal`, foco título → mensaje → botones y botón
      atrás de Android atado a _Cancelar_.
- [x] **Toast**: `polite`, se reemplaza (nunca se encola) y no secuestra el foco.
- [x] **Pestañas** con label además de icono y targets de 44 pt; el auto-scroll del
      tablero respeta `AccessibilityInfo.isReduceMotionEnabled()`.
- [x] **Anuncio tras cada extracción** (§4.5): `announceForAccessibility` dice la bola y
      cuántas quedan, así que la información no depende de la animación.
- [x] **Reducir movimiento** (§4.4): `auto` escucha el sistema y, cuando está activo, la
      bola aparece con un cross-fade de 120 ms y sin escala. La velocidad (0,5× / 1× /
      1,5×) solo cambia la duración: nunca el estado de la partida.
- [x] **Controles sensoriales** con estado anunciado («Sonido: activado») y una línea de
      explicación cuando se apagan, para que el interruptor no quede mudo.
- [x] **Idioma** (§7.5): la fila anuncia su valor («Idioma: Español») y el cambio se
      aplica en vivo a toda la UI, incluida la propia pantalla de Ajustes y el tablero
      compacto del tablet.

Pendiente de dispositivo real (no verificable en CI ni en Jest): pasada manual con
**TalkBack** (Android) y **VoiceOver** (iOS) sobre Sorteo, Tablero, Historial y Ajustes —
orden de foco, verbosidad, que el anuncio del contador no se solape con el de la bola y
que el sheet de tema/rango no deje escapar el foco.

## Pendientes de publicación

Las dos piezas de código de la Fase 4 (i18n es/en y layout tablet ≥ 600 pt) ya están;
lo que queda requiere dispositivos, cuentas o una decisión del usuario:

- **Envío a tiendas** (§9.1-9.4): ficha, capturas, versiones semver, EAS Build/Submit,
  TestFlight y Play cerrado. Bloqueado por cuentas y credenciales de las tiendas, que
  este entorno no tiene; la configuración (`eas.json`, perfiles, privacidad) sí queda
  lista, incluido el bloqueo de INTERNET en el perfil de producción.
- **URL pública de privacidad** (§9.3): las tiendas piden una página enlazable. El texto
  ya está en la app; falta publicarlo (GitHub Pages) y poner la URL en la ficha.
- **E2E en emulador:** los seis flujos están escritos. No se ejecutaron aquí porque el
  entorno no tiene emulador ni build instalado.
- **Bundle id `com.bingobombo.app`** es provisorio; cambiarlo después de publicar obliga
  a crear otra ficha en las tiendas.
- **CI en la rama correcta:** `.github/workflows/ci.yml` escucha pushes a `main`, pero
  el repositorio publica en `master`. Hay que alinear el disparador (`branches:
[master]`) para que el CI actúe como gate en cada push.
- **Aviso cosmético de pnpm:** `react-dom@19.3.1` (dependencia interna del CLI de Expo)
  pide `react ^19.3.1` y el SDK fija `19.3.0`. Es un peer transitivo; no afecta al bundle.
