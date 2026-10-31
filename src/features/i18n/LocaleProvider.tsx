import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_LANGUAGE, messagesFor, type Messages } from '@/core/i18n/messages';
import { useSettingsSelector } from '@/features/settings/useSettings';

/**
 * Language provider (plan §4.7, §7.5).
 *
 * Mirrors `ThemeProvider`: it reads the `language` preference and exposes the
 * memoized catalog, so switching language re-renders only the consumers and
 * never touches the game (DoD §11.2.3).
 *
 * The default context value is the Spanish catalog rather than `undefined` for
 * the same reason as the theme: a screen (and its component test) can render
 * without a provider and still show real copy.
 */

const LocaleContext = createContext<Messages>(messagesFor(DEFAULT_LANGUAGE));

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const language = useSettingsSelector((state) => state.settings.language);
  const messages = useMemo(() => messagesFor(language), [language]);

  return <LocaleContext.Provider value={messages}>{children}</LocaleContext.Provider>;
}

/** The active catalog; every screen reads its copy from here. */
export function useMessages(): Messages {
  return useContext(LocaleContext);
}
