import type { BriefState, UpcomingMeeting } from "../shared/types";
import { granolaService } from "./granola/service";
import type { GranolaNoteDetail } from "./granola/types";
import { googleService } from "./google/service";
import { llmService } from "./llm/service";
import type { LlmConfig, SummarizerInput } from "./llm/types";
import log from "./log";
import { matchUpcomingMeeting, type MatchResult } from "./matcher";

export type CurrentStatus = {
	granolaConnected: boolean;
	googleConnected: boolean;
	llmConfigured: boolean;
};

export function currentStatus(): CurrentStatus {
	return {
		granolaConnected: granolaService.hasApiKey(),
		googleConnected: googleService.hasSession(),
		llmConfigured: llmService.hasActiveKey(),
	};
}

const briefCache = new Map<string, string>();

function briefCacheKey(
	eventId: string,
	noteId: string,
	config: LlmConfig,
): string {
	return `${config.provider}|${config.model}|${eventId}|${noteId}`;
}

export function clearBriefCache(): void {
	briefCache.clear();
}

export async function composeBriefState(): Promise<BriefState> {
	const status = currentStatus();
	const missing: Array<keyof CurrentStatus> = [];
	if (!status.granolaConnected) missing.push("granolaConnected");
	if (!status.googleConnected) missing.push("googleConnected");
	if (!status.llmConfigured) missing.push("llmConfigured");
	if (missing.length > 0) return { kind: "needs-setup", missing };

	let upcoming: UpcomingMeeting | null;
	try {
		upcoming = await googleService.getNextUpcoming();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.warn("Failed to fetch upcoming meeting", err);
		return { kind: "error", message };
	}
	if (!upcoming) return { kind: "no-upcoming" };

	const match = await findPriorNote(upcoming);
	if (!match) return { kind: "no-prior-note", meeting: upcoming };

	const config = llmService.getActiveConfig();
	const cacheKey = briefCacheKey(upcoming.id, match.note.id, config);
	const cached = briefCache.get(cacheKey);
	if (cached) {
		return buildReady(upcoming, match, cached);
	}

	const detail = await fetchPriorNoteDetail(match.note.id);
	const input: SummarizerInput = {
		upcoming: {
			title: upcoming.title,
			startTime: upcoming.startTime,
			attendees: upcoming.attendees,
		},
		priorNote: {
			id: match.note.id,
			title: match.note.title,
			createdAt: match.note.created_at,
			summary: detail?.summary,
		},
	};

	let markdown: string;
	try {
		markdown = await llmService.summarize(input);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.warn("LLM summarize failed", err);
		return { kind: "error", message };
	}

	briefCache.set(cacheKey, markdown);
	return buildReady(upcoming, match, markdown);
}

function buildReady(
	upcoming: UpcomingMeeting,
	match: MatchResult,
	markdown: string,
): BriefState {
	return {
		kind: "ready",
		meeting: upcoming,
		brief: {
			eventId: upcoming.id,
			priorNoteId: match.note.id,
			priorNoteTitle: match.note.title,
			priorNoteDate: match.note.created_at,
			markdown,
		},
	};
}

async function findPriorNote(
	upcoming: UpcomingMeeting,
): Promise<MatchResult | null> {
	const client = granolaService.getClient();
	if (!client) return null;
	const startTime = new Date(upcoming.startTime);
	const since = new Date(startTime.getTime() - 8 * 24 * 60 * 60 * 1000);
	try {
		const notes = await client.listAllNotesSince(since);
		return matchUpcomingMeeting({ title: upcoming.title, startTime }, notes);
	} catch (err) {
		log.warn("Granola fetch for matching failed", err);
		return null;
	}
}

async function fetchPriorNoteDetail(
	id: string,
): Promise<GranolaNoteDetail | null> {
	const client = granolaService.getClient();
	if (!client) return null;
	try {
		return await client.getNote(id);
	} catch (err) {
		log.warn("Granola getNote failed", err);
		return null;
	}
}
