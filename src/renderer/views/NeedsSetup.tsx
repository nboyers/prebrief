import type { AppStatus } from "../../shared/types";

const labels: Record<keyof AppStatus, string> = {
	granolaConnected: "Connect Granola",
	googleConnected: "Connect Google Calendar",
	llmConfigured: "Add an LLM API key",
};

type Props = {
	missing: Array<keyof AppStatus>;
};

export function NeedsSetup({ missing }: Props) {
	return (
		<div className="setup">
			<h2 className="setup__title">Almost ready</h2>
			<p className="muted">Finish these to start getting briefs:</p>
			<ul className="setup__list">
				{missing.map((key) => (
					<li key={key} className="setup__item">
						{labels[key]}
					</li>
				))}
			</ul>
			<p className="muted setup__hint">
				Open Settings (above) to configure each one. UI lands in M3 and M4.
			</p>
		</div>
	);
}
