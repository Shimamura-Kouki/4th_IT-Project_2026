import { TodoError } from "./todoError";
import type { CreateTodoInput } from "./todoTypes";

function invalidInput(): never {
    throw new TodoError(422, "VALIDATION_ERROR", "入力値が不正です");
}

export function validateMediaType(contentType: string | undefined, encoding: string | undefined): void {
    const parts = (contentType ?? "").split(";").map(part => part.trim());
    const charset = parts.slice(1).filter(part => /^charset\s*=/i.test(part));
    const valid = parts[0].toLowerCase() === "application/json" && charset.length <= 1
        && charset.every(part => /^charset\s*=\s*(?:utf-8|"utf-8")$/i.test(part));
    if (!valid || (encoding !== undefined && encoding.trim().toLowerCase() !== "identity")) {
        throw new TodoError(415, "UNSUPPORTED_MEDIA_TYPE", "UTF-8の非圧縮JSONを送信してください");
    }
}

export function parseJsonBody(body: unknown): unknown {
    if (!Buffer.isBuffer(body) || body.length === 0) throw new TodoError(400, "BAD_REQUEST", "本文が空です");
    if (body.length > 8192) throw new TodoError(413, "PAYLOAD_TOO_LARGE", "本文が8KiBを超えています");
    try {
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
    } catch {
        throw new TodoError(400, "BAD_REQUEST", "JSONまたはUTF-8が不正です");
    }
}

export function validateQuery(originalUrl: string): void {
    const index = originalUrl.indexOf("?");
    if (index >= 0 && originalUrl.slice(index + 1).length > 0) throw new TodoError(400, "BAD_REQUEST", "クエリパラメータは使用できません");
}

export function validateCreate(value: unknown): CreateTodoInput {
    if (typeof value !== "object" || value === null || Array.isArray(value)) invalidInput();
    const body = value as Record<string, unknown>;
    if (Object.keys(body).length !== 1 || !Object.hasOwn(body, "title") || typeof body.title !== "string") invalidInput();
    const title = body.title.trim();
    const points = Array.from(title);
    if (points.length < 1 || points.length > 100 || /[\u0000\r\n\t\u2028\u2029]/u.test(title) || points.some(point => {
        const code = point.codePointAt(0)!;
        return code >= 0xd800 && code <= 0xdfff;
    })) invalidInput();
    return { title };
}
