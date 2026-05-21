import { describe, expect, it } from "vitest";
import {
	calendarEventBaseId,
	jaccardSimilarity,
	matchUpcomingMeeting,
	normalizeTitle,
	titleTokens,
} from "../../../src/main/matcher";
import type { GranolaNoteSummary } from "../../../src/main/granola/types";

function note(
	id: string,
	title: string,
	createdAt: string,
	calendarEventId?: string,
): GranolaNoteSummary {
	return {
		id,
		object: "note",
		title,
		owner: { name: "Noah", email: "noah@example.com" },
		created_at: createdAt,
		updated_at: createdAt,
		calendar_event: calendarEventId
			? { calendar_event_id: calendarEventId }
			: undefined,
	};
}

describe("normalizeTitle", () => {
	it("lowercases and collapses whitespace", () => {
		expect(normalizeTitle("  Coder Sync  ")).toBe("coder sync");
	});

	it("strips punctuation including angle brackets and pipes", () => {
		expect(normalizeTitle("Coder <> Altana.ai - Onboarding")).toBe(
			"coder altana ai - onboarding",
		);
	});

	it("normalizes em and en dashes to hyphen", () => {
		expect(normalizeTitle("Sprint \u2014 Review")).toBe("sprint - review");
		expect(normalizeTitle("Sprint \u2013 Review")).toBe("sprint - review");
	});
});

describe("titleTokens", () => {
	it("drops short tokens and common stop words", () => {
		expect(Array.from(titleTokens("FW: Daily Sync with Coder")).sort()).toEqual(
			["coder", "daily", "fw", "sync"],
		);
	});

	it("returns an empty set for whitespace-only titles", () => {
		expect(titleTokens("   ").size).toBe(0);
	});
});

describe("jaccardSimilarity", () => {
	it("returns 1 for identical sets", () => {
		const a = new Set(["a", "b", "c"]);
		expect(jaccardSimilarity(a, a)).toBe(1);
	});

	it("returns 0 for disjoint sets", () => {
		expect(jaccardSimilarity(new Set(["a"]), new Set(["b", "c"]))).toBe(0);
	});

	it("treats two empty sets as 0", () => {
		expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
	});
});

describe("matchUpcomingMeeting", () => {
	const upcomingStart = new Date("2026-05-20T15:00:00Z");

	it("returns the only candidate inside the lookback window", () => {
		const notes = [
			note("a", "Coder Sync", "2026-05-13T15:00:00Z"), // 7 days back
		];
		const result = matchUpcomingMeeting(
			{ title: "Coder Sync", startTime: upcomingStart },
			notes,
		);
		expect(result?.note.id).toBe("a");
		expect(result?.confidence).toBeGreaterThan(1);
	});

	it("excludes candidates outside the window (too old)", () => {
		const notes = [
			note("a", "Coder Sync", "2026-05-01T15:00:00Z"), // 19 days back
		];
		expect(
			matchUpcomingMeeting(
				{ title: "Coder Sync", startTime: upcomingStart },
				notes,
			),
		).toBeNull();
	});

	it("excludes candidates inside the exclude-recent window", () => {
		const notes = [
			note("a", "Coder Sync", "2026-05-20T14:30:00Z"), // 30 min ago
		];
		expect(
			matchUpcomingMeeting(
				{ title: "Coder Sync", startTime: upcomingStart },
				notes,
			),
		).toBeNull();
	});

	it("prefers the candidate closest to 7 days before the meeting", () => {
		const notes = [
			note("a", "Coder Sync", "2026-05-13T15:00:00Z"), // 7d ago
			note("b", "Coder Sync", "2026-05-15T15:00:00Z"), // 5d ago
		];
		const result = matchUpcomingMeeting(
			{ title: "Coder Sync", startTime: upcomingStart },
			notes,
		);
		expect(result?.note.id).toBe("a");
	});

	it("requires the similarity threshold", () => {
		const notes = [note("a", "Quarterly Budget Review", "2026-05-13T15:00:00Z")];
		expect(
			matchUpcomingMeeting(
				{ title: "Coder Sync", startTime: upcomingStart },
				notes,
			),
		).toBeNull();
	});

	it("returns null when the upcoming title has no usable tokens", () => {
		const notes = [note("a", "Coder Sync", "2026-05-13T15:00:00Z")];
		expect(
			matchUpcomingMeeting({ title: "the", startTime: upcomingStart }, notes),
		).toBeNull();
	});

	it("does not cross-match loose title variants under strict matching", () => {
		// 'Coder <> Regions - Kickoff call' shares only the token 'regions' with
		// 'Regions Bank Sync', which is below the default similarity threshold.
		// Variant-matching is opt-in via a future setting.
		const notes = [note("a", "Regions Bank Sync", "2026-05-13T15:00:00Z")];
		const result = matchUpcomingMeeting(
			{
				title: "Coder <> Regions - Kickoff call",
				startTime: upcomingStart,
			},
			notes,
		);
		expect(result).toBeNull();
	});

	it("matches a candidate roughly 14 days before the meeting (biweekly)", () => {
		const notes = [
			note("a", "Coder Sync", "2026-05-06T15:00:00Z"), // 14d back
		];
		const result = matchUpcomingMeeting(
			{ title: "Coder Sync", startTime: upcomingStart },
			notes,
		);
		expect(result?.note.id).toBe("a");
		expect(result?.confidence).toBeGreaterThan(1);
	});

	it("gives equal recurrence bonus at 7 and 14 days back", () => {
		const weekly = matchUpcomingMeeting(
			{ title: "Coder Sync", startTime: upcomingStart },
			[note("a", "Coder Sync", "2026-05-13T15:00:00Z")], // 7d
		);
		const biweekly = matchUpcomingMeeting(
			{ title: "Coder Sync", startTime: upcomingStart },
			[note("b", "Coder Sync", "2026-05-06T15:00:00Z")], // 14d
		);
		expect(weekly?.confidence).toBeCloseTo(biweekly?.confidence ?? 0, 5);
	});

	it("reports source: title for title-based matches", () => {
		const notes = [note("a", "Coder Sync", "2026-05-13T15:00:00Z")];
		const result = matchUpcomingMeeting(
			{ title: "Coder Sync", startTime: upcomingStart },
			notes,
		);
		expect(result?.source).toBe("title");
	});
});

describe("calendarEventBaseId", () => {
	it("strips the recurrence-instance timestamp suffix", () => {
		expect(calendarEventBaseId("abc123def456_20260520T150000Z")).toBe(
			"abc123def456",
		);
	});

	it("returns the id unchanged when no suffix is present", () => {
		expect(calendarEventBaseId("abc123def456")).toBe("abc123def456");
	});

	it("only strips a trailing suffix, not embedded patterns", () => {
		expect(calendarEventBaseId("abc_20260101T000000Z_extra")).toBe(
			"abc_20260101T000000Z_extra",
		);
	});
});

describe("matchUpcomingMeeting calendar pass", () => {
	const upcomingStart = new Date("2026-05-20T15:00:00Z");
	const upcomingEventId = "recurring123_20260520T150000Z";

	it("matches by calendar event id when titles disagree", () => {
		const notes = [
			note(
				"a",
				"Regions Bank Sync",
				"2026-05-13T15:00:00Z",
				"recurring123_20260513T150000Z",
			),
		];
		const result = matchUpcomingMeeting(
			{
				title: "FW: Daily Sync Coder",
				startTime: upcomingStart,
				calendarEventId: upcomingEventId,
			},
			notes,
		);
		expect(result?.note.id).toBe("a");
		expect(result?.source).toBe("calendar");
		expect(result?.confidence).toBe(2);
	});

	it("prefers a calendar-linked note over a title-matched one", () => {
		const notes = [
			note("title", "FW: Daily Sync Coder", "2026-05-13T15:00:00Z"),
			note(
				"calendar",
				"Regions Bank Sync",
				"2026-05-13T15:00:00Z",
				"recurring123_20260513T150000Z",
			),
		];
		const result = matchUpcomingMeeting(
			{
				title: "FW: Daily Sync Coder",
				startTime: upcomingStart,
				calendarEventId: upcomingEventId,
			},
			notes,
		);
		expect(result?.note.id).toBe("calendar");
		expect(result?.source).toBe("calendar");
	});

	it("picks the most recent of multiple calendar-linked notes", () => {
		const notes = [
			note(
				"older",
				"Sync",
				"2026-05-06T15:00:00Z",
				"recurring123_20260506T150000Z",
			),
			note(
				"newer",
				"Sync",
				"2026-05-13T15:00:00Z",
				"recurring123_20260513T150000Z",
			),
		];
		const result = matchUpcomingMeeting(
			{
				title: "Sync",
				startTime: upcomingStart,
				calendarEventId: upcomingEventId,
			},
			notes,
		);
		expect(result?.note.id).toBe("newer");
	});

	it("ignores calendar-linked notes whose base id differs", () => {
		const notes = [
			note(
				"a",
				"FW: Daily Sync Coder",
				"2026-05-13T15:00:00Z",
				"different456_20260513T150000Z",
			),
		];
		const result = matchUpcomingMeeting(
			{
				title: "FW: Daily Sync Coder",
				startTime: upcomingStart,
				calendarEventId: upcomingEventId,
			},
			notes,
		);
		expect(result?.note.id).toBe("a");
		expect(result?.source).toBe("title");
	});

	it("ignores calendar-linked notes outside the lookback window", () => {
		const notes = [
			note(
				"a",
				"Regions Bank Sync",
				"2026-05-01T15:00:00Z", // 19 days back
				"recurring123_20260501T150000Z",
			),
		];
		const result = matchUpcomingMeeting(
			{
				title: "FW: Daily Sync Coder",
				startTime: upcomingStart,
				calendarEventId: upcomingEventId,
			},
			notes,
		);
		expect(result).toBeNull();
	});

	it("falls back to title matching when no upcoming calendar id is provided", () => {
		const notes = [
			note(
				"a",
				"Coder Sync",
				"2026-05-13T15:00:00Z",
				"recurring123_20260513T150000Z",
			),
		];
		const result = matchUpcomingMeeting(
			{ title: "Coder Sync", startTime: upcomingStart },
			notes,
		);
		expect(result?.note.id).toBe("a");
		expect(result?.source).toBe("title");
	});
});
