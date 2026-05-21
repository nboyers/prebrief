import { describe, expect, it } from "vitest";
import {
	GranolaApiError,
	GranolaClient,
} from "../../../../src/main/granola/client";
import { TokenBucket } from "../../../../src/main/granola/rate-limiter";
import type {
	GranolaListResponse,
	GranolaNoteDetail,
} from "../../../../src/main/granola/types";

type RecordedCall = { url: string; init?: RequestInit };

function makeFakeFetch(
	handler: (call: RecordedCall) => Response | Promise<Response>,
) {
	const calls: RecordedCall[] = [];
	const fetchImpl: typeof fetch = async (input, init) => {
		const url = typeof input === "string" ? input : (input as URL).toString();
		const call: RecordedCall = { url, init };
		calls.push(call);
		return handler(call);
	};
	return { fetchImpl, calls };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
		...init,
	});
}

function makeClient(fetchImpl: typeof fetch) {
	return new GranolaClient({
		apiKey: "grn_test",
		fetchImpl,
		rateLimiter: new TokenBucket({ capacity: 100, refillPerSecond: 100 }),
	});
}

describe("GranolaClient.listNotesPage", () => {
	it("sends the bearer token and parses the response", async () => {
		const page: GranolaListResponse = {
			notes: [
				{
					id: "not_1",
					object: "note",
					title: "Sync",
					owner: { name: "Noah", email: "noah@example.com" },
					created_at: "2026-05-13T15:00:00Z",
					updated_at: "2026-05-13T15:00:00Z",
				},
			],
			hasMore: false,
		};
		const { fetchImpl, calls } = makeFakeFetch(() => jsonResponse(page));
		const client = makeClient(fetchImpl);

		const result = await client.listNotesPage();

		expect(result.notes).toHaveLength(1);
		expect(calls[0].url).toBe("https://public-api.granola.ai/v1/notes");
		const headers = calls[0].init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer grn_test");
	});

	it("includes created_after and cursor query params when provided", async () => {
		const { fetchImpl, calls } = makeFakeFetch(() =>
			jsonResponse({ notes: [], hasMore: false }),
		);
		const client = makeClient(fetchImpl);

		await client.listNotesPage({
			since: new Date("2026-05-01T00:00:00Z"),
			cursor: "abc",
		});

		const url = new URL(calls[0].url);
		expect(url.searchParams.get("created_after")).toBe(
			"2026-05-01T00:00:00.000Z",
		);
		expect(url.searchParams.get("cursor")).toBe("abc");
	});

	it("throws GranolaApiError on non-2xx responses", async () => {
		const { fetchImpl } = makeFakeFetch(
			() =>
				new Response("forbidden", {
					status: 403,
					statusText: "Forbidden",
				}),
		);
		const client = makeClient(fetchImpl);

		await expect(client.listNotesPage()).rejects.toBeInstanceOf(
			GranolaApiError,
		);
	});
});

describe("GranolaClient.listAllNotesSince", () => {
	it("follows the cursor across multiple pages", async () => {
		const pages: GranolaListResponse[] = [
			{
				notes: [
					{
						id: "not_1",
						object: "note",
						title: "A",
						owner: { name: "n", email: "n@x" },
						created_at: "2026-05-13T00:00:00Z",
						updated_at: "2026-05-13T00:00:00Z",
					},
				],
				hasMore: true,
				cursor: "page-2",
			},
			{
				notes: [
					{
						id: "not_2",
						object: "note",
						title: "B",
						owner: { name: "n", email: "n@x" },
						created_at: "2026-05-14T00:00:00Z",
						updated_at: "2026-05-14T00:00:00Z",
					},
				],
				hasMore: false,
			},
		];
		let i = 0;
		const { fetchImpl, calls } = makeFakeFetch(() => jsonResponse(pages[i++]));
		const client = makeClient(fetchImpl);

		const all = await client.listAllNotesSince(new Date("2026-05-01T00:00:00Z"));

		expect(all.map((n) => n.id)).toEqual(["not_1", "not_2"]);
		expect(calls).toHaveLength(2);
		expect(new URL(calls[1].url).searchParams.get("cursor")).toBe("page-2");
	});
});

describe("GranolaClient.listAllHydratedNotesSince", () => {
	it("hydrates each summary via getNote and returns details", async () => {
		const summaries = {
			notes: [
				{
					id: "not_1",
					object: "note",
					title: "A",
					owner: { name: "n", email: "n@x" },
					created_at: "2026-05-13T00:00:00Z",
					updated_at: "2026-05-13T00:00:00Z",
				},
				{
					id: "not_2",
					object: "note",
					title: "B",
					owner: { name: "n", email: "n@x" },
					created_at: "2026-05-14T00:00:00Z",
					updated_at: "2026-05-14T00:00:00Z",
				},
			],
			hasMore: false,
		};
		const details: Record<string, GranolaNoteDetail> = {
			not_1: {
				id: "not_1",
				object: "note",
				title: "A",
				owner: { name: "n", email: "n@x" },
				created_at: "2026-05-13T00:00:00Z",
				updated_at: "2026-05-13T00:00:00Z",
				summary: "summary A",
				calendar_event: { calendar_event_id: "evt_a" },
			},
			not_2: {
				id: "not_2",
				object: "note",
				title: "B",
				owner: { name: "n", email: "n@x" },
				created_at: "2026-05-14T00:00:00Z",
				updated_at: "2026-05-14T00:00:00Z",
				summary: "summary B",
				calendar_event: { calendar_event_id: "evt_b" },
			},
		};
		const { fetchImpl, calls } = makeFakeFetch((call) => {
			const url = new URL(call.url);
			if (url.pathname === "/v1/notes") return jsonResponse(summaries);
			const match = url.pathname.match(/^\/v1\/notes\/(.+)$/);
			if (match) return jsonResponse(details[match[1]]);
			return new Response("not found", { status: 404 });
		});
		const client = makeClient(fetchImpl);

		const hydrated = await client.listAllHydratedNotesSince(
			new Date("2026-05-01T00:00:00Z"),
		);

		expect(hydrated.map((n) => n.id)).toEqual(["not_1", "not_2"]);
		expect(hydrated.map((n) => n.summary)).toEqual(["summary A", "summary B"]);
		expect(hydrated[0].calendar_event?.calendar_event_id).toBe("evt_a");
		expect(calls).toHaveLength(3);
	});

	it("skips notes whose detail fetch fails", async () => {
		const summaries = {
			notes: [
				{
					id: "not_ok",
					object: "note",
					title: "A",
					owner: { name: "n", email: "n@x" },
					created_at: "2026-05-13T00:00:00Z",
					updated_at: "2026-05-13T00:00:00Z",
				},
				{
					id: "not_fail",
					object: "note",
					title: "B",
					owner: { name: "n", email: "n@x" },
					created_at: "2026-05-14T00:00:00Z",
					updated_at: "2026-05-14T00:00:00Z",
				},
			],
			hasMore: false,
		};
		const { fetchImpl } = makeFakeFetch((call) => {
			const url = new URL(call.url);
			if (url.pathname === "/v1/notes") return jsonResponse(summaries);
			if (url.pathname === "/v1/notes/not_ok") {
				return jsonResponse({
					id: "not_ok",
					object: "note",
					title: "A",
					owner: { name: "n", email: "n@x" },
					created_at: "2026-05-13T00:00:00Z",
					updated_at: "2026-05-13T00:00:00Z",
					summary: "ok",
				});
			}
			return new Response("boom", { status: 500 });
		});
		const client = makeClient(fetchImpl);

		const hydrated = await client.listAllHydratedNotesSince(
			new Date("2026-05-01T00:00:00Z"),
		);

		expect(hydrated.map((n) => n.id)).toEqual(["not_ok"]);
	});
});

describe("GranolaClient.getNote", () => {
	it("appends include=transcript when requested", async () => {
		const detail: GranolaNoteDetail = {
			id: "not_1",
			object: "note",
			title: "Sync",
			owner: { name: "Noah", email: "noah@example.com" },
			created_at: "2026-05-13T15:00:00Z",
			updated_at: "2026-05-13T15:00:00Z",
			summary: "We talked.",
			transcript: [{ speaker: { source: "microphone" }, text: "hi" }],
		};
		const { fetchImpl, calls } = makeFakeFetch(() => jsonResponse(detail));
		const client = makeClient(fetchImpl);

		const result = await client.getNote("not_1", { includeTranscript: true });

		expect(result.summary).toBe("We talked.");
		expect(new URL(calls[0].url).searchParams.get("include")).toBe(
			"transcript",
		);
		expect(new URL(calls[0].url).pathname).toBe("/v1/notes/not_1");
	});
});

describe("GranolaClient.test", () => {
	it("returns ok and a sample count when the API responds", async () => {
		const { fetchImpl } = makeFakeFetch(() =>
			jsonResponse({ notes: [{}, {}], hasMore: false }),
		);
		const client = makeClient(fetchImpl);

		const outcome = await client.test();

		expect(outcome).toEqual({ ok: true, sampleCount: 2 });
	});

	it("returns a structured error on failure", async () => {
		const { fetchImpl } = makeFakeFetch(
			() => new Response("nope", { status: 401, statusText: "Unauthorized" }),
		);
		const client = makeClient(fetchImpl);

		const outcome = await client.test();

		expect(outcome.ok).toBe(false);
		if (!outcome.ok) {
			expect(outcome.error).toContain("401");
		}
	});
});
