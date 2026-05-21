import type { GranolaNoteDetail } from "./types";

export function pickNoteContent(detail: GranolaNoteDetail): string | undefined {
	const markdown = detail.summary?.trim();
	if (markdown) return markdown;
	const plain = detail.summary_text?.trim();
	if (plain) return plain;
	return undefined;
}
