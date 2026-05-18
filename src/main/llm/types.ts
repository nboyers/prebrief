export type LlmProvider = "anthropic" | "openai";

export type LlmConfig = {
	provider: LlmProvider;
	model: string;
};

export type SummarizerUpcoming = {
	title: string;
	startTime: string;
	attendees: string[];
	description?: string;
};

export type SummarizerPriorNote = {
	id: string;
	title: string;
	createdAt: string;
	summary?: string;
};

export type SummarizerInput = {
	upcoming: SummarizerUpcoming;
	priorNote: SummarizerPriorNote;
};

export type LlmTestOutcome =
	| { ok: true; model: string }
	| { ok: false; error: string };

export interface LlmClient {
	summarize(input: SummarizerInput): Promise<string>;
	ping(): Promise<void>;
	readonly model: string;
}

export class LlmApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: string,
	) {
		super(`LLM API error: HTTP ${status}: ${body}`);
		this.name = "LlmApiError";
	}
}
