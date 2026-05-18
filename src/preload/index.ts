import { contextBridge, ipcRenderer } from "electron";
import type {
	IpcEventChannel,
	IpcEventMap,
	IpcRequestMap,
} from "../shared/ipc";

const api = {
	invoke<K extends keyof IpcRequestMap>(
		channel: K,
		params: IpcRequestMap[K]["params"],
	): Promise<IpcRequestMap[K]["result"]> {
		return ipcRenderer.invoke(channel, params);
	},
	on<K extends IpcEventChannel>(
		channel: K,
		listener: (payload: IpcEventMap[K]) => void,
	): () => void {
		const wrapped = (
			_event: Electron.IpcRendererEvent,
			payload: IpcEventMap[K],
		) => {
			listener(payload);
		};
		ipcRenderer.on(channel, wrapped);
		return () => {
			ipcRenderer.removeListener(channel, wrapped);
		};
	},
};

contextBridge.exposeInMainWorld("api", api);

export type PreloadApi = typeof api;
