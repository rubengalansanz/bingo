import type { RangeError } from '../engine/range';
import type { AnimationSpeed, NumberSize, ReduceMotionPreference } from '../settings/settings';
import type { Appearance, ThemeId } from '../theme/tokens';
import type { LabelMode, RangePreset } from '../engine/types';

/**
 * UI catalog, Spanish and English (plan §4.7, §7.5, DoD §11.2.3).
 *
 * Pure data plus pure formatting functions: no React, no Expo, no storage.
 * Every user-visible string of the app lives here, so a screen only decides
 * *where* to paint it and a missing translation fails the type check instead of
 * shipping a half-translated screen.
 *
 * Two rules that the tests enforce:
 * - both catalogs have exactly the same keys (the type already guarantees it,
 *   the test catches an accidentally empty string);
 * - the Spanish values are the exact copy of the specification, because the
 *   component tests and the Maestro flows assert on them.
 *
 * Changing the language never touches the game: `language` is a presentation
 * preference like the theme (§3.4, DoD §11.2.3).
 */

/** Languages of the catalog, in the order the sheet lists them. */
export const LANGUAGES = ['es', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

/** Spanish is the MVP language; a corrupt preference falls back here (§4.7). */
export const DEFAULT_LANGUAGE: Language = 'es';

/**
 * Reasons a banner can appear (plan §7.7). The store holds the code, never the
 * sentence: the same failure must exist in every language.
 */
export const BANNER_CODES = [
  'bootFailed',
  'repair',
  'drawFailed',
  'undoFailed',
  'newGameFailed',
] as const;

export type BannerCode = (typeof BANNER_CODES)[number];

export type Messages = {
  readonly tabs: {
    readonly draw: string;
    readonly board: string;
    readonly history: string;
    readonly settings: string;
  };
  readonly common: {
    readonly cancel: string;
    readonly done: string;
    readonly close: string;
  };
  /** One sentence per `BannerCode`. */
  readonly banners: Record<BannerCode, string>;
  readonly draw: {
    readonly title: string;
    readonly statusLive: string;
    readonly statusDone: string;
    readonly startHint: string;
    readonly previous: (label: string) => string;
    readonly emptyBall: string;
    readonly lastBall: (label: string) => string;
    readonly counter: (drawn: number, total: number) => string;
    readonly counterLabel: (drawn: number, total: number) => string;
    readonly complete: (drawn: number, total: number) => string;
    readonly ctaDraw: string;
    readonly ctaNew: string;
    readonly undo: string;
    readonly undoLabel: string;
    readonly boardLabel: string;
    readonly historyLabel: string;
    readonly undoToast: (label: string) => string;
    readonly announce: (label: string, remaining: number) => string;
  };
  readonly board: {
    readonly title: string;
    readonly compactCounter: (drawn: number, total: number) => string;
    readonly counter: (drawn: number, pending: number) => string;
    readonly counterLabel: (drawn: number, pending: number) => string;
    readonly legend: string;
    readonly empty: string;
    readonly complete: string;
    readonly cellDrawn: (position: number) => string;
    readonly cellPending: string;
    readonly cellLabel: (spoken: string, state: string) => string;
  };
  readonly history: {
    readonly title: string;
    readonly counter: (drawn: number) => string;
    readonly badge: string;
    readonly undo: string;
    readonly undoLabel: (label: string) => string;
    readonly rowLabel: (position: number, label: string, time: string) => string;
    readonly empty: string;
    readonly complete: string;
  };
  readonly settings: {
    readonly title: string;
    readonly sections: {
      readonly game: string;
      readonly appearance: string;
      readonly feedback: string;
      readonly language: string;
      readonly about: string;
    };
    readonly rows: {
      readonly range: string;
      readonly restart: string;
      readonly theme: string;
      readonly appearance: string;
      readonly size: string;
      readonly labels: string;
      readonly sound: string;
      readonly haptics: string;
      readonly speed: string;
      readonly motion: string;
      readonly keepAwake: string;
      readonly language: string;
      readonly privacy: string;
    };
    readonly loading: string;
    readonly noGame: string;
    readonly saveFailed: string;
    readonly version: (version: string) => string;
    readonly offlineNote: string;
    readonly rowLabel: (label: string, value: string) => string;
    readonly switchLabel: (label: string, enabled: boolean) => string;
    readonly soundOffHint: string;
    readonly hapticsOffHint: string;
    readonly themeSample: string;
    readonly themes: Record<ThemeId, { readonly label: string; readonly detail: string }>;
    readonly appearances: Record<Appearance, { readonly label: string; readonly detail: string }>;
    readonly sizes: Record<NumberSize, { readonly label: string; readonly detail: string }>;
    readonly labels: Record<LabelMode, { readonly label: string; readonly detail: string }>;
    readonly speeds: Record<AnimationSpeed, { readonly label: string; readonly detail: string }>;
    readonly motions: Record<
      ReduceMotionPreference,
      { readonly label: string; readonly detail: string }
    >;
    readonly languages: Record<Language, string>;
    /** Adds the `«, activado»` state a screen reader announces (§4.5). */
    readonly extractionsLost: (count: number) => string;
    readonly restartTitle: string;
    readonly restartMessage: (count: number) => string;
    readonly restartConfirm: string;
    readonly rangeTitle: string;
    readonly rangeMessage: (from: number, to: number, count: number) => string;
    readonly rangeConfirm: string;
  };
  readonly range: {
    readonly title: string;
    readonly min: string;
    readonly max: string;
    readonly minLabel: string;
    readonly maxLabel: string;
    readonly total: (total: number) => string;
    readonly apply: string;
    readonly applyLabel: string;
    readonly errors: Record<RangeError, string>;
    readonly empty: string;
    readonly shortWarning: string;
    readonly presets: Record<RangePreset, string>;
    readonly presetDetail: (min: number, max: number, total: number) => string;
    readonly customDetail: string;
  };
  readonly privacy: {
    readonly title: string;
    readonly close: string;
    readonly footer: string;
    readonly points: readonly string[];
  };
  readonly notFound: {
    readonly title: string;
    readonly back: string;
  };
};

const es: Messages = {
  tabs: { draw: 'Sorteo', board: 'Tablero', history: 'Historial', settings: 'Ajustes' },
  common: { cancel: 'Cancelar', done: 'Listo', close: 'Cerrar' },
  banners: {
    bootFailed: 'No se pudo cargar la partida guardada.',
    repair: 'Se reparó el estado de la partida.',
    drawFailed: 'No se pudo guardar la extracción.',
    undoFailed: 'No se pudo deshacer la extracción.',
    newGameFailed: 'No se pudo crear la partida.',
  },
  draw: {
    title: 'Partida',
    statusLive: 'En juego',
    statusDone: 'Completa',
    startHint: 'Tocá «Sacar bola» para empezar.',
    previous: (label) => `Anterior: ${label}`,
    emptyBall: 'Bombo sin bolas extraídas',
    lastBall: (label) => `Última bola: ${label}`,
    counter: (drawn, total) => `${drawn} de ${total}`,
    counterLabel: (drawn, total) => `${drawn} de ${total} bolas extraídas`,
    complete: (drawn, total) => `Partida completa · ${drawn} de ${total}`,
    ctaDraw: 'Sacar bola',
    ctaNew: 'Nueva partida',
    undo: 'Deshacer',
    undoLabel: 'Deshacer la última extracción',
    boardLabel: 'Ver el tablero',
    historyLabel: 'Ver el historial',
    undoToast: (label) => `Bola ${label} devuelta al bombo`,
    announce: (label, remaining) => `Bola ${label}. Quedan ${remaining}.`,
  },
  board: {
    title: 'Tablero',
    compactCounter: (drawn, total) => `${drawn}/${total}`,
    counter: (drawn, pending) => `${drawn} extraídas · ${pending} pendientes`,
    counterLabel: (drawn, pending) => `${drawn} extraídas, ${pending} pendientes`,
    legend: 'Verde = extraída · Gris = pendiente',
    empty: 'Todavía no salió ninguna bola',
    complete: 'Partida completa',
    cellDrawn: (position) => `extraída en la posición ${position}`,
    cellPending: 'pendiente',
    cellLabel: (spoken, state) => `${spoken}, ${state}`,
  },
  history: {
    title: 'Historial',
    counter: (drawn) => (drawn === 1 ? '1 extracción' : `${drawn} extracciones`),
    badge: 'Última',
    undo: 'Deshacer',
    undoLabel: (label) => `Deshacer la bola ${label}`,
    rowLabel: (position, label, time) =>
      `Posición ${position}, bola ${label}, extraída a las ${time}`,
    empty: 'Todavía no salió ninguna bola.',
    complete: 'Partida completa',
  },
  settings: {
    title: 'Ajustes',
    sections: {
      game: 'PARTIDA',
      appearance: 'APARIENCIA',
      feedback: 'FEEDBACK',
      language: 'IDIOMA',
      about: 'ACERCA DE',
    },
    rows: {
      range: 'Rango numérico',
      restart: 'Reiniciar partida',
      theme: 'Tema',
      appearance: 'Modo de color',
      size: 'Tamaño del número',
      labels: 'Etiquetas',
      sound: 'Sonido',
      haptics: 'Vibración',
      speed: 'Velocidad de animación',
      motion: 'Reducir movimiento',
      keepAwake: 'Mantener pantalla encendida',
      language: 'Idioma',
      privacy: 'Privacidad',
    },
    loading: 'Cargando…',
    noGame: 'Todavía no hay una partida activa.',
    saveFailed: 'No se pudieron guardar los ajustes.',
    version: (version) => `Versión ${version}`,
    offlineNote: 'Funciona sin conexión. No recoge datos.',
    rowLabel: (label, value) => (value === '' ? label : `${label}: ${value}`),
    switchLabel: (label, enabled) => `${label}: ${enabled ? 'activado' : 'desactivado'}`,
    soundOffHint: 'El sorteo no hará ruido.',
    hapticsOffHint: 'El sorteo no vibrará.',
    themeSample: 'Vista previa de la bola con el tema elegido',
    themes: {
      classic: { label: 'Clásico', detail: 'Madera cálida y fieltro verde' },
      minimal: { label: 'Minimalista', detail: 'Fondo plano y tipografía enorme' },
      neon: { label: 'Neón', detail: 'Alto contraste para salas oscuras' },
      festive: { label: 'Festivo', detail: 'Paleta saturada para fiestas' },
    },
    appearances: {
      auto: { label: 'Automático', detail: 'Sigue el modo del sistema' },
      light: { label: 'Claro', detail: 'Siempre claro' },
      dark: { label: 'Oscuro', detail: 'Siempre oscuro' },
    },
    sizes: {
      normal: { label: 'Normal', detail: 'Tamaño base' },
      large: { label: 'Grande', detail: '25 % más grande' },
      xlarge: { label: 'Extra', detail: '50 % más grande' },
    },
    labels: {
      'letter-number': { label: 'Letra y número', detail: 'B-12 en el bingo de 75 bolas' },
      number: { label: 'Solo número', detail: '12 en todas las partidas' },
    },
    speeds: {
      0.5: { label: '0,5×', detail: 'Más lenta' },
      1: { label: '1×', detail: 'Normal' },
      1.5: { label: '1,5×', detail: 'Más rápida' },
    },
    motions: {
      auto: { label: 'Automático', detail: 'Sigue el ajuste del sistema' },
      on: { label: 'Reducir', detail: 'La bola aparece sin movimiento' },
      off: { label: 'Completo', detail: 'La bola siempre anima' },
    },
    languages: { es: 'Español', en: 'English' },
    extractionsLost: (count) => {
      if (count === 0) {
        return 'No se perderá ninguna extracción.';
      }
      if (count === 1) {
        return 'Se perderá 1 extracción.';
      }
      return `Se perderán las ${count} extracciones.`;
    },
    restartTitle: '¿Reiniciar la partida?',
    restartMessage: (count) =>
      `${es.settings.extractionsLost(count)} El historial de esta partida se archivará.`,
    restartConfirm: 'Reiniciar',
    rangeTitle: 'Cambiar el rango reinicia la partida',
    rangeMessage: (from, to, count) =>
      `De ${from} a ${to} bolas. ${es.settings.extractionsLost(count)}`,
    rangeConfirm: 'Reiniciar y aplicar',
  },
  range: {
    title: 'Rango numérico',
    min: 'Mínimo',
    max: 'Máximo',
    minLabel: 'Mínimo del rango',
    maxLabel: 'Máximo del rango',
    total: (total) => `Serán ${total} bolas`,
    apply: 'Aplicar',
    applyLabel: 'Aplicar rango',
    errors: {
      NOT_INTEGER: 'Usá números enteros.',
      MIN_AT_LEAST_ONE: 'El rango empieza en 1 como mínimo.',
      MIN_NOT_LESS_THAN_MAX: 'El mínimo debe ser menor que el máximo.',
      MAX_EXCEEDED: 'Por ahora el máximo es 200 bolas.',
    },
    empty: 'Completá el mínimo y el máximo.',
    shortWarning: 'Un rango tan corto termina la partida en 10 extracciones.',
    presets: {
      eu90: 'Europeo',
      us75: 'Americano',
      n80: '80 bolas',
      custom: 'Personalizado',
    },
    presetDetail: (min, max, total) => `${min}–${max} · ${total} bolas`,
    customDetail: 'Elegí el mínimo y el máximo',
  },
  privacy: {
    title: 'Privacidad',
    close: 'Cerrar',
    footer: 'Sin conexión por diseño.',
    points: [
      'La app no envía datos a ningún servidor. No hay cuentas ni inicio de sesión.',
      'No incluye analíticas, publicidad ni rastreadores de terceros.',
      'La partida y los ajustes se guardan solo en este dispositivo.',
      'En producción el binario de Android no pide permiso de internet.',
      'No se accede a contactos, ubicación, cámara, micrófono ni fotos.',
    ],
  },
  notFound: { title: 'Pantalla no encontrada', back: 'Volver al sorteo' },
};

const en: Messages = {
  tabs: { draw: 'Draw', board: 'Board', history: 'History', settings: 'Settings' },
  common: { cancel: 'Cancel', done: 'Done', close: 'Close' },
  banners: {
    bootFailed: 'The saved game could not be loaded.',
    repair: 'The game state was repaired.',
    drawFailed: 'The draw could not be saved.',
    undoFailed: 'The draw could not be undone.',
    newGameFailed: 'The game could not be created.',
  },
  draw: {
    title: 'Game',
    statusLive: 'In play',
    statusDone: 'Complete',
    startHint: 'Tap “Draw ball” to start.',
    previous: (label) => `Previous: ${label}`,
    emptyBall: 'No balls drawn yet',
    lastBall: (label) => `Last ball: ${label}`,
    counter: (drawn, total) => `${drawn} of ${total}`,
    counterLabel: (drawn, total) => `${drawn} of ${total} balls drawn`,
    complete: (drawn, total) => `Game complete · ${drawn} of ${total}`,
    ctaDraw: 'Draw ball',
    ctaNew: 'New game',
    undo: 'Undo',
    undoLabel: 'Undo the last draw',
    boardLabel: 'View the board',
    historyLabel: 'View the history',
    undoToast: (label) => `Ball ${label} back in the drum`,
    announce: (label, remaining) => `Ball ${label}. ${remaining} left.`,
  },
  board: {
    title: 'Board',
    compactCounter: (drawn, total) => `${drawn}/${total}`,
    counter: (drawn, pending) => `${drawn} drawn · ${pending} pending`,
    counterLabel: (drawn, pending) => `${drawn} drawn, ${pending} pending`,
    legend: 'Green = drawn · Grey = pending',
    empty: 'No balls drawn yet',
    complete: 'Game complete',
    cellDrawn: (position) => `drawn in position ${position}`,
    cellPending: 'pending',
    cellLabel: (spoken, state) => `${spoken}, ${state}`,
  },
  history: {
    title: 'History',
    counter: (drawn) => (drawn === 1 ? '1 draw' : `${drawn} draws`),
    badge: 'Latest',
    undo: 'Undo',
    undoLabel: (label) => `Undo ball ${label}`,
    rowLabel: (position, label, time) => `Position ${position}, ball ${label}, drawn at ${time}`,
    empty: 'No balls drawn yet.',
    complete: 'Game complete',
  },
  settings: {
    title: 'Settings',
    sections: {
      game: 'GAME',
      appearance: 'APPEARANCE',
      feedback: 'FEEDBACK',
      language: 'LANGUAGE',
      about: 'ABOUT',
    },
    rows: {
      range: 'Number range',
      restart: 'Restart game',
      theme: 'Theme',
      appearance: 'Colour mode',
      size: 'Number size',
      labels: 'Labels',
      sound: 'Sound',
      haptics: 'Haptics',
      speed: 'Animation speed',
      motion: 'Reduce motion',
      keepAwake: 'Keep the screen on',
      language: 'Language',
      privacy: 'Privacy',
    },
    loading: 'Loading…',
    noGame: 'There is no active game yet.',
    saveFailed: 'Preferences could not be saved.',
    version: (version) => `Version ${version}`,
    offlineNote: 'Works offline. Collects no data.',
    rowLabel: (label, value) => (value === '' ? label : `${label}: ${value}`),
    switchLabel: (label, enabled) => `${label}: ${enabled ? 'on' : 'off'}`,
    soundOffHint: 'The draw will be silent.',
    hapticsOffHint: 'The draw will not vibrate.',
    themeSample: 'Ball preview with the selected theme',
    themes: {
      classic: { label: 'Classic', detail: 'Warm wood and green felt' },
      minimal: { label: 'Minimal', detail: 'Flat background and huge type' },
      neon: { label: 'Neon', detail: 'High contrast for dark rooms' },
      festive: { label: 'Festive', detail: 'Saturated palette for parties' },
    },
    appearances: {
      auto: { label: 'Automatic', detail: 'Follows the system mode' },
      light: { label: 'Light', detail: 'Always light' },
      dark: { label: 'Dark', detail: 'Always dark' },
    },
    sizes: {
      normal: { label: 'Normal', detail: 'Base size' },
      large: { label: 'Large', detail: '25 % bigger' },
      xlarge: { label: 'Extra', detail: '50 % bigger' },
    },
    labels: {
      'letter-number': { label: 'Letter and number', detail: 'B-12 on the 75-ball game' },
      number: { label: 'Number only', detail: '12 in every game' },
    },
    speeds: {
      0.5: { label: '0.5×', detail: 'Slower' },
      1: { label: '1×', detail: 'Normal' },
      1.5: { label: '1.5×', detail: 'Faster' },
    },
    motions: {
      auto: { label: 'Automatic', detail: 'Follows the system setting' },
      on: { label: 'Reduce', detail: 'The ball appears without movement' },
      off: { label: 'Full', detail: 'The ball always animates' },
    },
    languages: { es: 'Español', en: 'English' },
    extractionsLost: (count) => {
      if (count === 0) {
        return 'No draws will be lost.';
      }
      if (count === 1) {
        return '1 draw will be lost.';
      }
      return `${count} draws will be lost.`;
    },
    restartTitle: 'Restart the game?',
    restartMessage: (count) =>
      `${en.settings.extractionsLost(count)} This game's history will be archived.`,
    restartConfirm: 'Restart',
    rangeTitle: 'Changing the range restarts the game',
    rangeMessage: (from, to, count) =>
      `From ${from} to ${to} balls. ${en.settings.extractionsLost(count)}`,
    rangeConfirm: 'Restart and apply',
  },
  range: {
    title: 'Number range',
    min: 'Minimum',
    max: 'Maximum',
    minLabel: 'Range minimum',
    maxLabel: 'Range maximum',
    total: (total) => `${total} balls`,
    apply: 'Apply',
    applyLabel: 'Apply range',
    errors: {
      NOT_INTEGER: 'Use whole numbers.',
      MIN_AT_LEAST_ONE: 'The range starts at 1.',
      MIN_NOT_LESS_THAN_MAX: 'The minimum must be lower than the maximum.',
      MAX_EXCEEDED: 'For now the maximum is 200 balls.',
    },
    empty: 'Enter the minimum and the maximum.',
    shortWarning: 'Such a short range ends the game in 10 draws.',
    presets: {
      eu90: 'European',
      us75: 'American',
      n80: '80 balls',
      custom: 'Custom',
    },
    presetDetail: (min, max, total) => `${min}–${max} · ${total} balls`,
    customDetail: 'Choose the minimum and the maximum',
  },
  privacy: {
    title: 'Privacy',
    close: 'Close',
    footer: 'Offline by design.',
    points: [
      'The app sends no data to any server. There are no accounts and no sign-in.',
      'It includes no analytics, advertising or third-party trackers.',
      'The game and the preferences are stored only on this device.',
      'In production the Android binary does not request the internet permission.',
      'It does not access contacts, location, camera, microphone or photos.',
    ],
  },
  notFound: { title: 'Screen not found', back: 'Back to the draw' },
};

/** Both catalogs, keyed by language. */
export const MESSAGES: Record<Language, Messages> = { es, en };

/** The catalog of one language; the provider memoizes this per language. */
export function messagesFor(language: Language): Messages {
  return MESSAGES[language];
}

/** Narrowing for values that come from storage or native APIs (§4.7). */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
