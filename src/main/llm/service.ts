import log from "../log";
import { secrets } from "../secrets";
import { settings } from "../settings";
import { createAnthropicClient } from "./anthropic";
import { createOpenAiClient } from "./openai";
import {
	LlmApiError,
	type LlmClient,
	type LlmConfig,
	type LlmProvider,
	type LlmTestOutcome,
	type SummarizerInput,
} from "./types";

class LlmService {
	private client: LlmClient | null = null;
	private clientCacheKey: string | null = null;

	getActiveProvider(): LlmProvider {
		return settings.get("llmProvider");
	}

	getActiveModel(provider: LlmProvider = this.getActiveProvider()): string {
		return provider === "anthropic"
			? settings.get("anthropicModel")
			: settings.get("openaiModel");
	}

	getActiveConfig(): LlmConfig {
		const provider = this.getActiveProvider();
		return { provider, model: this.getActiveModel(provider) };
	}

	hasKey(provider: LlmProvider = this.getActiveProvider()): boolean {
		return provider === "anthropic"
			? secrets.hasAnthropicApiKey()
			: secrets.hasOpenAiApiKey();
	}

	hasActiveKey(): boolean {
		return this.hasKey(this.getActiveProvider());
	}

	saveKey(provider: LlmProvider, apiKey: string): void {
		const trimmed = apiKey.trim();
		if (provider === "anthropic") secrets.setAnthropicApiKey(trimmed);
		else secrets.setOpenAiApiKey(trimmed);
		this.invalidate();
	}

	clearKey(provider: LlmProvider): void {
		if (provider === "anthropic") secrets.clearAnthropicApiKey();
		else secrets.clearOpenAiApiKey();
		this.invalidate();
	}

	setActiveProvider(provider: LlmProvider): void {
		settings.set("llmProvider", provider);
		this.invalidate();
	}

	setModel(provider: LlmProvider, model: string): void {
		const trimmed = model.trim();
		if (trimmed.length === 0) return;
		if (provider === "anthropic") settings.set("anthropicModel", trimmed);
		else settings.set("openaiModel", trimmed);
		this.invalidate();
	}

	async summarize(input: SummarizerInput): Promise<string> {
		const client = this.getClient();
		if (!client) throw new Error("No LLM provider configured.");
		return client.summarize(input);
	}

	async test(): Promise<LlmTestOutcome> {
		const client = this.getClient();
		if (!client) return { ok: false, error: "No LLM provider configured." };
		try {
			await client.ping();
			return { ok: true, model: client.model };
		} catch (err) {
			const message =
				err instanceof LlmApiError
					? `HTTP ${err.status}: ${err.body.slice(0, 200)}`
					: err instanceof Error
						? err.message
						: String(err);
			log.warn("LLM ping failed", err);
			return { ok: false, error: message };
		}
	}

	private getClient(): LlmClient | null {
		const config = this.getActiveConfig();
		const apiKey =
			config.provider === "anthropic"
				? secrets.getAnthropicApiKey()
				: secrets.getOpenAiApiKey();
		if (!apiKey) return null;
		const cacheKey = `${config.provider}|${config.model}|${apiKey}`;
		if (this.client && this.clientCacheKey === cacheKey) return this.client;
		this.client =
			config.provider === "anthropic"
				? createAnthropicClient({ apiKey, model: config.model })
				: createOpenAiClient({ apiKey, model: config.model });
		this.clientCacheKey = cacheKey;
		return this.client;
	}

	private invalidate(): void {
		this.client = null;
		this.clientCacheKey = null;
	}
}

export const llmService = new LlmService();
