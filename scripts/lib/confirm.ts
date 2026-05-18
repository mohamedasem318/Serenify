/**
 * Reads a single keystroke from stdin and returns true iff the byte
 * is `y` or `Y`. Used by the entrypoint to gate REMOTE writes per
 * FR-012 / contracts/cli.md.
 *
 * Empty Enter, ESC, anything-but-y -> false (treated as "abort").
 *
 * Implementation note: switches stdin into raw mode so we capture a
 * single key without waiting for the user to press Enter. This matches
 * the "Proceed? (y/N) " UX in the contract — one keystroke, not a
 * full line.
 */
export function confirmProceed(): Promise<boolean> {
  return new Promise((resolveOuter) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      // Non-TTY (e.g. tests that pipe `n\n` in). Fall back to
      // line-buffered read; treat the first character of the first
      // line as the answer.
      let data = "";
      stdin.setEncoding("utf8");
      const onData = (chunk: string): void => {
        data += chunk;
        if (data.includes("\n")) {
          stdin.off("data", onData);
          const first = data.trim().charAt(0);
          resolveOuter(first === "y" || first === "Y");
        }
      };
      stdin.on("data", onData);
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.once("data", (chunk: string) => {
      stdin.setRawMode(false);
      stdin.pause();
      const ch = chunk.charAt(0);
      // Always echo a newline so the next stdout line doesn't sit on
      // the same row as the prompt.
      process.stdout.write("\n");
      resolveOuter(ch === "y" || ch === "Y");
    });
  });
}
