import express from "express";
import { getTodos, postTodo } from "./todoController";
import { sendTodoError, todoErrorHandler, TodoError, unavailable } from "./todoError";
import { parseJsonBody, validateMediaType, validateQuery } from "./todoValidator";

const router = express.Router();
const allow = "GET, POST, HEAD, OPTIONS";

router.use((req, res, next) => {
    const controller = new AbortController();
    res.locals.todoSignal = controller.signal;
    const timer = setTimeout(() => {
        controller.abort();
        sendTodoError(req, res, unavailable());
    }, 25_000);
    res.once("finish", () => clearTimeout(timer));
    res.once("close", () => {
        clearTimeout(timer);
        if (!res.writableEnded) controller.abort();
    });
    next();
});

router.head("/", (req, _res, next) => { validateQuery(req.originalUrl); next(); }, getTodos);
router.get("/", (req, _res, next) => { validateQuery(req.originalUrl); next(); }, getTodos);
router.post("/", (req, _res, next) => {
    validateMediaType(req.get("Content-Type"), req.get("Content-Encoding"));
    next();
}, express.raw({ type: "application/json", limit: 8192, inflate: false }), (req, res, next) => {
    if (res.locals.todoSignal.aborted) return;
    res.locals.todoJson = parseJsonBody(req.body);
    validateQuery(req.originalUrl);
    next();
}, postTodo);
router.options("/", (req, res) => {
    validateQuery(req.originalUrl);
    res.set("Allow", allow).status(204).end();
});
router.all("/", (_req, res, next) => {
    res.set("Allow", allow);
    next(new TodoError(405, "METHOD_NOT_ALLOWED", "対応していないHTTPメソッドです"));
});
// REQ-03・04は今回の対象外。ID付きのパスはまだ提供しない。
router.use((_req, _res, next) => next(new TodoError(404, "NOT_FOUND", "APIが見つかりません")));
router.use(todoErrorHandler);

export default router;
