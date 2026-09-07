export interface ConfigurationResult {
  ok: boolean;
  message: string;
  code?: string;
  revision?: number;
}
export interface ConfigurationTarget<T> { key: string; value: T; }
type Submit<T> = (targets: ConfigurationTarget<T>[]) => Promise<ConfigurationResult>;
type Report = (result: ConfigurationResult) => void;
interface Entry<T> { value: T; confirmed: T; sequence: number; revision?: number; result?: ConfigurationResult; }
interface Command<T> {
  targets: ConfigurationTarget<T>[];
  sequences: Map<string, number>;
  submit: Submit<T>;
  report: Report;
  uncertain: boolean;
}

/** A transport error is not evidence that an idempotent write was rejected. */
export function configurationFailure(reason: unknown): ConfigurationResult {
  const error = reason as { message?: string; code?: string; status?: number } | null;
  const definitive = error?.status !== undefined && error.status >= 400 && error.status < 500
    && error.status !== 408 && error.status !== 429;
  return { ok: false, message: error?.message || '设置结果未确认，请核对服务器状态',
    code: definitive ? error?.code : 'OPERATION_RESULT_UNCONFIRMED' };
}
export function isUnconfirmedConfiguration(result: ConfigurationResult) {
  return !result.ok && ['WRITE_RESULT_UNCONFIRMED', 'OPERATION_RESULT_UNCONFIRMED', 'ACTION_RESULT_UNCONFIRMED'].includes(result.code || '');
}

/** Coalesces unsent, overlapping batches. Sent batches remain atomic and cannot be cancelled. */
export class LatestConfigurationQueue<T> {
  private entries = new Map<string, Entry<T>>();
  private active = new Set<Command<T>>();
  private pending: Command<T>[] = [];
  private listeners = new Set<() => void>();
  private version = 0;
  private sequence = 0;
  private disposed = false;
  private equal: (left: T, right: T) => boolean;

  constructor(equal: (left: T, right: T) => boolean = Object.is) { this.equal = equal; }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.version;
  read(key: string, authority: T): T { return this.entries.get(key)?.value ?? authority; }
  isBusy(key: string) {
    return [...this.active, ...this.pending].some((command) => command.sequences.has(key));
  }
  private emit() { this.version += 1; for (const listener of this.listeners) listener(); }
  dispose() {
    this.disposed = true;
    this.entries.clear();
    this.pending = [];
    this.active.clear();
    this.emit();
    this.listeners.clear();
  }

  reconcile(authority: ReadonlyMap<string, T>, revision?: number) {
    if (this.disposed) return;
    let changed = false;
    for (const [key, entry] of this.entries) {
      // An older read must not replace a newer receipt, including asset removal.
      if (revision !== undefined && entry.revision !== undefined && revision < entry.revision) continue;
      if (!authority.has(key)) {
        // Never silently turn an atomic batch into a partial one after an asset disappears.
        const invalid = this.pending.filter((command) => command.sequences.has(key));
        this.pending = this.pending.filter((command) => !invalid.includes(command));
        for (const command of invalid) {
          for (const target of command.targets) {
            const current = this.entries.get(target.key);
            if (current && current.sequence === command.sequences.get(target.key)) {
              const predecessor = [...this.active].find((active) => active.sequences.has(target.key));
              current.value = predecessor?.targets.find((item) => item.key === target.key)?.value ?? current.confirmed;
              if (predecessor) current.sequence = predecessor.sequences.get(target.key)!;
            }
          }
          command.report({ ok: false, message: '建筑已变化，未提交的生产配置已取消' });
        }
        this.entries.delete(key);
        changed = true;
      } else {
        const value = authority.get(key)!;
        const acceptsSnapshot = revision !== undefined
          && (entry.revision === undefined || revision >= entry.revision);
        if (!this.isBusy(key) && (this.equal(value, entry.value) || acceptsSnapshot)) {
          this.entries.delete(key);
          changed = true;
        } else if (acceptsSnapshot) {
          // Keep the visible target while writing, but roll back to the newest
          // authoritative baseline if it fails. A snapshot is not a write receipt.
          if (revision !== entry.revision || !this.equal(entry.confirmed, value)) entry.result = undefined;
          entry.confirmed = value;
          entry.revision = revision;
        }
      }
    }
    if (changed) this.emit();
    this.drain();
  }

  enqueue(targets: ConfigurationTarget<T>[], authority: ReadonlyMap<string, T>, submit: Submit<T>, report: Report) {
    if (this.disposed || !targets.length) return;
    if (targets.some(({ key }) => !authority.has(key))) {
      report({ ok: false, message: '建筑已变化，生产配置未提交' });
      return;
    }
    const retry = [...this.active].filter((command) => command.uncertain
      && targets.some(({ key }) => command.sequences.has(key)));
    if (!retry.length && targets.every(({ key, value }) => this.equal(this.read(key, authority.get(key)!), value))) return;
    const sequence = ++this.sequence;
    const merged = new Map<string, ConfigurationTarget<T>>();
    const sequences = new Map<string, number>();
    const overlapping = new Set<Command<T>>();
    const keys = new Set(targets.map(({ key }) => key));
    // Include transitive overlap so a batch never splits and a key never has two pending writes.
    let added = true;
    while (added) {
      added = false;
      for (const command of this.pending) {
        if (overlapping.has(command) || !command.targets.some(({ key }) => keys.has(key))) continue;
        overlapping.add(command);
        command.targets.forEach(({ key }) => keys.add(key));
        added = true;
      }
    }
    for (const command of this.pending) {
      if (!overlapping.has(command)) continue;
      for (const target of command.targets) { merged.set(target.key, target); sequences.set(target.key, command.sequences.get(target.key)!); }
    }
    this.pending = this.pending.filter((command) => !overlapping.has(command));
    for (const target of targets) {
      const previous = this.entries.get(target.key);
      this.entries.set(target.key, { value: target.value, confirmed: previous?.confirmed ?? authority.get(target.key)!, sequence,
        revision: previous?.revision, result: previous?.result });
      merged.set(target.key, target);
      sequences.set(target.key, sequence);
    }
    this.pending.push({ targets: [...merged.values()], sequences, submit, report, uncertain: false });
    this.emit();
    // User interaction can confirm an uncertain predecessor with its ORIGINAL payload/idempotency key.
    // Polls never replay writes, and successors remain blocked until that receipt is known.
    for (const command of retry) { command.uncertain = false; void this.execute(command); }
    this.drain();
  }

  private drain() {
    if (this.disposed) return;
    for (const command of [...this.pending]) {
      if ([...this.active].some((active) => command.targets.some(({ key }) => active.sequences.has(key)))) continue;
      this.pending = this.pending.filter((pending) => pending !== command);
      if (command.targets.every(({ key, value }) => {
        const entry = this.entries.get(key);
        return entry && this.equal(entry.confirmed, value);
      })) {
        const receipts = command.targets.map(({ key }) => this.entries.get(key)?.result).filter(Boolean) as ConfigurationResult[];
        const latest = receipts.sort((a, b) => (b.revision ?? -1) - (a.revision ?? -1))[0];
        command.report(latest ?? { ok: true, message: '配置已确认' });
        this.emit();
        continue;
      }
      this.active.add(command);
      void this.execute(command);
    }
  }

  private async execute(command: Command<T>) {
    let result: ConfigurationResult;
    try { result = await command.submit(command.targets); }
    catch (reason) { result = configurationFailure(reason); }
    if (this.disposed) return;
    if (isUnconfirmedConfiguration(result)) {
      command.uncertain = true;
      command.report(result);
      this.emit();
      return;
    }
    this.active.delete(command);
    let latest = false;
    for (const { key, value } of command.targets) {
      const entry = this.entries.get(key);
      if (!entry) continue;
      const superseded = result.revision !== undefined && entry.revision !== undefined
        && result.revision < entry.revision;
      if (result.ok && !superseded) {
        entry.confirmed = value; entry.revision = result.revision; entry.result = result;
      }
      // A rejection carries no configuration value. Preserve the revision of
      // the actual confirmed baseline; newer snapshots may update that fallback.
      if (entry.sequence === command.sequences.get(key)) {
        latest = true;
        if (!result.ok || superseded) entry.value = entry.confirmed;
      }
    }
    if (latest || !result.ok) command.report(result);
    this.emit();
    this.drain();
  }
}
