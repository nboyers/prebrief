import Store from "electron-store";

export type SettingsSchema = {
	llmProvider: "anthropic" | "openai";
	anthropicModel: string;
	openaiModel: string;
	briefLeadTimeMinutes: number;
	pollIntervalSeconds: number;
	launchAtLogin: boolean;
	googleOAuthClientId: string;
	googleOAuthClientSecret: string;
};

const defaults: SettingsSchema = {
	llmProvider: "anthropic",
	anthropicModel: "claude-sonnet-4-5",
	openaiModel: "gpt-4o-mini",
	briefLeadTimeMinutes: 5,
	pollIntervalSeconds: 60,
	launchAtLogin: true,
	googleOAuthClientId: "",
	googleOAuthClientSecret: "",
};

const store = new Store<SettingsSchema>({ defaults });

export const settings = {
	get<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
		return store.get(key);
	},
	set<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): void {
		store.set(key, value);
	},
	all(): SettingsSchema {
		return store.store;
	},
};
