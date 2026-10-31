/**
 * Remembers the text of the last `copyTextFrom` so a flow can assert on it
 * several commands later (plan §8.5, flows 3 and 4).
 *
 * Maestro exposes the captured text as `maestro.copiedText`; anything assigned
 * to the global `output` object is readable from YAML as `${output.captured}`.
 */
output.captured = maestro.copiedText;
