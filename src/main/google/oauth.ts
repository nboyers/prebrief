import crypto from "node:crypto";

export const GOOGLE_AUTH_ENDPOINT =
	"https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const CALENDAR_READONLY_SCOPE =
	"https://www.googleapis.com/auth/calendar.readonly";

export type PkcePair = { verifier: string; challenge: string };

export function generatePkcePair(): PkcePair {
	const verifier = crypto.randomBytes(32).toString("base64url");
	const challenge = crypto
		.createHash("sha256")
		.update(verifier)
		.digest("base64url");
	return { verifier, challenge };
}

export function generateState(): string {
	return crypto.randomBytes(16).toString("base64url");
}

export type AuthorizationUrlParams = {
	clientId: string;
	redirectUri: string;
	scope: string;
	state: string;
	codeChallenge: string;
	loginHint?: string;
};

export function buildAuthorizationUrl(params: AuthorizationUrlParams): string {
	const url = new URL(GOOGLE_AUTH_ENDPOINT);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", params.clientId);
	url.searchParams.set("redirect_uri", params.redirectUri);
	url.searchParams.set("scope", params.scope);
	url.searchParams.set("state", params.state);
	url.searchParams.set("code_challenge", params.codeChallenge);
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("access_type", "offline");
	url.searchParams.set("prompt", "consent");
	if (params.loginHint) url.searchParams.set("login_hint", params.loginHint);
	return url.toString();
}

export type TokenResponse = {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	scope?: string;
	token_type: string;
};

export type ExchangeCodeParams = {
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	codeVerifier: string;
	fetchImpl?: typeof fetch;
};

export async function exchangeCodeForTokens(
	params: ExchangeCodeParams,
): Promise<TokenResponse> {
	return postTokenRequest(
		{
			code: params.code,
			client_id: params.clientId,
			client_secret: params.clientSecret,
			redirect_uri: params.redirectUri,
			grant_type: "authorization_code",
			code_verifier: params.codeVerifier,
		},
		params.fetchImpl,
	);
}

export type RefreshAccessTokenParams = {
	refreshToken: string;
	clientId: string;
	clientSecret: string;
	fetchImpl?: typeof fetch;
};

export class GoogleOAuthError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: string,
	) {
		super(`Google OAuth error: HTTP ${status}: ${body}`);
		this.name = "GoogleOAuthError";
	}
}

export async function refreshAccessToken(
	params: RefreshAccessTokenParams,
): Promise<TokenResponse> {
	return postTokenRequest(
		{
			refresh_token: params.refreshToken,
			client_id: params.clientId,
			client_secret: params.clientSecret,
			grant_type: "refresh_token",
		},
		params.fetchImpl,
	);
}

async function postTokenRequest(
	form: Record<string, string>,
	fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
	const body = new URLSearchParams(form);
	const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});
	if (!response.ok) {
		const text = await safeReadText(response);
		throw new GoogleOAuthError(response.status, text);
	}
	return (await response.json()) as TokenResponse;
}

async function safeReadText(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch {
		return "";
	}
}
