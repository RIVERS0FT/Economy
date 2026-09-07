/** Coalesces receipt-driven reads without holding a button's write-completion state. */
export class ConfirmedActionSync {
  private minimum = -1;
  private task: { controller: AbortController; promise: Promise<void> } | null = null;
  private read: (signal: AbortSignal) => Promise<number>;
  private current: () => number;
  private timeoutMs: number;
  private onError: (reason: unknown) => void;
  constructor(options: {
    read: (signal: AbortSignal) => Promise<number>;
    current: () => number;
    onError: (reason: unknown) => void;
    timeoutMs?: number;
  }) { this.read = options.read; this.current = options.current; this.onError = options.onError; this.timeoutMs = options.timeoutMs ?? 8_000; }
  get busy() { return this.task !== null; }
  get pending() { return this.task?.promise ?? Promise.resolve(); }
  reset() {
    this.task?.controller.abort();
    this.task = null;
    this.minimum = -1;
  }
  request(revision: number): Promise<void> {
    this.minimum = Math.max(this.minimum, revision);
    if (this.task) return this.task.promise;
    if (this.current() >= this.minimum) return Promise.resolve();
    const controller = new AbortController();
    const task = { controller, promise: Promise.resolve() };
    this.task = task;
    task.promise = (async () => {
      try {
        while (!controller.signal.aborted && this.current() < this.minimum) {
          const requested = this.minimum;
          let timer: ReturnType<typeof setTimeout> | undefined;
          let received: number;
          try {
            received = await Promise.race([
              this.read(controller.signal),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                  reject(new Error('服务器状态同步超时'));
                  controller.abort();
                }, this.timeoutMs);
              }),
            ]);
          } finally { clearTimeout(timer); }
          if (controller.signal.aborted) return;
          if (Math.max(received, this.current()) < requested) {
            throw new Error('服务器状态同步落后于已确认操作');
          }
          // A receipt newer than this read's start requires another read, not reuse of stale work.
          if (Math.max(received, this.current()) >= this.minimum) break;
        }
      } catch (reason) {
        if (this.task === task && this.current() < this.minimum) this.onError(reason);
      } finally {
        if (this.task === task) this.task = null;
      }
    })();
    return task.promise;
  }
}
