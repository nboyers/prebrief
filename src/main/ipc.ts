import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { IpcRequestMap } from "../shared/ipc";

type Handler<K extends keyof IpcRequestMap> = (
	event: IpcMainInvokeEvent,
	params: IpcRequestMap[K]["params"],
) => Promise<IpcRequestMap[K]["result"]> | IpcRequestMap[K]["result"];

export function registerHandler<K extends keyof IpcRequestMap>(
	channel: K,
	handler: Handler<K>,
): void {
	ipcMain.handle(channel, handler);
}
