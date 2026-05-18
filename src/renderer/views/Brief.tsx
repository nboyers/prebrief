import type { BriefState } from "../../shared/types";
import { Markdown } from "../components/Markdown";

type Props = {
	state: BriefState | null;
	onBack: () => void;
	onOpenSettings: () => void;
};

export function BriefView({ state, onBack, onOpenSettings }: Props) {
	const meeting = state && "meeting" in state ? state.meeting : null;
	return (
		<div className="popover">
			<header className="popover__header">
				<div className="popover__title popover__title--with-back">
					<button className="popover__btn" type="button" onClick={onBack}>
						◀ Back
					</button>
					<span>Prebrief</span>
				</div>
				<div className="popover__actions">
					<button
						className="popover__btn"
						type="button"
						onClick={onOpenSettings}
					>
						Settings
					</button>
				</div>
			</header>
			<main className="popover__body">
				{meeting && (
					<header className="brief__meeting">
						<h2 className="brief__title">{meeting.title}</h2>
						<time className="brief__time">
							{formatDay(meeting.startTime)} · {formatTime(meeting.startTime)}
						</time>
					</header>
				)}
				{renderBody(state)}
			</main>
		</div>
	);
}

function renderBody(state: BriefState | null) {
	if (state === null) return <p className="muted">Loading…</p>;
	switch (state.kind) {
		case "loading":
			return <p className="muted">Generating brief…</p>;
		case "no-prior-note":
			return (
				<div className="empty">
					<h3 className="empty__title">No prior meeting found</h3>
					<p className="empty__subtitle">
						No Granola note from the past week matches this meeting's title.
					</p>
				</div>
			);
		case "ready":
			return (
				<article className="brief">
					{state.brief.priorNoteTitle && (
						<p className="brief__prior">
							Last met: <strong>{state.brief.priorNoteTitle}</strong>
							{state.brief.priorNoteDate
								? ` · ${formatDate(state.brief.priorNoteDate)}`
								: null}
						</p>
					)}
					<Markdown source={state.brief.markdown} />
				</article>
			);
		case "error":
			return (
				<div className="empty">
					<h3 className="empty__title">Brief failed</h3>
					<p className="empty__subtitle">{state.message}</p>
				</div>
			);
	}
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}

function formatDay(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}
