import log from "electron-log";
import { app } from "electron";
import path from "node:path";

log.transports.file.resolvePathFn = () =>
	path.join(app.getPath("logs"), "main.log");
log.transports.file.level = "info";
log.transports.console.level = "debug";

export default log;
