/**
 * Domain result type.
 *
 * The domain never throws for expected failures and never returns `null` to mean
 * "it failed": an impossible state is represented, not raised (plan §6.3).
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
