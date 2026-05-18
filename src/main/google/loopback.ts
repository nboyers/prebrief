import http from "node:http";
import type { AddressInfo } from "node:net";

export type LoopbackHandle = {
	redirectUri: string;
	waitForCallback(
		expectedState: string,
		opts?: { timeoutMs?: number },
	): Promise<{ code: string }>;
	close(): void;
};

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export async function startLoopbackCapture(): Promise<LoopbackHandle> {
	let handler: ((url: URL) => HttpReply | null) | null = null;

	const server = http.createServer((req, res) => {
		const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
		const reply = handler?.(url);
		if (!reply) {
			res.writeHead(404).end();
			return;
		}
		res.writeHead(reply.status, {
			"content-type": "text/html; charset=utf-8",
		});
		res.end(reply.body);
	});

	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => resolve());
	});

	const address = server.address() as AddressInfo;
	const redirectUri = `http://127.0.0.1:${address.port}`;

	return {
		redirectUri,
		waitForCallback(expectedState, opts = {}) {
			const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
			return new Promise<{ code: string }>((resolve, reject) => {
				const timer = setTimeout(() => {
					handler = null;
					reject(new Error("Google OAuth sign-in timed out."));
				}, timeoutMs);
				handler = (url) => {
					const code = url.searchParams.get("code");
					const state = url.searchParams.get("state");
					const error = url.searchParams.get("error");
					if (error) {
						clearTimeout(timer);
						handler = null;
						reject(new Error(`Google OAuth error: ${error}`));
						return errorPage(`Google returned an error: ${error}`);
					}
					if (!code || !state) return null;
					if (state !== expectedState) {
						clearTimeout(timer);
						handler = null;
						reject(new Error("OAuth state mismatch (possible CSRF)."));
						return errorPage("State mismatch.");
					}
					clearTimeout(timer);
					handler = null;
					resolve({ code });
					return successPage();
				};
			});
		},
		close() {
			handler = null;
			server.close();
		},
	};
}

type HttpReply = { status: number; body: string };

function successPage(): HttpReply {
	return {
		status: 200,
		body: page(
			"Prebrief connected.",
			"You can close this tab and return to the app.",
			"#2da44e",
		),
	};
}

function errorPage(message: string): HttpReply {
	return {
		status: 400,
		body: page(message, "Try signing in again.", "#cf222e"),
	};
}

function page(title: string, subtitle: string, accent: string): string {
	return `<!doctype html>
<html><head><meta charset="utf-8"><title>Prebrief</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:60px;color:#1d1d1f">
  <h2 style="color:${accent};margin:0 0 8px">${title}</h2>
  <p style="margin:0;color:#6e6e73">${subtitle}</p>
</body></html>`;
}
