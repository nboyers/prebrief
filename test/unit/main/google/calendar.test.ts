import { describe, expect, it } from "vitest";
import {
	GoogleCalendarClient,
	GoogleCalendarError,
	toUpcomingMeeting,
	type CalendarEvent,
} from "../../../../src/main/google/calendar";

function fakeFetch(handler: (url: string) => Response | Promise<Response>) {
	const calls: string[] = [];
	const fetchImpl: typeof fetch = async (input) => {
		const url = typeof input === "string" ? input : (input as URL).toString();
		calls.push(url);
		return handler(url);
	};
	return { fetchImpl, calls };
}

describe("GoogleCalendarClient.listEvents", () => {
	it("builds the primary-calendar URL with time bounds and singleEvents=true", async () => {
		const { fetchImpl, calls } = fakeFetch(() =>
			new Response(JSON.stringify({ items: [] }), { status: 200 }),
		);
		const client = new GoogleCalendarClient({
			getAccessToken: async () => "token",
			fetchImpl,
		});

		await client.listEvents({
			timeMin: new Date("2026-05-20T15:00:00Z"),
			timeMax: new Date("2026-05-20T16:00:00Z"),
		});

		const url = new URL(calls[0]);
		expect(url.pathname).toBe("/calendar/v3/calendars/primary/events");
		expect(url.searchParams.get("singleEvents")).toBe("true");
		expect(url.searchParams.get("orderBy")).toBe("startTime");
		expect(url.searchParams.get("timeMin")).toBe("2026-05-20T15:00:00.000Z");
		expect(url.searchParams.get("timeMax")).toBe("2026-05-20T16:00:00.000Z");
	});

	it("sends the bearer token returned by the provider", async () => {
		let authHeader: string | undefined;
		const fetchImpl: typeof fetch = async (_input, init) => {
			authHeader = (init?.headers as Record<string, string>).Authorization;
			return new Response(JSON.stringify({ items: [] }), { status: 200 });
		};
		const client = new GoogleCalendarClient({
			getAccessToken: async () => "abc123",
			fetchImpl,
		});

		await client.listEvents({
			timeMin: new Date(),
			timeMax: new Date(),
		});

		expect(authHeader).toBe("Bearer abc123");
	});

	it("throws GoogleCalendarError on non-2xx", async () => {
		const { fetchImpl } = fakeFetch(
			() => new Response("nope", { status: 403 }),
		);
		const client = new GoogleCalendarClient({
			getAccessToken: async () => "t",
			fetchImpl,
		});

		await expect(
			client.listEvents({ timeMin: new Date(), timeMax: new Date() }),
		).rejects.toBeInstanceOf(GoogleCalendarError);
	});

	it("returns an empty array when items is missing", async () => {
		const { fetchImpl } = fakeFetch(
			() => new Response(JSON.stringify({}), { status: 200 }),
		);
		const client = new GoogleCalendarClient({
			getAccessToken: async () => "t",
			fetchImpl,
		});

		const events = await client.listEvents({
			timeMin: new Date(),
			timeMax: new Date(),
		});

		expect(events).toEqual([]);
	});
});

describe("toUpcomingMeeting", () => {
	const baseEvent: CalendarEvent = {
		id: "abc",
		summary: "Standup",
		start: { dateTime: "2026-05-20T15:00:00Z" },
		end: { dateTime: "2026-05-20T15:30:00Z" },
		attendees: [
			{ email: "noah@example.com", displayName: "Noah", self: true },
			{ email: "alice@example.com", displayName: "Alice" },
			{ email: "bob@example.com" },
		],
	};

	it("normalizes a Calendar event into an UpcomingMeeting", () => {
		const result = toUpcomingMeeting(baseEvent);
		expect(result).toEqual({
			id: "abc",
			title: "Standup",
			startTime: "2026-05-20T15:00:00Z",
			endTime: "2026-05-20T15:30:00Z",
			attendees: ["Alice", "bob@example.com"],
		});
	});

	it("uses (no title) when summary is missing", () => {
		const result = toUpcomingMeeting({ ...baseEvent, summary: undefined });
		expect(result?.title).toBe("(no title)");
	});

	it("supports all-day events with date-only fields", () => {
		const result = toUpcomingMeeting({
			...baseEvent,
			start: { date: "2026-05-20" },
			end: { date: "2026-05-21" },
		});
		expect(result?.startTime).toBe("2026-05-20");
		expect(result?.endTime).toBe("2026-05-21");
	});

	it("returns null for cancelled events", () => {
		expect(toUpcomingMeeting({ ...baseEvent, status: "cancelled" })).toBeNull();
	});

	it("returns null when start or end times are missing", () => {
		expect(
			toUpcomingMeeting({ ...baseEvent, start: {} as CalendarEvent["start"] }),
		).toBeNull();
	});
});
