const FRAMES = ['\u28CB', '\u28D9', '\u28F9', '\u28F8', '\u28FC', '\u28F4', '\u28E6', '\u28E7', '\u28C7', '\u28CF'];

export interface Spinner {
  start(): void;
  stop(finalMessage?: string): void;
}

export function createSpinner(message: string): Spinner {
  let i = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      if (!process.stderr.isTTY) return;
      timer = setInterval(() => {
        process.stderr.write(`\r  ${FRAMES[i++ % FRAMES.length]} ${message}`);
      }, 80);
    },
    stop(finalMessage?: string) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (!process.stderr.isTTY) return;
      process.stderr.write(`\r${''.padEnd(message.length + 6)}\r`);
      if (finalMessage) {
        process.stderr.write(`  ${finalMessage}\n`);
      }
    },
  };
}
