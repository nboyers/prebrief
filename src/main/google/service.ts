import { shell } from "electron";
import type { UpcomingMeeting } from "../../shared/types";
import log from "../log";
import { secrets } from "../secrets";
import {
	GoogleCalendarClient,
	type CalendarEvent,
	toUpcomingMeeting,
} from "./calendar";
import { startLoopbackCapture } from "./loopback";
import {
	CALENDAR_READONLY_SCOPE,
	GoogleOAuthError,
	buildAuthorizationUrl,
	exchangeCodeForTokens,
	generatePkcePair,
	generateState,
	refreshAccessToken,
} from "./oauth";

export type GoogleSignInOutcome = { ok: true } | { ok: false; error: string };

export type GoogleTestOutcome =
	| { ok: true; sampleEvent?: { title: string; startTime: string } }
	| { ok: false; error: string };

class TokenCache {
	private accessToken: string | null = null;
	private expiresAtMs = 0;

	get(now: number): string | null {
		if (!this.accessToken) return null;
		if (now >= this.expiresAtMs - 60_000) return null;
		return this.accessToken;
	}

	set(token: string, ttlSeconds: number, now: number): void {
		this.accessToken = token;
		this.expiresAtMs = now + ttlSeconds * 1000;
	}

	clear(): void {
		this.accessToken = null;
		this.expiresAtMs = 0;
	}
}

class GoogleService {
	private client: GoogleCalendarClient | null = null;
	private readonly tokenCache = new TokenCache();
	private inFlightSignIn: Promise<GoogleSignInOutcome> | null = null;

	hasClient(): boolean {
		return secrets.hasGoogleClient();
	}

	hasSession(): boolean {
		return this.hasClient() && secrets.hasGoogleRefreshToken();
	}

	saveClient(clientId: string, clientSecret: string): void {
		secrets.setGoogleClient(clientId.trim(), clientSecret.trim());
		this.client = null;
		this.tokenCache.clear();
	}

	clearClient(): void {
		secrets.clearGoogleClient();
		secrets.clearGoogleRefreshToken();
		this.client = null;
		this.tokenCache.clear();
	}

	signOut(): void {
		secrets.clearGoogleRefreshToken();
		this.client = null;
		this.tokenCache.clear();
	}

	async signIn(): Promise<GoogleSignInOutcome> {
		if (this.inFlightSignIn) return this.inFlightSignIn;
		const promise = this.doSignIn().finally(() => {
			this.inFlightSignIn = null;
		});
		this.inFlightSignIn = promise;
		return promise;
	}

	async test(): Promise<GoogleTestOutcome> {
		const client = this.getClient();
		if (!client) return { ok: false, error: "Not signed in." };
		try {
			const now = new Date();
			const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
			const events = await client.listEvents({
				timeMin: now,
				timeMax: horizon,
				maxResults: 1,
			});
			const next = events[0];
			if (!next) return { ok: true };
			return {
				ok: true,
				sampleEvent: {
					title: next.summary ?? "(no title)",
					startTime: next.start.dateTime ?? next.start.date ?? "",
				},
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			log.warn("Google calendar test failed", err);
			return { ok: false, error: message };
		}
	}

	async listUpcomingMeetings(windowMs: number): Promise<UpcomingMeeting[]> {
		const client = this.getClient();
		if (!client) return [];
		const now = new Date();
		const horizon = new Date(now.getTime() + windowMs);
		const events = await client.listEvents({
			timeMin: now,
			timeMax: horizon,
			maxResults: 50,
		});
		return events
			.map(toUpcomingMeeting)
			.filter((m): m is UpcomingMeeting => m !== null);
	}

	async getNextUpcoming(): Promise<UpcomingMeeting | null> {
		const meetings = await this.listUpcomingMeetings(24 * 60 * 60 * 1000);
		return meetings[0] ?? null;
	}

	private getClient(): GoogleCalendarClient | null {
		if (this.client) return this.client;
		if (!this.hasSession()) return null;
		this.client = new GoogleCalendarClient({
			getAccessToken: () => this.getAccessToken(),
		});
		return this.client;
	}

	private async getAccessToken(): Promise<string> {
		const cached = this.tokenCache.get(Date.now());
		if (cached) return cached;
		const creds = secrets.getGoogleClient();
		const refreshToken = secrets.getGoogleRefreshToken();
		if (!creds || !refreshToken) {
			throw new Error("Google session unavailable.");
		}
		try {
			const tokens = await refreshAccessToken({
				refreshToken,
				clientId: creds.clientId,
				clientSecret: creds.clientSecret,
			});
			this.tokenCache.set(tokens.access_token, tokens.expires_in, Date.now());
			return tokens.access_token;
		} catch (err) {
			if (
				err instanceof GoogleOAuthError &&
				err.status >= 400 &&
				err.status < 500
			) {
				log.warn(
					"Refresh token rejected by Google; clearing session.",
					err.status,
				);
				secrets.clearGoogleRefreshToken();
				this.client = null;
				this.tokenCache.clear();
				throw new Error(
					"Google session expired. Please reconnect Google Calendar in Settings.",
				);
			}
			throw err;
		}
	}

	private async doSignIn(): Promise<GoogleSignInOutcome> {
		const creds = secrets.getGoogleClient();
		if (!creds) {
			return {
				ok: false,
				error: "Google OAuth client not configured. Add it in Settings first.",
			};
		}
		const pkce = generatePkcePair();
		const state = generateState();
		const loopback = await startLoopbackCapture();
		try {
			const authUrl = buildAuthorizationUrl({
				clientId: creds.clientId,
				redirectUri: loopback.redirectUri,
				scope: CALENDAR_READONLY_SCOPE,
				state,
				codeChallenge: pkce.challenge,
			});
			await shell.openExternal(authUrl);
			const { code } = await loopback.waitForCallback(state);
			const tokens = await exchangeCodeForTokens({
				code,
				clientId: creds.clientId,
				clientSecret: creds.clientSecret,
				redirectUri: loopback.redirectUri,
				codeVerifier: pkce.verifier,
			});
			if (!tokens.refresh_token) {
				return {
					ok: false,
					error:
						"Google did not return a refresh token. Remove Prebrief's access at https://myaccount.google.com/permissions and sign in again.",
				};
			}
			secrets.setGoogleRefreshToken(tokens.refresh_token);
			this.tokenCache.set(tokens.access_token, tokens.expires_in, Date.now());
			this.client = null;
			return { ok: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			log.warn("Google sign-in failed", err);
			return { ok: false, error: message };
		} finally {
			loopback.close();
		}
	}
}

export const googleService = new GoogleService();

export type { CalendarEvent };
