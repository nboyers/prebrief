import { describe, expect, it } from "vitest";
import { TokenBucket } from "../../../../src/main/granola/rate-limiter";

class FakeClock {
	private nowMs = 0;
	private readonly pending: Array<{ resumeAt: number; resolve: () => void }> = [];

	now = (): number => this.nowMs;

	sleep = (ms: number): Promise<void> => {
		return new Promise<void>((resolve) => {
			this.pending.push({ resumeAt: this.nowMs + ms, resolve });
		});
	};

	async advance(ms: number): Promise<void> {
		this.nowMs += ms;
		const ready = this.pending.filter((p) => p.resumeAt <= this.nowMs);
		for (const p of ready) {
			this.pending.splice(this.pending.indexOf(p), 1);
			p.resolve();
		}
		await Promise.resolve();
	}
}

describe("TokenBucket", () => {
	it("acquires up to capacity tokens without waiting", async () => {
		const clock = new FakeClock();
		const bucket = new TokenBucket({
			capacity: 3,
			refillPerSecond: 1,
			now: clock.now,
			sleep: clock.sleep,
		});

		const start = clock.now();
		await bucket.acquire();
		await bucket.acquire();
		await bucket.acquire();
		expect(clock.now()).toBe(start);
	});

	it("waits for refill once capacity is exhausted", async () => {
		const clock = new FakeClock();
		const bucket = new TokenBucket({
			capacity: 1,
			refillPerSecond: 1,
			now: clock.now,
			sleep: clock.sleep,
		});

		await bucket.acquire();
		const pending = bucket.acquire();
		await clock.advance(500);
		await clock.advance(500);
		await pending;
		expect(clock.now()).toBeGreaterThanOrEqual(1000);
	});

	it("rejects invalid configuration", () => {
		expect(
			() => new TokenBucket({ capacity: 0, refillPerSecond: 1 }),
		).toThrow();
		expect(
			() => new TokenBucket({ capacity: 1, refillPerSecond: 0 }),
		).toThrow();
	});
});
