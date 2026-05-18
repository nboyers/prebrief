import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT, buildUserPrompt } from "../../../../src/main/llm/prompt";
import type { SummarizerInput } from "../../../../src/main/llm/types";

const baseInput: SummarizerInput = {
	upcoming: {
		title: "Coder <> Altana - Onboarding",
		startTime: "2026-05-20T15:00:00Z",
		attendees: ["Alice", "Bob"],
	},
	priorNote: {
		id: "not_x",
		title: "Coder <> Altana - Onboarding",
		createdAt: "2026-05-13T15:00:00Z",
		summary: "Discussed phase 1 rollout. Open question on SSO timing.",
	},
};

describe("SYSTEM_PROMPT", () => {
	it("enforces the three required sections", () => {
		expect(SYSTEM_PROMPT).toContain("**Last time**");
		expect(SYSTEM_PROMPT).toContain("**Open threads**");
		expect(SYSTEM_PROMPT).toContain("**Heads-up**");
	});

	it("forbids invented details", () => {
		expect(SYSTEM_PROMPT.toLowerCase()).toContain("do not invent");
	});
});

describe("buildUserPrompt", () => {
	it("includes upcoming meeting context", () => {
		const text = buildUserPrompt(baseInput);
		expect(text).toContain("Title: Coder <> Altana - Onboarding");
		expect(text).toContain("Attendees: Alice, Bob");
	});

	it("includes the prior note summary verbatim", () => {
		const text = buildUserPrompt(baseInput);
		expect(text).toContain("Open question on SSO timing.");
	});

	it("emits a placeholder when no prior summary exists", () => {
		const text = buildUserPrompt({
			...baseInput,
			priorNote: { ...baseInput.priorNote, summary: undefined },
		});
		expect(text).toContain("No notes were captured for the previous meeting.");
	});

	it("truncates very long summaries to keep token budgets predictable", () => {
		const huge = "x".repeat(20_000);
		const text = buildUserPrompt({
			...baseInput,
			priorNote: { ...baseInput.priorNote, summary: huge },
		});
		expect(text).toContain("…(truncated)");
		expect(text.length).toBeLessThan(huge.length);
	});

	it("falls back to '(not provided)' when no attendees are known", () => {
		const text = buildUserPrompt({
			...baseInput,
			upcoming: { ...baseInput.upcoming, attendees: [] },
		});
		expect(text).toContain("Attendees: (not provided)");
	});
});
