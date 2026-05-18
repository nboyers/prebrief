import type {
	AppStatus,
	BriefState,
	GoogleSignInOutcome,
	GoogleStatus,
	GoogleTestOutcome,
	GranolaTestOutcome,
} from "./types";

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
	"google:get-status": { params: void; result: GoogleStatus };
	"google:save-client": {
		params: { clientId: string; clientSecret: string };
		result: void;
	};
	"google:clear-client": { params: void; result: void };
	"google:sign-in": { params: void; result: GoogleSignInOutcome };
	"google:sign-out": { params: void; result: void };
	"google:test-connection": { params: void; result: GoogleTestOutcome };
};

export type IpcEventMap = {
	"brief:updated": BriefState;
	"status:updated": AppStatus;
};

export type IpcRequestChannel = keyof IpcRequestMap;
export type IpcEventChannel = keyof IpcEventMap;
