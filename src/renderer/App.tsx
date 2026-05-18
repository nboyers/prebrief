import { useCallback, useEffect, useState } from "react";
import type { BriefState, HomeState, UpcomingMeeting } from "../shared/types";
import { BriefView } from "./views/Brief";
import { Home } from "./views/Home";
import { Settings } from "./views/Settings";

type View =
	| { kind: "home" }
	| { kind: "brief"; meeting: UpcomingMeeting }
	| { kind: "settings" };

export function App() {
	const [view, setView] = useState<View>({ kind: "home" });
	const [home, setHome] = useState<HomeState | null>(null);
	const [brief, setBrief] = useState<BriefState | null>(null);

	const refreshHome = useCallback(async () => {
		try {
			const next = await window.api.invoke("app:get-home-state", undefined);
			setHome(next);
		} catch (err) {
			setHome({
				kind: "error",
				message: err instanceof Error ? err.message : String(err),
			});
		}
	}, []);

	useEffect(() => {
		refreshHome();
		const off = window.api.on("home:updated", (next) => setHome(next));
		return off;
	}, [refreshHome]);

	useEffect(() => {
		if (view.kind !== "brief") return;
		setBrief({ kind: "loading", meeting: view.meeting });
		let cancelled = false;
		window.api
			.invoke("app:brief-for-meeting", { meeting: view.meeting })
			.then((next) => {
				if (!cancelled) setBrief(next);
			})
			.catch((err) => {
				if (!cancelled)
					setBrief({
						kind: "error",
						meeting: view.meeting,
						message: err instanceof Error ? err.message : String(err),
					});
			});
		return () => {
			cancelled = true;
		};
	}, [view]);

	function onOpenSettings() {
		setView({ kind: "settings" });
	}
	function onPrebrief(meeting: UpcomingMeeting) {
		setView({ kind: "brief", meeting });
	}
	function onBack() {
		setView({ kind: "home" });
	}

	if (view.kind === "settings") {
		return <Settings onBack={onBack} />;
	}
	if (view.kind === "brief") {
		return (
			<BriefView
				state={brief}
				onBack={onBack}
				onOpenSettings={onOpenSettings}
			/>
		);
	}
	return (
		<Home
			state={home}
			onPrebrief={onPrebrief}
			onOpenSettings={onOpenSettings}
		/>
	);
}
