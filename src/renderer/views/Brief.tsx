import type { Brief as BriefData, UpcomingMeeting } from "../../shared/types";
import { Markdown } from "../components/Markdown";

type Props = {
	meeting: UpcomingMeeting;
	brief: BriefData;
};

export function Brief({ meeting, brief }: Props) {
	return (
		<article className="brief">
			<header className="brief__header">
				<h2 className="brief__title">{meeting.title}</h2>
				<time className="brief__time">{formatTime(meeting.startTime)}</time>
			</header>
			{brief.priorNoteTitle && (
				<p className="brief__prior">
					Last met: <strong>{brief.priorNoteTitle}</strong>
					{brief.priorNoteDate ? ` · ${formatDate(brief.priorNoteDate)}` : null}
				</p>
			)}
			<Markdown source={brief.markdown} />
		</article>
	);
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}
