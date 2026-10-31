import { err, ok } from '../result';

describe('Result helpers', () => {
  it('wraps a success', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('wraps a typed failure', () => {
    expect(err('EXHAUSTED')).toEqual({ ok: false, error: 'EXHAUSTED' });
  });
});
