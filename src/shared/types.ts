export type AppStatus = {
	granolaConnected: boolean;
	googleConnected: boolean;
	llmConfigured: boolean;
};

export type GranolaTestOutcome =
	| { ok: true; sampleCount: number }
	| { ok: false; error: string };

export type GoogleSignInOutcome = { ok: true } | { ok: false; error: string };

export type GoogleTestOutcome =
	| { ok: true; sampleEvent?: { title: string; startTime: string } }
	| { ok: false; error: string };

export type GoogleStatus = {
	hasClient: boolean;
	hasSession: boolean;
};

export type LlmProvider = "anthropic" | "openai";

export type LlmStatus = {
	activeProvider: LlmProvider;
	hasAnthropicKey: boolean;
	hasOpenAiKey: boolean;
	anthropicModel: string;
	openaiModel: string;
};

export type LlmTestOutcome =
	| { ok: true; model: string }
	| { ok: false; error: string };

export type UpcomingMeeting = {
	id: string;
	calendarEventId: string;
	title: string;
	startTime: string;
	endTime: string;
	attendees: string[];
};

export type Brief = {
	eventId: string;
	priorNoteId: string | null;
	priorNoteTitle: string | null;
	priorNoteDate: string | null;
	priorNoteSource: "calendar" | "title" | null;
	markdown: string;
};

export type HomeState =
	| { kind: "needs-setup"; missing: Array<keyof AppStatus> }
	| { kind: "ready"; meetings: UpcomingMeeting[] }
	| { kind: "error"; message: string };

export type BriefState =
	| { kind: "loading"; meeting: UpcomingMeeting }
	| { kind: "no-prior-note"; meeting: UpcomingMeeting }
	| { kind: "ready"; meeting: UpcomingMeeting; brief: Brief }
	| { kind: "error"; meeting: UpcomingMeeting; message: string };
