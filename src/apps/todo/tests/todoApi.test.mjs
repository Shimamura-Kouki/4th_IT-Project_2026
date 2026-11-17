import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../../../../public/todo/todo.js", import.meta.url), "utf8");
const { TodoApi, initializeTodoPage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const todo = { id: 1, title: "課題", completed: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

test("TodoApiはGET・POSTの形式を検証し、変更を再試行しない", async t => {
    const api = new TodoApi();
    const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
        assert.equal(url, "/api/v1/todos");
        assert.equal(options.cache, "no-store");
        if (options.method === "GET") return Response.json({ data: [] });
        assert.equal(options.headers["Content-Type"], "application/json");
        assert.deepEqual(JSON.parse(options.body), { title: "課題" });
        return Response.json({ data: todo }, { status: 201 });
    });
    assert.deepEqual(await api.list(), []);
    assert.deepEqual(await api.create("課題"), todo);
    mock.mock.mockImplementation(async () => new Response("bad gateway", { status: 504 }));
    await assert.rejects(api.create("課題"), error => error.uncertain === true);
    assert.equal(mock.mock.callCount(), 3);
    mock.mock.mockImplementation(async () => Response.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, { status: 422 }));
    await assert.rejects(api.create("課題"), error => error.uncertain === false && error.status === 422);
    assert.equal(mock.mock.callCount(), 4);
});


test("画面イベントはTodoApi経由で一覧取得と登録を行う", async t => {
    const makeElement = () => ({
        value: "", textContent: "", hidden: false, disabled: false,
        children: [], handlers: {},
        addEventListener(type, handler) { this.handlers[type] = handler; },
        replaceChildren() { this.children = []; },
        append(...children) { this.children.push(...children); },
    });
    const ids = ["todo-form", "todo-title", "todo-submit", "todo-reload", "todo-list", "todo-status", "todo-error"];
    const elements = Object.fromEntries(ids.map(id => [id, makeElement()]));
    const page = { getElementById: id => elements[id], createElement: makeElement };
    let stored = [];
    const fetchMock = t.mock.method(globalThis, "fetch", async (url, options) => {
        assert.equal(url, "/api/v1/todos");
        if (options.method === "POST") {
            assert.equal(elements["todo-title"].disabled, true);
            assert.equal(elements["todo-submit"].disabled, true);
            const title = JSON.parse(options.body).title;
            stored = [{ ...todo, title }];
            return Response.json({ data: stored[0] }, { status: 201 });
        }
        assert.equal(options.method, "GET");
        return Response.json({ data: stored });
    });
    await initializeTodoPage(page);
    assert.equal(elements["todo-status"].textContent, "TODOがありません");
    elements["todo-title"].value = "<b>課題</b>";
    let prevented = false;
    await elements["todo-form"].handlers.submit({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(elements["todo-title"].value, "");
    assert.equal(elements["todo-submit"].disabled, false);
    assert.equal(elements["todo-list"].children[0].children[1].textContent, "<b>課題</b>");
    assert.equal(fetchMock.mock.callCount(), 3);
    assert.deepEqual(fetchMock.mock.calls.map(call => call.arguments[1].method), ["GET", "POST", "GET"]);
});
