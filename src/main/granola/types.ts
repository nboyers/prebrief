export type GranolaNoteSummary = {
	id: string;
	object: "note";
	title: string;
	owner: { name: string; email: string };
	created_at: string;
	updated_at: string;
};

export type GranolaTranscriptSegment = {
	speaker: { source: "microphone" | "system" };
	text: string;
	start_timestamp?: string;
	end_timestamp?: string;
};

export type GranolaNoteDetail = GranolaNoteSummary & {
	summary?: string;
	transcript?: GranolaTranscriptSegment[];
};

export type GranolaListResponse = {
	notes: GranolaNoteSummary[];
	hasMore: boolean;
	cursor?: string;
};

export type GranolaTestResult =
	| { ok: true; sampleCount: number }
	| { ok: false; error: string };
