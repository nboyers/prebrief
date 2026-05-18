import { describe, expect, it } from "vitest";
import { createOpenAiClient } from "../../../../src/main/llm/openai";
import { LlmApiError } from "../../../../src/main/llm/types";

const sampleInput = {
	upcoming: {
		title: "Sync",
		startTime: "2026-05-20T15:00:00Z",
		attendees: ["A"],
	},
	priorNote: {
		id: "not_1",
		title: "Sync",
		createdAt: "2026-05-13T15:00:00Z",
		summary: "ok",
	},
};

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

describe("createOpenAiClient.summarize", () => {
	it("posts /v1/chat/completions with a Bearer auth header and includes the system prompt", async () => {
		let calledUrl: string | undefined;
		let headers: Record<string, string> | undefined;
		let body: string | undefined;
		const fetchImpl: typeof fetch = async (input, init) => {
			calledUrl = typeof input === "string" ? input : (input as URL).toString();
			headers = init?.headers as Record<string, string>;
			body = init?.body as string;
			return jsonResponse({
				choices: [{ message: { content: "**Last time**\n- ok" } }],
			});
		};

		const client = createOpenAiClient({
			apiKey: "sk-test",
			model: "gpt-4o-mini",
			fetchImpl,
		});
		const result = await client.summarize(sampleInput);

		expect(result).toBe("**Last time**\n- ok");
		expect(calledUrl).toBe("https://api.openai.com/v1/chat/completions");
		expect(headers?.Authorization).toBe("Bearer sk-test");
		const parsed = JSON.parse(body!);
		expect(parsed.model).toBe("gpt-4o-mini");
		expect(parsed.messages[0].role).toBe("system");
		expect(parsed.messages[0].content).toContain("**Last time**");
		expect(parsed.messages[1].role).toBe("user");
	});

	it("throws LlmApiError on non-2xx", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response("nope", { status: 429 });

		const client = createOpenAiClient({
			apiKey: "k",
			model: "gpt-4o-mini",
			fetchImpl,
		});

		await expect(client.summarize(sampleInput)).rejects.toBeInstanceOf(
			LlmApiError,
		);
	});

	it("throws when content is empty or null", async () => {
		const fetchImpl: typeof fetch = async () =>
			jsonResponse({ choices: [{ message: { content: null } }] });

		const client = createOpenAiClient({
			apiKey: "k",
			model: "gpt-4o-mini",
			fetchImpl,
		});

		await expect(client.summarize(sampleInput)).rejects.toThrow(
			/empty response/i,
		);
	});
});
