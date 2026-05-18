import { BrowserWindow, app } from "electron";
import path from "node:path";
import {
	clearBriefCache,
	composeBriefForMeeting,
	composeHomeState,
	currentStatus,
} from "./brief";
import { granolaService } from "./granola/service";
import { googleService } from "./google/service";
import { llmService } from "./llm/service";
import log from "./log";
import { createMenubar } from "./menubar";
import { registerHandler } from "./ipc";
import { settings } from "./settings";

const isDev = !app.isPackaged;

function rendererUrl(): string {
	if (isDev) {
		return "http://localhost:5173";
	}
	return `file://${path.join(__dirname, "../renderer/index.html")}`;
}

async function broadcast(): Promise<void> {
	const status = currentStatus();
	const home = await composeHomeState();
	for (const window of BrowserWindow.getAllWindows()) {
		window.webContents.send("status:updated", status);
		window.webContents.send("home:updated", home);
	}
}

app.whenReady().then(() => {
	if (process.platform === "darwin") {
		app.dock?.hide();
	}

	if (settings.get("launchAtLogin")) {
		app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
	}

	registerHandler("app:get-status", () => currentStatus());
	registerHandler("app:get-home-state", () => composeHomeState());
	registerHandler("app:brief-for-meeting", (_event, { meeting }) =>
		composeBriefForMeeting(meeting),
	);
	registerHandler("app:quit", () => {
		app.quit();
	});
	registerHandler("app:open-settings", () => {
		log.info("Settings requested; renderer handles routing.");
	});

	registerHandler("granola:get-status", () => ({
		hasKey: granolaService.hasApiKey(),
	}));
	registerHandler("granola:save-api-key", async (_event, { apiKey }) => {
		const result = await granolaService.saveApiKey(apiKey);
		clearBriefCache();
		await broadcast();
		return result;
	});
	registerHandler("granola:test-connection", () => granolaService.test());
	registerHandler("granola:clear-api-key", async () => {
		granolaService.clearApiKey();
		clearBriefCache();
		await broadcast();
	});

	registerHandler("google:get-status", () => ({
		hasClient: googleService.hasClient(),
		hasSession: googleService.hasSession(),
	}));
	registerHandler(
		"google:save-client",
		async (_event, { clientId, clientSecret }) => {
			googleService.saveClient(clientId, clientSecret);
			await broadcast();
		},
	);
	registerHandler("google:clear-client", async () => {
		googleService.clearClient();
		await broadcast();
	});
	registerHandler("google:sign-in", async () => {
		const result = await googleService.signIn();
		await broadcast();
		return result;
	});
	registerHandler("google:sign-out", async () => {
		googleService.signOut();
		await broadcast();
	});
	registerHandler("google:test-connection", () => googleService.test());

	registerHandler("llm:get-status", () => ({
		activeProvider: llmService.getActiveProvider(),
		hasAnthropicKey: llmService.hasKey("anthropic"),
		hasOpenAiKey: llmService.hasKey("openai"),
		anthropicModel: llmService.getActiveModel("anthropic"),
		openaiModel: llmService.getActiveModel("openai"),
	}));
	registerHandler("llm:save-key", async (_event, { provider, apiKey }) => {
		llmService.saveKey(provider, apiKey);
		clearBriefCache();
		await broadcast();
	});
	registerHandler("llm:clear-key", async (_event, { provider }) => {
		llmService.clearKey(provider);
		clearBriefCache();
		await broadcast();
	});
	registerHandler("llm:set-provider", async (_event, { provider }) => {
		llmService.setActiveProvider(provider);
		clearBriefCache();
		await broadcast();
	});
	registerHandler("llm:set-model", async (_event, { provider, model }) => {
		llmService.setModel(provider, model);
		clearBriefCache();
		await broadcast();
	});
	registerHandler("llm:test", () => llmService.test());

	createMenubar(rendererUrl());
	log.info("Prebrief ready.");
});

app.on("window-all-closed", () => {
	// Keep the app alive as a menu-bar agent even when no windows are open.
});
