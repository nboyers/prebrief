import {
	BrowserWindow,
	Tray,
	app,
	nativeImage,
	screen,
	type NativeImage,
} from "electron";
import path from "node:path";
import log from "./log";

const POPOVER_WIDTH = 380;
const POPOVER_HEIGHT = 480;
const TRAY_TITLE = "Brief";

export type MenubarRefs = {
	tray: Tray;
	window: BrowserWindow;
};

export function createMenubar(rendererUrl: string): MenubarRefs {
	const tray = new Tray(buildTrayImage());
	tray.setToolTip("Meeting Briefer");
	tray.setTitle(TRAY_TITLE);

	const window = new BrowserWindow({
		width: POPOVER_WIDTH,
		height: POPOVER_HEIGHT,
		show: false,
		frame: false,
		resizable: false,
		movable: false,
		fullscreenable: false,
		skipTaskbar: true,
		alwaysOnTop: true,
		webPreferences: {
			preload: path.join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

	window.loadURL(rendererUrl).catch((err: unknown) => {
		log.error("Failed to load renderer URL", err);
	});

	window.on("blur", () => {
		if (!window.webContents.isDevToolsOpened()) {
			window.hide();
		}
	});

	tray.on("click", () => {
		toggleWindow(window, tray);
	});

	tray.on("right-click", () => {
		toggleWindow(window, tray);
	});

	return { tray, window };
}

function toggleWindow(window: BrowserWindow, tray: Tray): void {
	if (window.isVisible()) {
		window.hide();
		return;
	}
	positionWindow(window, tray);
	window.show();
	window.focus();
}

function positionWindow(window: BrowserWindow, tray: Tray): void {
	const trayBounds = tray.getBounds();
	const windowBounds = window.getBounds();
	const display = screen.getDisplayNearestPoint({
		x: trayBounds.x,
		y: trayBounds.y,
	});

	const x = Math.round(
		Math.min(
			Math.max(
				trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2,
				display.workArea.x + 8,
			),
			display.workArea.x + display.workArea.width - windowBounds.width - 8,
		),
	);
	const y = Math.round(trayBounds.y + trayBounds.height + 4);

	window.setPosition(x, y, false);
}

function buildTrayImage(): NativeImage {
	const iconPath = path.join(app.getAppPath(), "assets/tray-iconTemplate.png");
	const image = nativeImage.createFromPath(iconPath);
	if (image.isEmpty()) {
		log.warn(`Tray icon not found at ${iconPath}; falling back to empty image`);
		return nativeImage.createEmpty();
	}
	image.setTemplateImage(true);
	return image;
}
