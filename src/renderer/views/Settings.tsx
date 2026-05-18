import { useEffect, useState } from "react";
import type {
	GoogleSignInOutcome,
	GoogleTestOutcome,
	GranolaTestOutcome,
} from "../../shared/types";

type GranolaSave =
	| { kind: "idle" }
	| { kind: "saving" }
	| { kind: "saved"; outcome: GranolaTestOutcome }
	| { kind: "error"; message: string };

type GoogleState =
	| { kind: "idle" }
	| { kind: "saving" }
	| { kind: "signing-in" }
	| { kind: "signed-in"; outcome: GoogleSignInOutcome }
	| { kind: "tested"; outcome: GoogleTestOutcome }
	| { kind: "error"; message: string };

export function Settings({ onBack }: { onBack: () => void }) {
	return (
		<div className="popover">
			<header className="popover__header">
				<span className="popover__title">Settings</span>
				<button className="popover__btn" type="button" onClick={onBack}>
					Back
				</button>
			</header>
			<main className="popover__body">
				<GranolaSection />
				<GoogleSection />
				<section className="settings__section settings__section--muted">
					<h3 className="settings__heading">LLM provider</h3>
					<p className="muted settings__hint">Lands in M4.</p>
				</section>
			</main>
		</div>
	);
}

function GranolaSection() {
	const [hasKey, setHasKey] = useState(false);
	const [input, setInput] = useState("");
	const [state, setState] = useState<GranolaSave>({ kind: "idle" });

	useEffect(() => {
		let cancelled = false;
		window.api
			.invoke("granola:get-status", undefined)
			.then(({ hasKey }) => !cancelled && setHasKey(hasKey));
		return () => {
			cancelled = true;
		};
	}, []);

	async function onSave() {
		setState({ kind: "saving" });
		try {
			const outcome = await window.api.invoke("granola:save-api-key", {
				apiKey: input,
			});
			setState({ kind: "saved", outcome });
			if (outcome.ok) {
				setHasKey(true);
				setInput("");
			}
		} catch (err) {
			setState({
				kind: "error",
				message: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async function onTest() {
		setState({ kind: "saving" });
		const outcome = await window.api.invoke(
			"granola:test-connection",
			undefined,
		);
		setState({ kind: "saved", outcome });
	}

	async function onClear() {
		await window.api.invoke("granola:clear-api-key", undefined);
		setHasKey(false);
		setState({ kind: "idle" });
	}

	return (
		<section className="settings__section">
			<h3 className="settings__heading">Granola</h3>
			<p className="muted settings__hint">
				Create a Personal API key in the Granola desktop app: workspace name →
				API keys. Requires a Business or Enterprise plan.
			</p>
			{hasKey ? (
				<div className="settings__row">
					<span className="settings__status">Key stored in Keychain.</span>
					<div className="settings__actions">
						<button
							className="popover__btn"
							type="button"
							onClick={onTest}
							disabled={state.kind === "saving"}
						>
							Test
						</button>
						<button className="popover__btn" type="button" onClick={onClear}>
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
						value={input}
						onChange={(event) => setInput(event.target.value)}
						spellCheck={false}
						autoComplete="off"
					/>
					<button
						className="popover__btn"
						type="button"
						onClick={onSave}
						disabled={state.kind === "saving" || input.trim().length === 0}
					>
						{state.kind === "saving" ? "Saving…" : "Save"}
					</button>
				</div>
			)}
			{state.kind === "saved" && state.outcome.ok && (
				<p className="settings__feedback settings__feedback--ok">
					Connected. {state.outcome.sampleCount} note
					{state.outcome.sampleCount === 1 ? "" : "s"} reachable.
				</p>
			)}
			{state.kind === "saved" && !state.outcome.ok && (
				<p className="settings__feedback settings__feedback--err">
					{state.outcome.error}
				</p>
			)}
			{state.kind === "error" && (
				<p className="settings__feedback settings__feedback--err">
					{state.message}
				</p>
			)}
		</section>
	);
}

function GoogleSection() {
	const [hasClient, setHasClient] = useState(false);
	const [hasSession, setHasSession] = useState(false);
	const [clientId, setClientId] = useState("");
	const [clientSecret, setClientSecret] = useState("");
	const [state, setState] = useState<GoogleState>({ kind: "idle" });

	useEffect(() => {
		let cancelled = false;
		refresh();
		return () => {
			cancelled = true;
		};
		async function refresh() {
			const status = await window.api.invoke("google:get-status", undefined);
			if (cancelled) return;
			setHasClient(status.hasClient);
			setHasSession(status.hasSession);
		}
	}, []);

	async function reloadStatus() {
		const status = await window.api.invoke("google:get-status", undefined);
		setHasClient(status.hasClient);
		setHasSession(status.hasSession);
	}

	async function onSaveClient() {
		setState({ kind: "saving" });
		try {
			await window.api.invoke("google:save-client", {
				clientId: clientId.trim(),
				clientSecret: clientSecret.trim(),
			});
			setClientId("");
			setClientSecret("");
			setState({ kind: "idle" });
			await reloadStatus();
		} catch (err) {
			setState({
				kind: "error",
				message: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async function onClearClient() {
		await window.api.invoke("google:clear-client", undefined);
		setState({ kind: "idle" });
		await reloadStatus();
	}

	async function onSignIn() {
		setState({ kind: "signing-in" });
		const outcome = await window.api.invoke("google:sign-in", undefined);
		setState({ kind: "signed-in", outcome });
		await reloadStatus();
	}

	async function onSignOut() {
		await window.api.invoke("google:sign-out", undefined);
		setState({ kind: "idle" });
		await reloadStatus();
	}

	async function onTest() {
		setState({ kind: "saving" });
		const outcome = await window.api.invoke(
			"google:test-connection",
			undefined,
		);
		setState({ kind: "tested", outcome });
	}

	return (
		<section className="settings__section">
			<h3 className="settings__heading">Google Calendar</h3>
			{!hasClient ? (
				<>
					<p className="muted settings__hint">
						Create your own OAuth Desktop client at{" "}
						<code>console.cloud.google.com</code>:
						<br />
						<small>
							Project → APIs & Services → Credentials → Create Credentials →
							OAuth client ID → Desktop app. Enable the Google Calendar API on
							the same project. On the OAuth consent screen, add your own email
							as a test user.
						</small>
					</p>
					<div className="settings__row settings__row--stack">
						<input
							className="settings__input"
							type="text"
							placeholder="Client ID"
							value={clientId}
							onChange={(event) => setClientId(event.target.value)}
							spellCheck={false}
							autoComplete="off"
						/>
						<input
							className="settings__input"
							type="password"
							placeholder="Client secret"
							value={clientSecret}
							onChange={(event) => setClientSecret(event.target.value)}
							spellCheck={false}
							autoComplete="off"
						/>
						<button
							className="popover__btn"
							type="button"
							onClick={onSaveClient}
							disabled={
								state.kind === "saving" ||
								clientId.trim().length === 0 ||
								clientSecret.trim().length === 0
							}
						>
							{state.kind === "saving" ? "Saving…" : "Save client"}
						</button>
					</div>
				</>
			) : !hasSession ? (
				<div className="settings__row">
					<span className="settings__status">
						Client saved. Sign in to grant calendar access.
					</span>
					<div className="settings__actions">
						<button
							className="popover__btn"
							type="button"
							onClick={onSignIn}
							disabled={state.kind === "signing-in"}
						>
							{state.kind === "signing-in" ? "Waiting…" : "Sign in"}
						</button>
						<button
							className="popover__btn"
							type="button"
							onClick={onClearClient}
						>
							Reset
						</button>
					</div>
				</div>
			) : (
				<div className="settings__row">
					<span className="settings__status">
						Connected to Google Calendar.
					</span>
					<div className="settings__actions">
						<button
							className="popover__btn"
							type="button"
							onClick={onTest}
							disabled={state.kind === "saving"}
						>
							Test
						</button>
						<button className="popover__btn" type="button" onClick={onSignOut}>
							Sign out
						</button>
					</div>
				</div>
			)}
			{state.kind === "signed-in" && state.outcome.ok && (
				<p className="settings__feedback settings__feedback--ok">Signed in.</p>
			)}
			{state.kind === "signed-in" && !state.outcome.ok && (
				<p className="settings__feedback settings__feedback--err">
					{state.outcome.error}
				</p>
			)}
			{state.kind === "tested" && state.outcome.ok && (
				<p className="settings__feedback settings__feedback--ok">
					{state.outcome.sampleEvent
						? `Next event: ${state.outcome.sampleEvent.title}`
						: "Calendar reachable. No upcoming events this week."}
				</p>
			)}
			{state.kind === "tested" && !state.outcome.ok && (
				<p className="settings__feedback settings__feedback--err">
					{state.outcome.error}
				</p>
			)}
			{state.kind === "error" && (
				<p className="settings__feedback settings__feedback--err">
					{state.message}
				</p>
			)}
		</section>
	);
}
