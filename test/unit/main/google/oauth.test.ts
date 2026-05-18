import { describe, expect, it } from "vitest";
import {
	CALENDAR_READONLY_SCOPE,
	GOOGLE_AUTH_ENDPOINT,
	GOOGLE_TOKEN_ENDPOINT,
	GoogleOAuthError,
	buildAuthorizationUrl,
	exchangeCodeForTokens,
	generatePkcePair,
	generateState,
	refreshAccessToken,
} from "../../../../src/main/google/oauth";

describe("generatePkcePair", () => {
	it("returns a base64url verifier and SHA-256 challenge", () => {
		const pair = generatePkcePair();
		expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(pair.verifier).not.toBe(pair.challenge);
	});

	it("does not repeat across calls", () => {
		const a = generatePkcePair();
		const b = generatePkcePair();
		expect(a.verifier).not.toBe(b.verifier);
		expect(a.challenge).not.toBe(b.challenge);
	});
});

describe("generateState", () => {
	it("produces a high-entropy base64url string", () => {
		const state = generateState();
		expect(state.length).toBeGreaterThanOrEqual(16);
		expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe("buildAuthorizationUrl", () => {
	const baseParams = {
		clientId: "client.apps.googleusercontent.com",
		redirectUri: "http://127.0.0.1:54321",
		scope: CALENDAR_READONLY_SCOPE,
		state: "test-state",
		codeChallenge: "challenge-abc",
	};

	it("targets Google's authorization endpoint", () => {
		const url = new URL(buildAuthorizationUrl(baseParams));
		expect(`${url.origin}${url.pathname}`).toBe(GOOGLE_AUTH_ENDPOINT);
	});

	it("includes PKCE, offline access, and forced consent", () => {
		const url = new URL(buildAuthorizationUrl(baseParams));
		expect(url.searchParams.get("client_id")).toBe(baseParams.clientId);
		expect(url.searchParams.get("redirect_uri")).toBe(baseParams.redirectUri);
		expect(url.searchParams.get("scope")).toBe(CALENDAR_READONLY_SCOPE);
		expect(url.searchParams.get("state")).toBe("test-state");
		expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
		expect(url.searchParams.get("code_challenge_method")).toBe("S256");
		expect(url.searchParams.get("access_type")).toBe("offline");
		expect(url.searchParams.get("prompt")).toBe("consent");
		expect(url.searchParams.get("response_type")).toBe("code");
	});
});

describe("exchangeCodeForTokens", () => {
	it("posts an authorization_code form to the token endpoint", async () => {
		let receivedUrl: string | undefined;
		let receivedBody: string | undefined;
		const fetchImpl: typeof fetch = async (input, init) => {
			receivedUrl = typeof input === "string" ? input : (input as URL).toString();
			receivedBody = init?.body as string;
			return new Response(
				JSON.stringify({
					access_token: "at",
					refresh_token: "rt",
					expires_in: 3600,
					token_type: "Bearer",
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		};

		const result = await exchangeCodeForTokens({
			code: "auth-code",
			clientId: "cid",
			clientSecret: "csecret",
			redirectUri: "http://127.0.0.1:1",
			codeVerifier: "v",
			fetchImpl,
		});

		expect(result.access_token).toBe("at");
		expect(result.refresh_token).toBe("rt");
		expect(receivedUrl).toBe(GOOGLE_TOKEN_ENDPOINT);
		const params = new URLSearchParams(receivedBody!);
		expect(params.get("grant_type")).toBe("authorization_code");
		expect(params.get("code")).toBe("auth-code");
		expect(params.get("code_verifier")).toBe("v");
	});

	it("throws GoogleOAuthError on non-2xx", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response("invalid_grant", { status: 400 });

		await expect(
			exchangeCodeForTokens({
				code: "x",
				clientId: "cid",
				clientSecret: "cs",
				redirectUri: "http://127.0.0.1:1",
				codeVerifier: "v",
				fetchImpl,
			}),
		).rejects.toBeInstanceOf(GoogleOAuthError);
	});
});

describe("refreshAccessToken", () => {
	it("posts a refresh_token form and returns the new access token", async () => {
		let receivedBody: string | undefined;
		const fetchImpl: typeof fetch = async (_input, init) => {
			receivedBody = init?.body as string;
			return new Response(
				JSON.stringify({
					access_token: "fresh",
					expires_in: 3600,
					token_type: "Bearer",
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		};

		const result = await refreshAccessToken({
			refreshToken: "rt",
			clientId: "cid",
			clientSecret: "cs",
			fetchImpl,
		});

		expect(result.access_token).toBe("fresh");
		const params = new URLSearchParams(receivedBody!);
		expect(params.get("grant_type")).toBe("refresh_token");
		expect(params.get("refresh_token")).toBe("rt");
	});
});
