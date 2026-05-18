import type { AppStatus, BriefState, GranolaTestOutcome } from "./types";

export type IpcRequestMap = {
	"app:get-status": { params: void; result: AppStatus };
	"app:get-brief-state": { params: void; result: BriefState };
	"app:quit": { params: void; result: void };
	"app:open-settings": { params: void; result: void };
	"granola:get-status": { params: void; result: { hasKey: boolean } };
	"granola:save-api-key": {
		params: { apiKey: string };
		result: GranolaTestOutcome;
	};
	"granola:test-connection": { params: void; result: GranolaTestOutcome };
	"granola:clear-api-key": { params: void; result: void };
};

export type IpcEventMap = {
	"brief:updated": BriefState;
	"status:updated": AppStatus;
};

export type IpcRequestChannel = keyof IpcRequestMap;
export type IpcEventChannel = keyof IpcEventMap;
