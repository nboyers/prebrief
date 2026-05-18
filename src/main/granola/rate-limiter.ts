export type RateLimiterOptions = {
	capacity: number;
	refillPerSecond: number;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
};

export class TokenBucket {
	private tokens: number;
	private lastRefillMs: number;
	private readonly capacity: number;
	private readonly refillPerMs: number;
	private readonly now: () => number;
	private readonly sleep: (ms: number) => Promise<void>;

	constructor(options: RateLimiterOptions) {
		if (options.capacity <= 0) throw new Error("capacity must be positive");
		if (options.refillPerSecond <= 0)
			throw new Error("refillPerSecond must be positive");
		this.capacity = options.capacity;
		this.refillPerMs = options.refillPerSecond / 1000;
		this.now = options.now ?? Date.now;
		this.sleep =
			options.sleep ??
			((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
		this.tokens = options.capacity;
		this.lastRefillMs = this.now();
	}

	async acquire(): Promise<void> {
		this.refill();
		if (this.tokens >= 1) {
			this.tokens -= 1;
			return;
		}
		const waitMs = Math.ceil((1 - this.tokens) / this.refillPerMs);
		await this.sleep(waitMs);
		this.refill();
		this.tokens -= 1;
	}

	private refill(): void {
		const nowMs = this.now();
		const elapsed = nowMs - this.lastRefillMs;
		if (elapsed <= 0) return;
		this.tokens = Math.min(
			this.capacity,
			this.tokens + elapsed * this.refillPerMs,
		);
		this.lastRefillMs = nowMs;
	}
}
