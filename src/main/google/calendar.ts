import type { UpcomingMeeting } from "../../shared/types";

export type CalendarEventTime = {
	dateTime?: string;
	date?: string;
	timeZone?: string;
};

export type CalendarAttendee = {
	email: string;
	displayName?: string;
	self?: boolean;
	responseStatus?: string;
};

export type CalendarEvent = {
	id: string;
	summary?: string;
	start: CalendarEventTime;
	end: CalendarEventTime;
	attendees?: CalendarAttendee[];
	hangoutLink?: string;
	location?: string;
	description?: string;
	status?: string;
};

export type CalendarEventsResponse = {
	items: CalendarEvent[];
	nextPageToken?: string;
};

export type GoogleAccessTokenProvider = () => Promise<string>;

const DEFAULT_BASE_URL = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: string,
	) {
		super(`Calendar API error: HTTP ${status}: ${body}`);
		this.name = "GoogleCalendarError";
	}
}

export type ListEventsOptions = {
	calendarId?: string;
	timeMin: Date;
	timeMax: Date;
	maxResults?: number;
};

export type GoogleCalendarClientOptions = {
	getAccessToken: GoogleAccessTokenProvider;
	fetchImpl?: typeof fetch;
	baseUrl?: string;
};

export class GoogleCalendarClient {
	private readonly getAccessToken: GoogleAccessTokenProvider;
	private readonly fetchImpl: typeof fetch;
	private readonly baseUrl: string;

	constructor(options: GoogleCalendarClientOptions) {
		this.getAccessToken = options.getAccessToken;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
	}

	async listEvents(options: ListEventsOptions): Promise<CalendarEvent[]> {
		const calendarId = options.calendarId ?? "primary";
		const params = new URLSearchParams({
			timeMin: options.timeMin.toISOString(),
			timeMax: options.timeMax.toISOString(),
			singleEvents: "true",
			orderBy: "startTime",
			maxResults: String(options.maxResults ?? 50),
		});
		const path = `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
		const accessToken = await this.getAccessToken();
		const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
		});
		if (!response.ok) {
			const body = await safeReadText(response);
			throw new GoogleCalendarError(response.status, body);
		}
		const data = (await response.json()) as CalendarEventsResponse;
		return data.items ?? [];
	}
}

export function toUpcomingMeeting(
	event: CalendarEvent,
): UpcomingMeeting | null {
	if (event.status === "cancelled") return null;
	const startTime = event.start.dateTime ?? event.start.date;
	const endTime = event.end.dateTime ?? event.end.date;
	if (!startTime || !endTime) return null;
	return {
		id: event.id,
		calendarEventId: event.id,
		title: event.summary ?? "(no title)",
		startTime,
		endTime,
		attendees: (event.attendees ?? [])
			.filter((attendee) => !attendee.self)
			.map((attendee) => attendee.displayName ?? attendee.email)
			.filter((label): label is string => typeof label === "string"),
	};
}

async function safeReadText(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch {
		return "";
	}
}
