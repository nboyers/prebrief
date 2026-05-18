import type { BriefState, UpcomingMeeting } from "../shared/types";
import { granolaService } from "./granola/service";
import { googleService } from "./google/service";
import log from "./log";
import { matchUpcomingMeeting } from "./matcher";

export type CurrentStatus = {
	granolaConnected: boolean;
	googleConnected: boolean;
	llmConfigured: boolean;
};

export function currentStatus(): CurrentStatus {
	return {
		granolaConnected: granolaService.hasApiKey(),
		googleConnected: googleService.hasSession(),
		llmConfigured: false,
	};
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

	const matched = await findPriorNote(upcoming);
	if (!matched) return { kind: "no-prior-note", meeting: upcoming };

	return {
		kind: "ready",
		meeting: upcoming,
		brief: {
			eventId: upcoming.id,
			priorNoteId: matched.note.id,
			priorNoteTitle: matched.note.title,
			priorNoteDate: matched.note.created_at,
			markdown:
				"_LLM summary lands in M4. For now, this is the matched prior note._",
		},
	};
}

async function findPriorNote(upcoming: UpcomingMeeting) {
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
