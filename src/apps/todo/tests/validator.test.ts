import assert from "node:assert/strict";
import { test } from "node:test";
import { TodoError, normalizeError } from "../todoError";
import { parseJsonBody, validateCreate, validateMediaType, validateQuery } from "../todoValidator";

function rejectsStatus(work: () => unknown, status: number): void {
    assert.throws(work, (error: unknown) => error instanceof TodoError && error.status === status);
}

test("タイトルのtrimとUnicode境界値", () => {
    assert.deepEqual(validateCreate({ title: "  課題  " }), { title: "課題" });
    assert.equal(validateCreate({ title: "😀".repeat(100) }).title, "😀".repeat(100));
    assert.equal(validateCreate({ title: "e\u0301" }).title, "e\u0301");
    assert.equal(validateCreate({ title: "<script>test</script>" }).title, "<script>test</script>");
    for (const title of ["", "　 ", "😀".repeat(101), "a\0b", "a\nb", "a\tb", "\ud800", "\udc00"]) {
        rejectsStatus(() => validateCreate({ title }), 422);
    }
});

test("本文の型・必須キー・余分なキー", () => {
    for (const value of [null, [], 5, true, "x", {}, { title: 1 }, { title: "x", completed: false }, JSON.parse('{"title":"ok","__proto__":{}}')]) {
        rejectsStatus(() => validateCreate(value), 422);
    }
});

test("JSON構文とUTF-8、8KiBの境界", () => {
    assert.equal(parseJsonBody(Buffer.from("null")), null);
    assert.deepEqual(parseJsonBody(Buffer.from("[]")), []);
    for (const value of [Buffer.alloc(0), Buffer.from("{"), Buffer.from([0xc0, 0xaf])]) rejectsStatus(() => parseJsonBody(value), 400);
    assert.deepEqual(parseJsonBody(Buffer.from(" ".repeat(8190) + "{}")), {});
    rejectsStatus(() => parseJsonBody(Buffer.from(" ".repeat(8191) + "{}")), 413);
});

test("メディアタイプとクエリ", () => {
    validateMediaType("application/json; charset=UTF-8", undefined);
    validateMediaType("application/json", "identity");
    rejectsStatus(() => validateMediaType(undefined, undefined), 415);
    rejectsStatus(() => validateMediaType("application/json; charset=iso-8859-1", undefined), 415);
    rejectsStatus(() => validateMediaType("application/json", "gzip"), 415);
    validateQuery("/api/v1/todos");
    rejectsStatus(() => validateQuery("/api/v1/todos?x=1"), 400);
});

test("DBエラーと本文エラーの分類", () => {
    assert.equal(normalizeError({ code: "2200H" }).status, 500);
    assert.equal(normalizeError({ code: "08006" }).status, 503);
    assert.equal(normalizeError({ code: "57014" }).status, 503);
    assert.equal(normalizeError({ code: "42501" }).status, 500);
    assert.equal(normalizeError({ type: "entity.too.large" }).status, 413);
});
