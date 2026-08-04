import { performance } from 'node:perf_hooks';
import {
  addRequestPhase,
  measureRequestPhase,
  requestPerformanceContext,
  runWithRequestPerformance,
  setRequestGauge,
} from './request-performance.js';

const DEFAULT_MAX_QUEUE_DEPTH = 128;
const DEFAULT_MAX_PENDING_PER_ACTOR = 4;
const DEFAULT_MAX_WAIT_MS = 10_000;
const DEFAULT_RETRY_AFTER_SECONDS = 1;

function positiveInteger(value, fallback) {
  const normalized = Math.floor(Number(value));
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function actorKey(value) {
  const normalized = String(value || 'system').trim();
  return normalized || 'system';
}

function queueError(message, code, retryAfterSeconds = DEFAULT_RETRY_AFTER_SECONDS) {
  return Object.assign(new Error(message), {
    statusCode: 503,
    code,
    retryAfterSeconds,
  });
}

export class AuthoritativeWriteExecutor {
  constructor({
    maxQueueDepth = DEFAULT_MAX_QUEUE_DEPTH,
    maxPendingPerActor = DEFAULT_MAX_PENDING_PER_ACTOR,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    now = () => performance.now(),
  } = {}) {
    this.maxQueueDepth = positiveInteger(maxQueueDepth, DEFAULT_MAX_QUEUE_DEPTH);
    this.maxPendingPerActor = positiveInteger(maxPendingPerActor, DEFAULT_MAX_PENDING_PER_ACTOR);
    this.maxWaitMs = positiveInteger(maxWaitMs, DEFAULT_MAX_WAIT_MS);
    this.now = now;
    this.queue = [];
    this.pendingByActor = new Map();
    this.running = false;
    this.accepting = true;
    this.idleWaiters = [];
    this.diagnostics = {
      submitted: 0,
      completed: 0,
      failed: 0,
      rejected: 0,
      timedOut: 0,
      maxDepth: 0,
      totalWaitMs: 0,
      maxWaitMs: 0,
      lastWaitMs: 0,
      lastOperation: null,
    };
  }

  depth() {
    return this.queue.length + (this.running ? 1 : 0);
  }

  isIdle() {
    return !this.running && this.queue.length === 0;
  }

  getDiagnostics() {
    const averageWaitMs = this.diagnostics.completed + this.diagnostics.failed > 0
      ? this.diagnostics.totalWaitMs / (this.diagnostics.completed + this.diagnostics.failed)
      : 0;
    return {
      accepting: this.accepting,
      running: this.running,
      queueDepth: this.queue.length,
      totalDepth: this.depth(),
      maxQueueDepth: this.maxQueueDepth,
      maxPendingPerActor: this.maxPendingPerActor,
      submitted: this.diagnostics.submitted,
      completed: this.diagnostics.completed,
      failed: this.diagnostics.failed,
      rejected: this.diagnostics.rejected,
      timedOut: this.diagnostics.timedOut,
      maxDepth: this.diagnostics.maxDepth,
      averageWaitMs: Math.round(averageWaitMs * 100) / 100,
      maxWaitMs: Math.round(this.diagnostics.maxWaitMs * 100) / 100,
      lastWaitMs: Math.round(this.diagnostics.lastWaitMs * 100) / 100,
      lastOperation: this.diagnostics.lastOperation,
    };
  }

  submit({
    actor = 'system',
    operation = 'authoritative-write',
    allowWhenFull = false,
    timeoutMs = this.maxWaitMs,
    onSettled = null,
  } = {}, callback) {
    if (typeof callback !== 'function') throw new TypeError('权威写执行器缺少回调');
    if (!this.accepting) {
      this.diagnostics.rejected += 1;
      throw queueError('游戏服务器正在关闭，请稍后重试', 'WRITE_QUEUE_CLOSED');
    }

    const normalizedActor = actorKey(actor);
    const actorPending = Number(this.pendingByActor.get(normalizedActor) || 0);
    if (!allowWhenFull && this.depth() >= this.maxQueueDepth) {
      this.diagnostics.rejected += 1;
      setRequestGauge('writeQueueRejected', 1);
      throw queueError('游戏服务器写入队列繁忙，请稍后重试', 'WRITE_QUEUE_BUSY');
    }
    if (!allowWhenFull && actorPending >= this.maxPendingPerActor) {
      this.diagnostics.rejected += 1;
      setRequestGauge('writeQueueRejected', 1);
      throw queueError('当前账号待处理操作过多，请稍后重试', 'WRITE_QUEUE_ACTOR_LIMIT');
    }

    const normalizedTimeout = timeoutMs === null
      ? null
      : positiveInteger(timeoutMs, this.maxWaitMs);
    const submittedAt = this.now();
    const context = requestPerformanceContext();
    this.pendingByActor.set(normalizedActor, actorPending + 1);
    this.diagnostics.submitted += 1;

    const promise = new Promise((resolve, reject) => {
      this.queue.push({
        actor: normalizedActor,
        operation: String(operation || 'authoritative-write'),
        callback,
        context,
        submittedAt,
        timeoutMs: normalizedTimeout,
        resolve,
        reject,
        onSettled: typeof onSettled === 'function' ? onSettled : null,
      });
    });
    this.diagnostics.maxDepth = Math.max(this.diagnostics.maxDepth, this.depth());
    setRequestGauge('writeQueueDepth', this.queue.length);
    setRequestGauge('writeQueueRejected', 0);
    this.#drainNext();
    return promise;
  }

  stopAccepting() {
    this.accepting = false;
  }

  async close({ drain = true } = {}) {
    this.stopAccepting();
    if (!drain) {
      const error = queueError('游戏服务器正在关闭，请稍后重试', 'WRITE_QUEUE_CLOSED');
      for (const task of this.queue.splice(0)) {
        this.#finishActor(task.actor);
        task.reject(error);
      }
    }
    if (this.isIdle()) return;
    await new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  #finishActor(actor) {
    const remaining = Number(this.pendingByActor.get(actor) || 0) - 1;
    if (remaining > 0) this.pendingByActor.set(actor, remaining);
    else this.pendingByActor.delete(actor);
  }

  #notifyIdle() {
    if (!this.isIdle()) return;
    for (const resolve of this.idleWaiters.splice(0)) resolve();
  }

  #completeTask(task, { error, value }) {
    this.#finishActor(task.actor);
    this.running = false;
    if (task.onSettled) {
      try { task.onSettled(error || null, value); } catch { /* diagnostics callbacks cannot break authority */ }
    }
    if (error) {
      this.diagnostics.failed += 1;
      task.reject(error);
    } else {
      this.diagnostics.completed += 1;
      task.resolve(value);
    }
    setRequestGauge('writeQueueDepth', this.queue.length);
    this.#notifyIdle();
    this.#drainNext();
  }

  #drainNext() {
    if (this.running) return;
    const task = this.queue.shift();
    if (!task) {
      this.#notifyIdle();
      return;
    }

    const startedAt = this.now();
    const waitMs = Math.max(0, startedAt - task.submittedAt);
    if (task.timeoutMs !== null && waitMs > task.timeoutMs) {
      this.diagnostics.timedOut += 1;
      this.diagnostics.rejected += 1;
      this.#finishActor(task.actor);
      const error = queueError('游戏服务器写入等待超时，请重试', 'WRITE_QUEUE_TIMEOUT');
      if (task.onSettled) {
        try { task.onSettled(error); } catch { /* diagnostics callbacks cannot break authority */ }
      }
      task.reject(error);
      this.#drainNext();
      return;
    }

    this.running = true;
    this.diagnostics.lastWaitMs = waitMs;
    this.diagnostics.maxWaitMs = Math.max(this.diagnostics.maxWaitMs, waitMs);
    this.diagnostics.totalWaitMs += waitMs;
    this.diagnostics.lastOperation = task.operation;

    const execute = () => {
      addRequestPhase('writeQueueWaitMs', waitMs);
      setRequestGauge('writeQueueDepth', this.queue.length);
      return measureRequestPhase('writeExecutionMs', task.callback);
    };

    let result;
    try {
      result = task.context
        ? runWithRequestPerformance(task.context, execute)
        : execute();
    } catch (error) {
      this.#completeTask(task, { error });
      return;
    }

    if (result && typeof result.then === 'function') {
      result.then(
        (value) => this.#completeTask(task, { value }),
        (error) => this.#completeTask(task, { error }),
      );
      return;
    }
    this.#completeTask(task, { value: result });
  }
}
