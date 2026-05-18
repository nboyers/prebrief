export type AppStatus = {
	granolaConnected: boolean;
	googleConnected: boolean;
	llmConfigured: boolean;
};

export type UpcomingMeeting = {
	id: string;
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
	markdown: string;
};

export type BriefState =
	| { kind: "needs-setup"; missing: Array<keyof AppStatus> }
	| { kind: "no-upcoming" }
	| { kind: "loading"; meeting: UpcomingMeeting }
	| { kind: "no-prior-note"; meeting: UpcomingMeeting }
	| { kind: "ready"; meeting: UpcomingMeeting; brief: Brief }
	| { kind: "error"; message: string };
