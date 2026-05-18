import { TokenBucket } from "./rate-limiter";
import type {
	GranolaListResponse,
	GranolaNoteDetail,
	GranolaNoteSummary,
	GranolaTestResult,
} from "./types";

export type GranolaClientOptions = {
	apiKey: string;
	baseUrl?: string;
	fetchImpl?: typeof fetch;
	rateLimiter?: TokenBucket;
};

export type ListNotesOptions = {
	since?: Date;
	cursor?: string;
};

const DEFAULT_BASE_URL = "https://public-api.granola.ai";
const DEFAULT_CAPACITY = 25;
const DEFAULT_REFILL_PER_SECOND = 5;

export class GranolaApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "GranolaApiError";
	}
}

export class GranolaClient {
	private readonly apiKey: string;
	private readonly baseUrl: string;
	private readonly fetchImpl: typeof fetch;
	private readonly rateLimiter: TokenBucket;

	constructor(options: GranolaClientOptions) {
		if (!options.apiKey) throw new Error("apiKey is required");
		this.apiKey = options.apiKey;
		this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.rateLimiter =
			options.rateLimiter ??
			new TokenBucket({
				capacity: DEFAULT_CAPACITY,
				refillPerSecond: DEFAULT_REFILL_PER_SECOND,
			});
	}

	async listNotesPage(
		options: ListNotesOptions = {},
	): Promise<GranolaListResponse> {
		const params = new URLSearchParams();
		if (options.since) params.set("created_after", options.since.toISOString());
		if (options.cursor) params.set("cursor", options.cursor);
		const query = params.toString();
		const path = `/v1/notes${query ? `?${query}` : ""}`;
		return this.request<GranolaListResponse>(path);
	}

	async listAllNotesSince(since: Date): Promise<GranolaNoteSummary[]> {
		const all: GranolaNoteSummary[] = [];
		let cursor: string | undefined = undefined;
		do {
			const page: GranolaListResponse = await this.listNotesPage({
				since,
				cursor,
			});
			all.push(...page.notes);
			cursor = page.hasMore ? page.cursor : undefined;
		} while (cursor);
		return all;
	}

	async getNote(
		id: string,
		options: { includeTranscript?: boolean } = {},
	): Promise<GranolaNoteDetail> {
		const params = new URLSearchParams();
		if (options.includeTranscript) params.set("include", "transcript");
		const query = params.toString();
		const path = `/v1/notes/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;
		return this.request<GranolaNoteDetail>(path);
	}

	async test(): Promise<GranolaTestResult> {
		try {
			const page = await this.listNotesPage();
			return { ok: true, sampleCount: page.notes.length };
		} catch (err) {
			if (err instanceof GranolaApiError) {
				return { ok: false, error: `HTTP ${err.status}: ${err.message}` };
			}
			const message = err instanceof Error ? err.message : String(err);
			return { ok: false, error: message };
		}
	}

	private async request<T>(path: string): Promise<T> {
		await this.rateLimiter.acquire();
		const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				Accept: "application/json",
			},
		});
		if (!response.ok) {
			const body = await safeReadText(response);
			throw new GranolaApiError(
				response.status,
				body || response.statusText || "Granola API request failed",
			);
		}
		return (await response.json()) as T;
	}
}

async function safeReadText(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch {
		return "";
	}
}
