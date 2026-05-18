import type {
	AppStatus,
	BriefState,
	GoogleSignInOutcome,
	GoogleStatus,
	GoogleTestOutcome,
	GranolaTestOutcome,
	HomeState,
	LlmProvider,
	LlmStatus,
	LlmTestOutcome,
	UpcomingMeeting,
} from "./types";

export type IpcRequestMap = {
	"app:get-status": { params: void; result: AppStatus };
	"app:get-home-state": { params: void; result: HomeState };
	"app:brief-for-meeting": {
		params: { meeting: UpcomingMeeting };
		result: BriefState;
	};
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
	"llm:get-status": { params: void; result: LlmStatus };
	"llm:save-key": {
		params: { provider: LlmProvider; apiKey: string };
		result: void;
	};
	"llm:clear-key": { params: { provider: LlmProvider }; result: void };
	"llm:set-provider": { params: { provider: LlmProvider }; result: void };
	"llm:set-model": {
		params: { provider: LlmProvider; model: string };
		result: void;
	};
	"llm:test": { params: void; result: LlmTestOutcome };
};

export type IpcEventMap = {
	"home:updated": HomeState;
	"status:updated": AppStatus;
};

export type IpcRequestChannel = keyof IpcRequestMap;
export type IpcEventChannel = keyof IpcEventMap;
