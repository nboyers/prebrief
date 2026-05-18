import { safeStorage } from "electron";
import Store from "electron-store";
import log from "./log";

type SecretsStoreSchema = {
	granolaApiKeyEnc?: string;
};

const store = new Store<SecretsStoreSchema>({ name: "secrets" });

const GRANOLA_KEY = "granolaApiKeyEnc";

function isAvailable(): boolean {
	try {
		return safeStorage.isEncryptionAvailable();
	} catch (err) {
		log.warn("safeStorage check failed", err);
		return false;
	}
}

export const secrets = {
	hasGranolaApiKey(): boolean {
		return typeof store.get(GRANOLA_KEY) === "string";
	},
	setGranolaApiKey(plain: string): void {
		if (!isAvailable()) {
			throw new Error(
				"OS encryption is unavailable; cannot store API key securely.",
			);
		}
		const ciphertext = safeStorage.encryptString(plain).toString("base64");
		store.set(GRANOLA_KEY, ciphertext);
	},
	getGranolaApiKey(): string | null {
		const stored = store.get(GRANOLA_KEY);
		if (typeof stored !== "string" || stored.length === 0) return null;
		if (!isAvailable()) return null;
		try {
			return safeStorage.decryptString(Buffer.from(stored, "base64"));
		} catch (err) {
			log.warn("Failed to decrypt stored Granola API key", err);
			return null;
		}
	},
	clearGranolaApiKey(): void {
		store.delete(GRANOLA_KEY);
	},
};
