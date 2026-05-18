import { describe, expect, it } from "vitest";
import { createAnthropicClient } from "../../../../src/main/llm/anthropic";
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

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
		...init,
	});
}

describe("createAnthropicClient.summarize", () => {
	it("posts the messages API with x-api-key and anthropic-version headers", async () => {
		let calledUrl: string | undefined;
		let headers: Record<string, string> | undefined;
		let body: string | undefined;
		const fetchImpl: typeof fetch = async (input, init) => {
			calledUrl = typeof input === "string" ? input : (input as URL).toString();
			headers = init?.headers as Record<string, string>;
			body = init?.body as string;
			return jsonResponse({
				content: [{ type: "text", text: "**Last time**\n- ok" }],
			});
		};

		const client = createAnthropicClient({
			apiKey: "sk-ant-test",
			model: "claude-sonnet-4-5",
			fetchImpl,
		});
		const result = await client.summarize(sampleInput);

		expect(result).toBe("**Last time**\n- ok");
		expect(calledUrl).toBe("https://api.anthropic.com/v1/messages");
		expect(headers?.["x-api-key"]).toBe("sk-ant-test");
		expect(headers?.["anthropic-version"]).toBe("2023-06-01");
		const parsed = JSON.parse(body!);
		expect(parsed.model).toBe("claude-sonnet-4-5");
		expect(parsed.system).toContain("**Last time**");
		expect(parsed.messages[0].role).toBe("user");
	});

	it("concatenates text blocks and trims whitespace", async () => {
		const fetchImpl: typeof fetch = async () =>
			jsonResponse({
				content: [
					{ type: "text", text: "  hello\n" },
					{ type: "text", text: "world  " },
				],
			});

		const client = createAnthropicClient({
			apiKey: "k",
			model: "claude-sonnet-4-5",
			fetchImpl,
		});
		const result = await client.summarize(sampleInput);

		expect(result).toBe("hello\n\nworld");
	});

	it("throws LlmApiError on non-2xx", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response("forbidden", { status: 401 });

		const client = createAnthropicClient({
			apiKey: "k",
			model: "claude-sonnet-4-5",
			fetchImpl,
		});

		await expect(client.summarize(sampleInput)).rejects.toBeInstanceOf(
			LlmApiError,
		);
	});

	it("throws on empty content", async () => {
		const fetchImpl: typeof fetch = async () => jsonResponse({ content: [] });

		const client = createAnthropicClient({
			apiKey: "k",
			model: "claude-sonnet-4-5",
			fetchImpl,
		});

		await expect(client.summarize(sampleInput)).rejects.toThrow(
			/empty response/i,
		);
	});

	it("rejects construction without apiKey or model", () => {
		expect(() =>
			createAnthropicClient({ apiKey: "", model: "claude-sonnet-4-5" }),
		).toThrow();
		expect(() => createAnthropicClient({ apiKey: "k", model: "" })).toThrow();
	});
});
