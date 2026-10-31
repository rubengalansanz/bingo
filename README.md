# Bingo — bombo digital

App móvil offline que reemplaza al bombo físico: **una bola por tap, sin repetición**
(ver `plan-bingo.md`, que es la especificación).

Estado: **Fase 1 completada** — motor completo, persistencia SQLite y pantalla de
sorteo mínima con recuperación de estado.

## Stack

- Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript 6 (strict)
- expo-router · expo-dev-client · expo-sqlite · expo-crypto
- react-native-mmkv · @shopify/react-native-skia
- Jest + ts-jest · fast-check · ESLint (expo) + Prettier · Maestro

## Comandos

```bash
pnpm install
pnpm start          # Metro
pnpm android        # dev client Android (expo run:android)
pnpm ios            # dev client iOS (expo run:ios, requiere macOS)
pnpm typecheck
pnpm lint
pnpm test           # dominio puro + persistencia (SQLite real en Node), sin React
pnpm test:coverage  # umbral 100% en src/core
pnpm format
pnpm doctor
pnpm e2e            # Maestro (requiere emulador + build instalado)
```

## Dónde está cada cosa

```
app/                     # rutas expo-router (solo rutas y providers)
src/core/                # dominio puro: 0 imports de react / react-native / expo
  result.ts              # Result<T, E> — el dominio no lanza para fallos esperados
  engine/types.ts        # RangeConfig · Game · DrawRecord · EngineError (§6.1)
  engine/rng.ts          # cryptoRng(port) · mulberry32 · randomInt sin sesgo
  engine/shuffle.ts      # Fisher-Yates (§2.2)
  engine/range.ts        # presets · validateRange · formatLabel (§3)
  engine/game.ts         # createGame · draw · undo · reset · integrityCheck (§6.3)
  db/sqlite.ts           # puerto síncrono Sqlite (exec/run/get/all/transaction)
  db/migrations/         # runner + 001_init con el esquema v1 (§5.5)
  db/repositories/       # GameRepository transaccional (INV-1 también en la BD)
src/features/draw/       # DrawScreen + useGame (commit antes de animar, §2.5)
src/shared/random/       # adaptador expo-crypto (CSPRNG del sistema)
src/shared/db/           # adaptador expo-sqlite + singleton del repositorio
.maestro/                # flujos E2E
.github/workflows/ci.yml # typecheck · lint · format · tests+cobertura · expo-doctor
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

## Pendientes de fases posteriores

- **`android.blockedPermissions: ['INTERNET']`** (§9.3) queda para Fase 4 en el perfil de
  producción: activarlo ahora rompe el dev client (Metro) y EAS Update.
- **Bundle id `com.bingobombo.app`** es provisorio; cambiarlo después de publicar obliga
  a crear otra ficha en las tiendas.
- **Aviso cosmético de pnpm:** `react-dom@19.3.1` (dependencia interna del CLI de Expo)
  pide `react ^19.3.1` y el SDK fija `19.3.0`. Es un peer transitivo; no afecta al bundle.
