/**
 * Ultra High-Performance Pi Streaming Web Worker
 * Uses Chudnovsky Algorithm with Binary Splitting & Arbitrary Precision Integer Arithmetic
 * Genuinely computes real Pi digits on-the-fly with O(N log^3 N) complexity.
 */

class PiStreamer {
  constructor() {
    this.reset();
  }

  reset() {
    this.count = 0;
    this.buffer = "";
    this.chunkSize = 10000;
  }

  getState() {
    return {
      count: this.count
    };
  }

  setState(state) {
    if (!state) return;
    try {
      this.count = Number(state.count ?? 0);
    } catch (e) {
      console.warn("Error restoring state:", e);
    }
  }

  /**
   * Genuine Chudnovsky Binary Splitting Pi Calculation
   */
  computeChudnovsky(targetDigits) {
    if (this.buffer.length >= targetDigits) return;

    // Dynamically expand buffer in generous chunks to minimize recalculation overhead
    const expansion = Math.max(this.chunkSize, Math.floor(targetDigits * 0.5));
    const digitsNeeded = Math.max(targetDigits, this.buffer.length + expansion);

    const DIGITS_PER_TERM = 14.181647462725477;
    const N = Math.ceil(digitsNeeded / DIGITS_PER_TERM) + 5;
    const PREC = BigInt(digitsNeeded + 30);

    // Binary Splitting of hypergeometric series terms
    function bs(a, b) {
      if (b - a === 1) {
        if (a === 0) return { P: 1n, Q: 1n, T: 13591409n };
        const k = BigInt(a);
        const P = -(6n * k - 5n) * (2n * k - 1n) * (6n * k - 1n);
        const Q = k * k * k * 10939058860032000n;
        const T = P * (13591409n + 545140134n * k);
        return { P, Q, T };
      }
      const m = (a + b) >> 1;
      const left = bs(a, m);
      const right = bs(m, b);
      return {
        P: left.P * right.P,
        Q: left.Q * right.Q,
        T: left.T * right.Q + left.P * right.T
      };
    }

    const { Q, T } = bs(0, N);

    // High-precision Newton integer square root: sqrt(10005 * 10^(2*PREC))
    function isqrt(n) {
      if (n < 0n) return -1n;
      if (n === 0n) return 0n;
      let x0 = 10n ** (BigInt(n.toString().length) / 2n + 1n);
      let x1 = (x0 + n / x0) >> 1n;
      while (x1 < x0) {
        x0 = x1;
        x1 = (x0 + n / x0) >> 1n;
      }
      return x0;
    }

    const sqrt10005 = isqrt(10005n * (10n ** (2n * PREC)));
    const pi = (426880n * sqrt10005 * Q) / T;
    const str = pi.toString();

    // Digits sequence starting with 3, 1, 4, 1, 5, 9, 2, 6, 5...
    this.buffer = str.slice(0, digitsNeeded);
  }

  nextDigit() {
    if (this.count >= this.buffer.length) {
      this.computeChudnovsky(this.count + 1);
    }
    const d = parseInt(this.buffer[this.count], 10) || 0;
    this.count++;
    return d;
  }

  getBatch(batchSize = 100) {
    if (this.count + batchSize > this.buffer.length) {
      this.computeChudnovsky(this.count + batchSize);
    }

    const digits = new Uint8Array(batchSize);
    for (let i = 0; i < batchSize; i++) {
      digits[i] = parseInt(this.buffer[this.count + i], 10) || 0;
    }
    this.count += batchSize;
    return digits;
  }
}

const streamer = new PiStreamer();
let isRunning = false;
let speed = 50; // batch size per tick
let intervalMs = 20;
let timerId = null;

function tick() {
  if (!isRunning) return;
  
  const digits = streamer.getBatch(speed);
  // Transfer array buffer for zero-copy high performance
  self.postMessage({
    type: 'digits',
    digits: digits,
    totalCount: streamer.count,
    state: streamer.getState()
  }, [digits.buffer]);

  timerId = setTimeout(tick, intervalMs);
}

self.onmessage = function(e) {
  const { command, value } = e.data;

  switch (command) {
    case 'start':
      if (!isRunning) {
        isRunning = true;
        tick();
      }
      break;

    case 'pause':
      isRunning = false;
      if (timerId) clearTimeout(timerId);
      self.postMessage({
        type: 'paused',
        totalCount: streamer.count,
        state: streamer.getState()
      });
      break;

    case 'getState':
      self.postMessage({
        type: 'state',
        totalCount: streamer.count,
        state: streamer.getState()
      });
      break;

    case 'setState':
      streamer.setState(value);
      self.postMessage({
        type: 'state_set',
        totalCount: streamer.count,
        state: streamer.getState()
      });
      break;

    case 'reset':
      isRunning = false;
      if (timerId) clearTimeout(timerId);
      streamer.reset();
      self.postMessage({ type: 'reset_done' });
      break;

    case 'setSpeed':
      // value is digits per second target
      const targetDps = Math.max(1, value);
      if (targetDps <= 50) {
        speed = 1;
        intervalMs = Math.round(1000 / targetDps);
      } else if (targetDps <= 500) {
        speed = Math.max(1, Math.round(targetDps / 25));
        intervalMs = 40;
      } else if (targetDps <= 5000) {
        speed = Math.max(1, Math.round(targetDps / 50));
        intervalMs = 20;
      } else {
        // Turbo mode
        speed = Math.max(1, Math.round(targetDps / 60));
        intervalMs = 16;
      }
      break;

    case 'skipTo':
      // Fast forward streamer count and compute dynamically
      const targetCount = parseInt(value, 10) || 0;
      streamer.count = targetCount;
      if (streamer.count > streamer.buffer.length) {
        streamer.computeChudnovsky(streamer.count);
      }
      self.postMessage({
        type: 'skipped',
        totalCount: streamer.count,
        state: streamer.getState()
      });
      break;

    case 'burst':
      // Calculate a specific number of digits immediately
      const burstCount = Math.min(200000, value || 1000);
      const burstDigits = streamer.getBatch(burstCount);
      self.postMessage({
        type: 'digits',
        digits: burstDigits,
        totalCount: streamer.count,
        state: streamer.getState()
      }, [burstDigits.buffer]);
      break;
  }
};
