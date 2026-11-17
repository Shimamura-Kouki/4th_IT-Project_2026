import type { Request, Response } from "express";
import { createTodo, listTodos } from "./todoModel";
import { validateCreate } from "./todoValidator";

export function renderTodoPage(_req: Request, res: Response): void {
    res.render("todo/index");
}

// res.endで直接送信し、Expressの条件付きGETによる304への変換を回避する。
function sendJson(res: Response, status: number, data: unknown): void {
    if (res.headersSent || res.destroyed || res.locals.todoSignal.aborted) return;
    const body = JSON.stringify({ data });
    res.status(status).set({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": String(Buffer.byteLength(body)) });
    res.end(res.req.method === "HEAD" ? undefined : body);
}

export async function getTodos(_req: Request, res: Response): Promise<void> {
    sendJson(res, 200, await listTodos(res.locals.todoSignal));
}

export async function postTodo(_req: Request, res: Response): Promise<void> {
    const { title } = validateCreate(res.locals.todoJson);
    sendJson(res, 201, await createTodo(title, res.locals.todoSignal));
}
