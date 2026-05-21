import type { BriefState, HomeState, UpcomingMeeting } from "../shared/types";
import { granolaService } from "./granola/service";
import type { GranolaNoteDetail } from "./granola/types";
import { googleService } from "./google/service";
import { llmService } from "./llm/service";
import type { LlmConfig, SummarizerInput } from "./llm/types";
import log from "./log";
import { matchUpcomingMeeting, type MatchResult } from "./matcher";

type HydratedMatch = {
	match: MatchResult;
	detail: GranolaNoteDetail;
};

export type CurrentStatus = {
	granolaConnected: boolean;
	googleConnected: boolean;
	llmConfigured: boolean;
};

const HOME_LOOKAHEAD_DAYS = 7;
const MATCH_LOOKBACK_DAYS = 15;

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

export async function composeHomeState(): Promise<HomeState> {
	const status = currentStatus();
	const missing: Array<keyof CurrentStatus> = [];
	if (!status.granolaConnected) missing.push("granolaConnected");
	if (!status.googleConnected) missing.push("googleConnected");
	if (!status.llmConfigured) missing.push("llmConfigured");
	if (missing.length > 0) return { kind: "needs-setup", missing };

	try {
		const meetings = await googleService.listUpcomingMeetings(
			HOME_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000,
		);
		return { kind: "ready", meetings };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.warn("Failed to list upcoming meetings", err);
		return { kind: "error", message };
	}
}

export async function composeBriefForMeeting(
	meeting: UpcomingMeeting,
): Promise<BriefState> {
	const hydrated = await findPriorNote(meeting);
	if (!hydrated) return { kind: "no-prior-note", meeting };

	const { match, detail } = hydrated;
	const config = llmService.getActiveConfig();
	const cacheKey = briefCacheKey(meeting.id, match.note.id, config);
	const cached = briefCache.get(cacheKey);
	if (cached) return buildReady(meeting, match, cached);

	const input: SummarizerInput = {
		upcoming: {
			title: meeting.title,
			startTime: meeting.startTime,
			attendees: meeting.attendees,
		},
		priorNote: {
			id: match.note.id,
			title: match.note.title,
			createdAt: match.note.created_at,
			summary: detail.summary,
		},
	};

	try {
		const markdown = await llmService.summarize(input);
		briefCache.set(cacheKey, markdown);
		return buildReady(meeting, match, markdown);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.warn("LLM summarize failed", err);
		return { kind: "error", meeting, message };
	}
}

function buildReady(
	meeting: UpcomingMeeting,
	match: MatchResult,
	markdown: string,
): BriefState {
	return {
		kind: "ready",
		meeting,
		brief: {
			eventId: meeting.id,
			priorNoteId: match.note.id,
			priorNoteTitle: match.note.title,
			priorNoteDate: match.note.created_at,
			priorNoteSource: match.source,
			markdown,
		},
	};
}

async function findPriorNote(
	upcoming: UpcomingMeeting,
): Promise<HydratedMatch | null> {
	const client = granolaService.getClient();
	if (!client) return null;
	const startTime = new Date(upcoming.startTime);
	const since = new Date(
		startTime.getTime() - MATCH_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
	);
	try {
		const notes = await client.listAllHydratedNotesSince(since);
		const match = matchUpcomingMeeting(
			{
				title: upcoming.title,
				startTime,
				calendarEventId: upcoming.calendarEventId,
			},
			notes,
		);
		if (!match) return null;
		const detail = notes.find((note) => note.id === match.note.id);
		if (!detail) return null;
		return { match, detail };
	} catch (err) {
		log.warn("Granola fetch for matching failed", err);
		return null;
	}
}
