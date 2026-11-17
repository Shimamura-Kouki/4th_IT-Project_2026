import type { ErrorRequestHandler, Response, Request } from "express";

export class TodoError extends Error {
    constructor(public readonly status: number, public readonly code: string, message: string) {
        super(message);
        this.name = "TodoError";
    }
}

export function unavailable(): TodoError {
    return new TodoError(503, "SERVICE_UNAVAILABLE", "現在TODOを処理できません");
}

export function normalizeError(error: unknown): TodoError {
    if (error instanceof TodoError) return error;
    const value = error as { type?: string; code?: string; status?: number } | null;
    if (value?.type === "entity.too.large") return new TodoError(413, "PAYLOAD_TOO_LARGE", "本文が8KiBを超えています");
    if (value?.type === "encoding.unsupported" || value?.type === "charset.unsupported") return new TodoError(415, "UNSUPPORTED_MEDIA_TYPE", "対応していない本文形式です");
    if (value?.type === "request.aborted" || value?.type === "request.size.invalid" || value?.type === "entity.parse.failed" || value?.status === 400) return new TodoError(400, "BAD_REQUEST", "リクエストが不正です");
    if (typeof value?.code === "string" && (/^08/.test(value.code) || ["57014", "55P03", "57P01", "57P02", "57P03", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH"].includes(value.code))) return unavailable();
    return new TodoError(500, "INTERNAL_SERVER_ERROR", "サーバー内部でエラーが発生しました");
}

export function sendTodoError(req: Request, res: Response, error: TodoError): void {
    if (res.headersSent || res.destroyed) return;
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), method: req.method, path: req.originalUrl.split("?")[0], code: error.code }));
    const body = JSON.stringify({ error: { code: error.code, message: error.message } });
    res.status(error.status).set({ "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "Content-Length": String(Buffer.byteLength(body)) });
    res.end(req.method === "HEAD" ? undefined : body);
}

export const todoErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
    if (res.headersSent) {
        if (!res.writableEnded) next(error);
        return;
    }
    sendTodoError(req, res, normalizeError(error));
};
