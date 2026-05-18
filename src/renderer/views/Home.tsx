import type { HomeState, UpcomingMeeting } from "../../shared/types";
import { NeedsSetup } from "./NeedsSetup";

type Props = {
	state: HomeState | null;
	onPrebrief: (meeting: UpcomingMeeting) => void;
	onOpenSettings: () => void;
};

export function Home({ state, onPrebrief, onOpenSettings }: Props) {
	return (
		<div className="popover">
			<header className="popover__header">
				<span className="popover__title">Prebrief</span>
				<div className="popover__actions">
					<button
						className="popover__btn"
						type="button"
						onClick={onOpenSettings}
					>
						Settings
					</button>
					<button
						className="popover__btn"
						type="button"
						onClick={() => window.api.invoke("app:quit", undefined)}
					>
						Quit
					</button>
				</div>
			</header>
			<main className="popover__body">{renderBody(state, onPrebrief)}</main>
		</div>
	);
}

function renderBody(
	state: HomeState | null,
	onPrebrief: (meeting: UpcomingMeeting) => void,
) {
	if (state === null) return <p className="muted">Loading…</p>;
	switch (state.kind) {
		case "needs-setup":
			return <NeedsSetup missing={state.missing} />;
		case "error":
			return (
				<div className="empty">
					<h2 className="empty__title">Couldn't load meetings</h2>
					<p className="empty__subtitle">{state.message}</p>
				</div>
			);
		case "ready":
			if (state.meetings.length === 0) {
				return (
					<div className="empty">
						<h2 className="empty__title">No upcoming meetings this week</h2>
					</div>
				);
			}
			return <MeetingList meetings={state.meetings} onPrebrief={onPrebrief} />;
	}
}

function MeetingList({
	meetings,
	onPrebrief,
}: {
	meetings: UpcomingMeeting[];
	onPrebrief: (meeting: UpcomingMeeting) => void;
}) {
	const groups = groupByDay(meetings);
	return (
		<div className="meeting-list">
			{groups.map((group) => (
				<section key={group.key} className="meeting-group">
					<h3 className="meeting-group__heading">{group.label}</h3>
					<ul className="meeting-group__items">
						{group.meetings.map((meeting) => (
							<li key={meeting.id} className="meeting-row">
								<div className="meeting-row__left">
									<time className="meeting-row__time">
										{formatTime(meeting.startTime)}
									</time>
									<span className="meeting-row__title">{meeting.title}</span>
								</div>
								<button
									className="popover__btn meeting-row__btn"
									type="button"
									onClick={() => onPrebrief(meeting)}
								>
									Prebrief
								</button>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

type Group = {
	key: string;
	label: string;
	meetings: UpcomingMeeting[];
};

function groupByDay(meetings: UpcomingMeeting[]): Group[] {
	const buckets = new Map<string, Group>();
	for (const meeting of meetings) {
		const start = new Date(meeting.startTime);
		const key = dayKey(start);
		const existing = buckets.get(key);
		if (existing) {
			existing.meetings.push(meeting);
		} else {
			buckets.set(key, { key, label: dayLabel(start), meetings: [meeting] });
		}
	}
	return Array.from(buckets.values()).sort((a, b) =>
		a.key.localeCompare(b.key),
	);
}

function dayKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function dayLabel(date: Date): string {
	const today = startOfDay(new Date());
	const target = startOfDay(date);
	const diffDays = Math.round(
		(target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
	);
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Tomorrow";
	if (diffDays > 1 && diffDays < 7) {
		return date.toLocaleDateString(undefined, {
			weekday: "long",
		});
	}
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

function startOfDay(date: Date): Date {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function formatTime(iso: string): string {
	const date = new Date(iso);
	return date.toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}
