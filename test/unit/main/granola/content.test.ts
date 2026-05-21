import { describe, expect, it } from "vitest";
import { pickNoteContent } from "../../../../src/main/granola/content";
import type { GranolaNoteDetail } from "../../../../src/main/granola/types";

function makeDetail(
	overrides: Partial<GranolaNoteDetail> = {},
): GranolaNoteDetail {
	return {
		id: "not_1",
		object: "note",
		title: "Sync",
		owner: { name: "Noah", email: "noah@example.com" },
		created_at: "2026-05-20T15:00:00Z",
		updated_at: "2026-05-20T15:00:00Z",
		...overrides,
	};
}

describe("pickNoteContent", () => {
	it("prefers the markdown summary when both fields are present", () => {
		const detail = makeDetail({
			summary: "## Heading\n\n- one\n- two",
			summary_text: "Plain text version.",
		});
		expect(pickNoteContent(detail)).toBe("## Heading\n\n- one\n- two");
	});

	it("falls back to summary_text when summary is null", () => {
		const detail = makeDetail({
			summary: null,
			summary_text: "Plain text version.",
		});
		expect(pickNoteContent(detail)).toBe("Plain text version.");
	});

	it("falls back to summary_text when summary is an empty string", () => {
		const detail = makeDetail({
			summary: "   ",
			summary_text: "Plain text version.",
		});
		expect(pickNoteContent(detail)).toBe("Plain text version.");
	});

	it("returns undefined when neither field has content", () => {
		const detail = makeDetail({ summary: null, summary_text: "" });
		expect(pickNoteContent(detail)).toBeUndefined();
	});

	it("trims surrounding whitespace from the chosen field", () => {
		const detail = makeDetail({ summary: "\n\n## Heading\n\nBody\n\n" });
		expect(pickNoteContent(detail)).toBe("## Heading\n\nBody");
	});
});
