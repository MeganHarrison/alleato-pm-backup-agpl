type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  msg: string;
  [key: string]: unknown;
}

function log(level: LogLevel, payload: LogPayload | string) {
  if (process.env.NODE_ENV === "test") return;

  const entry = typeof payload === "string" ? { msg: payload } : payload;
  const output = JSON.stringify({ level, t: new Date().toISOString(), ...entry });

  if (level === "error" || level === "warn") {
    console.error(output);
  } else if (process.env.NODE_ENV !== "production") {
    console.log(output);
  }
}

export const logger = {
  debug: (payload: LogPayload | string) => log("debug", payload),
  info:  (payload: LogPayload | string) => log("info",  payload),
  warn:  (payload: LogPayload | string) => log("warn",  payload),
  error: (payload: LogPayload | string) => log("error", payload),
};
