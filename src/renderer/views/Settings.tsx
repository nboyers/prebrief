import { useEffect, useState } from "react";
import type { GranolaTestOutcome } from "../../shared/types";

type SaveState =
	| { kind: "idle" }
	| { kind: "saving" }
	| { kind: "saved"; outcome: GranolaTestOutcome }
	| { kind: "error"; message: string };

export function Settings({ onBack }: { onBack: () => void }) {
	const [hasKey, setHasKey] = useState<boolean>(false);
	const [keyInput, setKeyInput] = useState<string>("");
	const [save, setSave] = useState<SaveState>({ kind: "idle" });

	useEffect(() => {
		let cancelled = false;
		window.api.invoke("granola:get-status", undefined).then(({ hasKey }) => {
			if (!cancelled) setHasKey(hasKey);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	async function onSave() {
		setSave({ kind: "saving" });
		try {
			const outcome = await window.api.invoke("granola:save-api-key", {
				apiKey: keyInput,
			});
			setSave({ kind: "saved", outcome });
			if (outcome.ok) {
				setHasKey(true);
				setKeyInput("");
			}
		} catch (err) {
			setSave({
				kind: "error",
				message: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async function onClear() {
		await window.api.invoke("granola:clear-api-key", undefined);
		setHasKey(false);
		setSave({ kind: "idle" });
	}

	async function onTest() {
		setSave({ kind: "saving" });
		const outcome = await window.api.invoke(
			"granola:test-connection",
			undefined,
		);
		setSave({ kind: "saved", outcome });
	}

	return (
		<div className="popover">
			<header className="popover__header">
				<span className="popover__title">Settings</span>
				<button className="popover__btn" type="button" onClick={onBack}>
					Back
				</button>
			</header>
			<main className="popover__body">
				<section className="settings__section">
					<h3 className="settings__heading">Granola</h3>
					<p className="muted settings__hint">
						Create a Personal API key in the Granola desktop app: click your
						workspace name → API keys. Requires a Business or Enterprise plan.
					</p>
					{hasKey ? (
						<div className="settings__row">
							<span className="settings__status">Key stored in Keychain.</span>
							<div className="settings__actions">
								<button
									className="popover__btn"
									type="button"
									onClick={onTest}
									disabled={save.kind === "saving"}
								>
									Test
								</button>
								<button
									className="popover__btn"
									type="button"
									onClick={onClear}
								>
									Disconnect
								</button>
							</div>
						</div>
					) : (
						<div className="settings__row">
							<input
								className="settings__input"
								type="password"
								placeholder="grn_…"
								value={keyInput}
								onChange={(event) => setKeyInput(event.target.value)}
								spellCheck={false}
								autoComplete="off"
							/>
							<button
								className="popover__btn"
								type="button"
								onClick={onSave}
								disabled={
									save.kind === "saving" || keyInput.trim().length === 0
								}
							>
								{save.kind === "saving" ? "Saving…" : "Save"}
							</button>
						</div>
					)}
					{save.kind === "saved" && save.outcome.ok && (
						<p className="settings__feedback settings__feedback--ok">
							Connected. {save.outcome.sampleCount} note
							{save.outcome.sampleCount === 1 ? "" : "s"} reachable.
						</p>
					)}
					{save.kind === "saved" && !save.outcome.ok && (
						<p className="settings__feedback settings__feedback--err">
							{save.outcome.error}
						</p>
					)}
					{save.kind === "error" && (
						<p className="settings__feedback settings__feedback--err">
							{save.message}
						</p>
					)}
				</section>

				<section className="settings__section settings__section--muted">
					<h3 className="settings__heading">Google Calendar</h3>
					<p className="muted settings__hint">Lands in M3.</p>
				</section>

				<section className="settings__section settings__section--muted">
					<h3 className="settings__heading">LLM provider</h3>
					<p className="muted settings__hint">Lands in M4.</p>
				</section>
			</main>
		</div>
	);
}
