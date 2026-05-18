import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { LlmApiError, type LlmClient, type SummarizerInput } from "./types";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 600;

export type AnthropicClientOptions = {
	apiKey: string;
	model: string;
	fetchImpl?: typeof fetch;
	maxTokens?: number;
};

type AnthropicMessageResponse = {
	content: Array<{ type: string; text?: string }>;
	stop_reason?: string;
};

export function createAnthropicClient(
	options: AnthropicClientOptions,
): LlmClient {
	if (!options.apiKey) throw new Error("Anthropic apiKey is required");
	if (!options.model) throw new Error("Anthropic model is required");
	const fetchImpl = options.fetchImpl ?? fetch;
	const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

	async function postMessage(userContent: string): Promise<string> {
		const response = await fetchImpl(ANTHROPIC_ENDPOINT, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-api-key": options.apiKey,
				"anthropic-version": ANTHROPIC_API_VERSION,
			},
			body: JSON.stringify({
				model: options.model,
				max_tokens: maxTokens,
				system: SYSTEM_PROMPT,
				messages: [{ role: "user", content: userContent }],
			}),
		});
		if (!response.ok) {
			const body = await safeText(response);
			throw new LlmApiError(response.status, body);
		}
		const json = (await response.json()) as AnthropicMessageResponse;
		const text = json.content
			.filter((block) => block.type === "text" && block.text)
			.map((block) => block.text!)
			.join("\n")
			.trim();
		if (!text) throw new Error("Anthropic returned an empty response.");
		return text;
	}

	return {
		model: options.model,
		async summarize(input: SummarizerInput): Promise<string> {
			return postMessage(buildUserPrompt(input));
		},
		async ping(): Promise<void> {
			await postMessage(
				'Reply with exactly the bullet "- ok" in a section titled "**Last time**".',
			);
		},
	};
}

async function safeText(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch {
		return "";
	}
}
