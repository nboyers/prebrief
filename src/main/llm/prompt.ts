import type { SummarizerInput } from "./types";

export const SYSTEM_PROMPT = `You write meeting pre-briefings. The user has an upcoming meeting and you have notes from the previous instance of the same recurring meeting. Be terse and concrete. No filler, no prelude, no closing remarks.

Output exactly this Markdown structure, in this order:

**Last time**
- ...
- ...

**Open threads**
- ...
- ...

**Heads-up**
- ...
- ...

Rules:
- Each section: 1 to 3 short bullets. Never more than 3.
- If a section has nothing real to say, write the single bullet "- (none)".
- Bullets are concrete: who, what, decisions, action items, blockers, follow-ups.
- Do not invent details that are not in the prior notes.
- Do not include any text outside the three sections above.`;

const MAX_NOTE_CHARS = 6000;

export function buildUserPrompt(input: SummarizerInput): string {
	const { upcoming, priorNote } = input;
	const attendees =
		upcoming.attendees.length > 0
			? upcoming.attendees.join(", ")
			: "(not provided)";
	const description = upcoming.description?.trim();
	const priorBody = (priorNote.summary ?? "").trim();
	const truncatedBody =
		priorBody.length > MAX_NOTE_CHARS
			? `${priorBody.slice(0, MAX_NOTE_CHARS)}\n…(truncated)`
			: priorBody;

	const lines = [
		"# Upcoming meeting",
		`- Title: ${upcoming.title}`,
		`- When: ${formatDateTime(upcoming.startTime)}`,
		`- Attendees: ${attendees}`,
	];
	if (description) {
		lines.push(`- Description: ${oneLine(description)}`);
	}
	lines.push("");
	lines.push("# Previous instance");
	lines.push(`- Title: ${priorNote.title}`);
	lines.push(`- Date: ${formatDateTime(priorNote.createdAt)}`);
	lines.push("");
	if (truncatedBody) {
		lines.push("## Notes from last time");
		lines.push(truncatedBody);
	} else {
		lines.push("(No notes were captured for the previous meeting.)");
	}

	return lines.join("\n");
}

function formatDateTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toISOString();
}

function oneLine(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}
