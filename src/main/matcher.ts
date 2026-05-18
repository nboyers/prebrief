import type { GranolaNoteSummary } from "./granola/types";

export type UpcomingCandidate = {
	title: string;
	startTime: Date;
};

export type MatchResult = {
	note: GranolaNoteSummary;
	confidence: number;
};

export type MatchOptions = {
	minSimilarity?: number;
	lookbackDays?: number;
	excludeRecentHours?: number;
};

const DEFAULT_MIN_SIMILARITY = 0.5;
const DEFAULT_LOOKBACK_DAYS = 15;
const DEFAULT_EXCLUDE_RECENT_HOURS = 1;
const RECURRENCE_PERIOD_DAYS = 7;
const RECURRENCE_BONUS_PER_DAY_OFFSET = 0.04;
const MAX_RECURRENCE_BONUS = 0.15;

const PUNCTUATION = /[<>|:;,./\\()[\]"'`~!?@#$%^&*+={}]/g;
const DASHES = /[\u2013\u2014]/g;

export function normalizeTitle(raw: string): string {
	return raw
		.toLowerCase()
		.replace(DASHES, "-")
		.replace(PUNCTUATION, " ")
		.replace(/\s+/g, " ")
		.trim();
}

const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"of",
	"the",
	"to",
	"vs",
	"w",
	"with",
]);

export function titleTokens(raw: string): Set<string> {
	const tokens = normalizeTitle(raw)
		.split(" ")
		.filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
	return new Set(tokens);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 0;
	let intersection = 0;
	for (const token of a) {
		if (b.has(token)) intersection += 1;
	}
	const union = a.size + b.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

export function matchUpcomingMeeting(
	upcoming: UpcomingCandidate,
	notes: readonly GranolaNoteSummary[],
	options: MatchOptions = {},
): MatchResult | null {
	const minSimilarity = options.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
	const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
	const excludeRecentHours =
		options.excludeRecentHours ?? DEFAULT_EXCLUDE_RECENT_HOURS;

	const windowStart =
		upcoming.startTime.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
	const windowEnd =
		upcoming.startTime.getTime() - excludeRecentHours * 60 * 60 * 1000;
	const upcomingTokens = titleTokens(upcoming.title);
	if (upcomingTokens.size === 0) return null;

	let best: MatchResult | null = null;
	for (const note of notes) {
		const createdAtMs = Date.parse(note.created_at);
		if (Number.isNaN(createdAtMs)) continue;
		if (createdAtMs < windowStart || createdAtMs > windowEnd) continue;

		const similarity = jaccardSimilarity(
			upcomingTokens,
			titleTokens(note.title),
		);
		if (similarity < minSimilarity) continue;

		const daysAgo =
			(upcoming.startTime.getTime() - createdAtMs) / (24 * 60 * 60 * 1000);
		const offsetFromPeriod = Math.abs(
			daysAgo - Math.round(daysAgo / RECURRENCE_PERIOD_DAYS) * RECURRENCE_PERIOD_DAYS,
		);
		const recurrenceBonus = Math.max(
			0,
			MAX_RECURRENCE_BONUS - offsetFromPeriod * RECURRENCE_BONUS_PER_DAY_OFFSET,
		);
		const confidence = similarity + recurrenceBonus;

		if (best === null || confidence > best.confidence) {
			best = { note, confidence };
		}
	}
	return best;
}
