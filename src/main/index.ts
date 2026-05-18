import { app } from "electron";
import path from "node:path";
import log from "./log";
import { createMenubar } from "./menubar";
import { registerHandler } from "./ipc";
import { settings } from "./settings";
import type { AppStatus, BriefState } from "../shared/types";

const isDev = !app.isPackaged;

function rendererUrl(): string {
	if (isDev) {
		return "http://localhost:5173";
	}
	return `file://${path.join(__dirname, "../renderer/index.html")}`;
}

function currentStatus(): AppStatus {
	return {
		granolaConnected: false,
		googleConnected: false,
		llmConfigured: false,
	};
}

function currentBriefState(): BriefState {
	const status = currentStatus();
	const missing: Array<keyof AppStatus> = [];
	if (!status.granolaConnected) missing.push("granolaConnected");
	if (!status.googleConnected) missing.push("googleConnected");
	if (!status.llmConfigured) missing.push("llmConfigured");
	if (missing.length > 0) {
		return { kind: "needs-setup", missing };
	}
	return { kind: "no-upcoming" };
}

app.whenReady().then(() => {
	if (process.platform === "darwin") {
		app.dock?.hide();
	}

	if (settings.get("launchAtLogin")) {
		app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
	}

	registerHandler("app:get-status", () => currentStatus());
	registerHandler("app:get-brief-state", () => currentBriefState());
	registerHandler("app:quit", () => {
		app.quit();
	});
	registerHandler("app:open-settings", () => {
		log.info("Settings requested; renderer handles routing.");
	});

	createMenubar(rendererUrl());
	log.info("Prebrief ready.");
});

app.on("window-all-closed", () => {
	// Keep the app alive as a menu-bar agent even when no windows are open.
});
