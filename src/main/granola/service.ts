import log from "../log";
import { secrets } from "../secrets";
import { GranolaClient } from "./client";
import type { GranolaTestResult } from "./types";

let client: GranolaClient | null = null;

function buildClient(): GranolaClient | null {
	const key = secrets.getGranolaApiKey();
	if (!key) return null;
	return new GranolaClient({ apiKey: key });
}

export const granolaService = {
	hasApiKey(): boolean {
		return secrets.hasGranolaApiKey();
	},
	getClient(): GranolaClient | null {
		if (client !== null) return client;
		client = buildClient();
		return client;
	},
	async saveApiKey(plain: string): Promise<GranolaTestResult> {
		const trimmed = plain.trim();
		if (!trimmed.startsWith("grn_")) {
			return { ok: false, error: "API key must start with 'grn_'." };
		}
		secrets.setGranolaApiKey(trimmed);
		client = null;
		return this.test();
	},
	clearApiKey(): void {
		secrets.clearGranolaApiKey();
		client = null;
	},
	async test(): Promise<GranolaTestResult> {
		const c = this.getClient();
		if (!c) return { ok: false, error: "No API key set." };
		try {
			return await c.test();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			log.warn("Granola test failed", err);
			return { ok: false, error: message };
		}
	},
};
