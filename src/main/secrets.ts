import { safeStorage } from "electron";
import Store from "electron-store";
import log from "./log";

type SecretsStoreSchema = {
	granolaApiKeyEnc?: string;
	googleClientIdEnc?: string;
	googleClientSecretEnc?: string;
	googleRefreshTokenEnc?: string;
};

const store = new Store<SecretsStoreSchema>({ name: "secrets" });

const GRANOLA_KEY = "granolaApiKeyEnc";
const GOOGLE_CLIENT_ID_KEY = "googleClientIdEnc";
const GOOGLE_CLIENT_SECRET_KEY = "googleClientSecretEnc";
const GOOGLE_REFRESH_TOKEN_KEY = "googleRefreshTokenEnc";

function isAvailable(): boolean {
	try {
		return safeStorage.isEncryptionAvailable();
	} catch (err) {
		log.warn("safeStorage check failed", err);
		return false;
	}
}

function encryptToBase64(plain: string): string {
	if (!isAvailable()) {
		throw new Error(
			"OS encryption is unavailable; cannot store secret securely.",
		);
	}
	return safeStorage.encryptString(plain).toString("base64");
}

function decryptFromBase64(stored: string | undefined): string | null {
	if (typeof stored !== "string" || stored.length === 0) return null;
	if (!isAvailable()) return null;
	try {
		return safeStorage.decryptString(Buffer.from(stored, "base64"));
	} catch (err) {
		log.warn("Failed to decrypt stored secret", err);
		return null;
	}
}

export const secrets = {
	hasGranolaApiKey(): boolean {
		return typeof store.get(GRANOLA_KEY) === "string";
	},
	setGranolaApiKey(plain: string): void {
		store.set(GRANOLA_KEY, encryptToBase64(plain));
	},
	getGranolaApiKey(): string | null {
		return decryptFromBase64(store.get(GRANOLA_KEY));
	},
	clearGranolaApiKey(): void {
		store.delete(GRANOLA_KEY);
	},

	hasGoogleClient(): boolean {
		return (
			typeof store.get(GOOGLE_CLIENT_ID_KEY) === "string" &&
			typeof store.get(GOOGLE_CLIENT_SECRET_KEY) === "string"
		);
	},
	setGoogleClient(clientId: string, clientSecret: string): void {
		store.set(GOOGLE_CLIENT_ID_KEY, encryptToBase64(clientId));
		store.set(GOOGLE_CLIENT_SECRET_KEY, encryptToBase64(clientSecret));
	},
	getGoogleClient(): { clientId: string; clientSecret: string } | null {
		const clientId = decryptFromBase64(store.get(GOOGLE_CLIENT_ID_KEY));
		const clientSecret = decryptFromBase64(store.get(GOOGLE_CLIENT_SECRET_KEY));
		if (!clientId || !clientSecret) return null;
		return { clientId, clientSecret };
	},
	clearGoogleClient(): void {
		store.delete(GOOGLE_CLIENT_ID_KEY);
		store.delete(GOOGLE_CLIENT_SECRET_KEY);
	},

	hasGoogleRefreshToken(): boolean {
		return typeof store.get(GOOGLE_REFRESH_TOKEN_KEY) === "string";
	},
	setGoogleRefreshToken(plain: string): void {
		store.set(GOOGLE_REFRESH_TOKEN_KEY, encryptToBase64(plain));
	},
	getGoogleRefreshToken(): string | null {
		return decryptFromBase64(store.get(GOOGLE_REFRESH_TOKEN_KEY));
	},
	clearGoogleRefreshToken(): void {
		store.delete(GOOGLE_REFRESH_TOKEN_KEY);
	},
};
