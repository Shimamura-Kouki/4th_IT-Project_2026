import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

// 実DBテストは、分離した空のテストDBに020 SQLを適用した場合だけ実行する。
test("REQ-01・02 API結合テスト（分離DBのみ）", { skip: process.env.TODO_ISOLATED_TEST_DB !== "yes" }, async () => {
    const { default: express } = await import("express");
    const { pool } = await import("../../../../db");
    const { default: router } = await import("../todoRouter");
    const app = express();
    app.use("/api/v1/todos", router);
    const server = app.listen(0, "127.0.0.1");
    const ids: number[] = [];
    try {
        await once(server, "listening");
        const address = server.address();
        assert.ok(address && typeof address !== "string");
        const url = `http://127.0.0.1:${address.port}/api/v1/todos`;
        const initial = await fetch(url);
        assert.equal(initial.status, 200);
        assert.deepEqual(await initial.json(), { data: [] }, "前提条件：分離した空のテスト用テーブル");
        assert.equal(initial.headers.get("cache-control"), "no-store");
        const create = async (title: string) => {
            const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
            const body = await response.json();
            if (response.status === 201 && Number.isInteger(body.data?.id)) ids.push(body.data.id);
            assert.equal(response.status, 201);
            return body.data;
        };
        const first = await create("  テスト課題  ");
        const second = await create("テスト課題");
        assert.equal(first.title, "テスト課題");
        assert.equal(first.completed, false);
        assert.equal(first.createdAt, first.updatedAt);
        assert.match(first.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        assert.equal(Object.hasOwn(first, "created_at"), false);
        assert.notEqual(first.id, second.id);
        const get = await fetch(url, { headers: { "If-None-Match": "*" } });
        assert.equal(get.status, 200);
        assert.deepEqual((await get.json()).data.map((row: { id: number }) => row.id), [second.id, first.id]);
        const head = await fetch(url, { method: "HEAD" });
        assert.equal(head.status, 200);
        assert.equal(await head.text(), "");
        const options = await fetch(url, { method: "OPTIONS" });
        assert.equal(options.status, 204);
        assert.equal(options.headers.get("allow"), "GET, POST, HEAD, OPTIONS");
        assert.equal((await fetch(`${url}/${first.id}`, { method: "DELETE" })).status, 404);
        assert.equal((await fetch(url, { method: "PUT" })).status, 405);
        const invalid = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"title":""}' });
        assert.equal(invalid.status, 422);
        assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
        assert.equal((await fetch(url, { method: "POST", body: "x" })).status, 415);
        assert.equal((await fetch(`${url}?unknown=1`)).status, 400);
        await pool.query("DELETE FROM todo_tasks WHERE id = ANY($1::integer[])", [ids]);
        ids.length = 0;
        const seeded = await pool.query<{ id: number }>("INSERT INTO todo_tasks (title) SELECT '上限確認' FROM generate_series(1, 999) RETURNING id");
        ids.push(...seeded.rows.map(row => row.id));
        const concurrent = await Promise.all(["競合確認A", "競合確認B"].map(title => fetch(url, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
        })));
        const statuses: number[] = [];
        for (const response of concurrent) {
            const body = await response.json();
            statuses.push(response.status);
            if (response.status === 201 && Number.isInteger(body.data?.id)) ids.push(body.data.id);
            else assert.equal(body.error?.code, "LIMIT_EXCEEDED");
        }
        assert.deepEqual(statuses.sort((a, b) => a - b), [201, 409]);
        assert.equal((await pool.query<{ count: number }>("SELECT COUNT(*)::integer AS count FROM todo_tasks")).rows[0].count, 1000);
    } finally {
        try {
            if (ids.length) await pool.query("DELETE FROM todo_tasks WHERE id = ANY($1::integer[])", [ids]);
        } finally {
            await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            await pool.end();
        }
    }
});
