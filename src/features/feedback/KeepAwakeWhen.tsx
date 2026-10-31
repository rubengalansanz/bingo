import { useKeepAwake } from 'expo-keep-awake';

/**
 * Keeps the screen on while mounted (plan §7.9).
 *
 * `useKeepAwake` is a hook, so it cannot be called conditionally inside the
 * screen. This tiny component is mounted only when the condition holds, which
 * is the supported way to make keep-awake follow both the preference and the
 * game state: the tag is unique per instance, so leaving Sorteo releases it.
 */

function KeepAwakeActive() {
  useKeepAwake();
  return null;
}

export function KeepAwakeWhen({ active }: { readonly active: boolean }) {
  return active ? <KeepAwakeActive /> : null;
}
