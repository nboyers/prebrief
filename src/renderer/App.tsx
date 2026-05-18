import { useEffect, useState } from "react";
import type { BriefState } from "../shared/types";
import { Brief } from "./views/Brief";
import { Empty } from "./views/Empty";
import { NeedsSetup } from "./views/NeedsSetup";
import { Settings } from "./views/Settings";

export function App() {
	const [view, setView] = useState<"brief" | "settings">("brief");
	const [state, setState] = useState<BriefState | null>(null);

	useEffect(() => {
		let cancelled = false;
		window.api
			.invoke("app:get-brief-state", undefined)
			.then((next) => {
				if (!cancelled) setState(next);
			})
			.catch(() => {
				if (!cancelled) setState({ kind: "error", message: "Failed to load." });
			});
		const off = window.api.on("brief:updated", (next) => setState(next));
		return () => {
			cancelled = true;
			off();
		};
	}, []);

	if (view === "settings") {
		return <Settings onBack={() => setView("brief")} />;
	}

	return (
		<div className="popover">
			<header className="popover__header">
				<span className="popover__title">Prebrief</span>
				<div className="popover__actions">
					<button
						className="popover__btn"
						type="button"
						onClick={() => setView("settings")}
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
			<main className="popover__body">{renderBody(state)}</main>
		</div>
	);
}

function renderBody(state: BriefState | null) {
	if (state === null) return <div className="muted">Loading…</div>;
	switch (state.kind) {
		case "needs-setup":
			return <NeedsSetup missing={state.missing} />;
		case "no-upcoming":
			return <Empty title="No upcoming meeting" />;
		case "loading":
			return <Empty title={`Briefing ${state.meeting.title}…`} muted />;
		case "no-prior-note":
			return (
				<Empty
					title={state.meeting.title}
					subtitle="No prior meeting found in Granola."
				/>
			);
		case "ready":
			return <Brief meeting={state.meeting} brief={state.brief} />;
		case "error":
			return <Empty title="Something went wrong" subtitle={state.message} />;
	}
}
