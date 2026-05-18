import { BrowserWindow, app } from "electron";
import path from "node:path";
import { composeBriefState, currentStatus } from "./brief";
import { granolaService } from "./granola/service";
import { googleService } from "./google/service";
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

async function broadcastStatus(): Promise<void> {
	const status = currentStatus();
	const brief = await composeBriefState();
	for (const window of BrowserWindow.getAllWindows()) {
		window.webContents.send("status:updated", status);
		window.webContents.send("brief:updated", brief);
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
	registerHandler("app:get-brief-state", () => composeBriefState());
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
		await broadcastStatus();
		return result;
	});
	registerHandler("granola:test-connection", () => granolaService.test());
	registerHandler("granola:clear-api-key", async () => {
		granolaService.clearApiKey();
		await broadcastStatus();
	});

	registerHandler("google:get-status", () => ({
		hasClient: googleService.hasClient(),
		hasSession: googleService.hasSession(),
	}));
	registerHandler(
		"google:save-client",
		async (_event, { clientId, clientSecret }) => {
			googleService.saveClient(clientId, clientSecret);
			await broadcastStatus();
		},
	);
	registerHandler("google:clear-client", async () => {
		googleService.clearClient();
		await broadcastStatus();
	});
	registerHandler("google:sign-in", async () => {
		const result = await googleService.signIn();
		await broadcastStatus();
		return result;
	});
	registerHandler("google:sign-out", async () => {
		googleService.signOut();
		await broadcastStatus();
	});
	registerHandler("google:test-connection", () => googleService.test());

	createMenubar(rendererUrl());
	log.info("Prebrief ready.");
});

app.on("window-all-closed", () => {
	// Keep the app alive as a menu-bar agent even when no windows are open.
});
