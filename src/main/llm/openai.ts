import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { LlmApiError, type LlmClient, type SummarizerInput } from "./types";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MAX_TOKENS = 600;

export type OpenAiClientOptions = {
	apiKey: string;
	model: string;
	fetchImpl?: typeof fetch;
	maxTokens?: number;
};

type OpenAiChatResponse = {
	choices: Array<{ message: { content: string | null } }>;
};

export function createOpenAiClient(options: OpenAiClientOptions): LlmClient {
	if (!options.apiKey) throw new Error("OpenAI apiKey is required");
	if (!options.model) throw new Error("OpenAI model is required");
	const fetchImpl = options.fetchImpl ?? fetch;
	const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

	async function postChat(userContent: string): Promise<string> {
		const response = await fetchImpl(OPENAI_ENDPOINT, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				Authorization: `Bearer ${options.apiKey}`,
			},
			body: JSON.stringify({
				model: options.model,
				max_tokens: maxTokens,
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: userContent },
				],
			}),
		});
		if (!response.ok) {
			const body = await safeText(response);
			throw new LlmApiError(response.status, body);
		}
		const json = (await response.json()) as OpenAiChatResponse;
		const text = (json.choices[0]?.message.content ?? "").trim();
		if (!text) throw new Error("OpenAI returned an empty response.");
		return text;
	}

	return {
		model: options.model,
		async summarize(input: SummarizerInput): Promise<string> {
			return postChat(buildUserPrompt(input));
		},
		async ping(): Promise<void> {
			await postChat(
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
