import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { pool } from "../../../db";
import { unavailable } from "./todoError";

export interface TodoTransaction {
    query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

// 期限切れの物理接続は破棄し、未確定トランザクションを残さない。
export async function withTodoTransaction<T>(signal: AbortSignal, work: (tx: TodoTransaction) => Promise<T>): Promise<T> {
    if (signal.aborted) throw unavailable();
    const deadline = performance.now() + 20_000;
    let client: PoolClient | undefined;
    let expired = false;
    let released = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectDeadline!: (error: Error) => void;
    const timeout = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
    const release = (destroy = false): void => {
        if (client && !released) {
            released = true;
            client.removeListener("error", onClientError);
            client.release(destroy);
        }
    };
    const expire = (): void => {
        if (expired) return;
        expired = true;
        rejectDeadline(unavailable());
        release(true);
    };
    const remaining = (): number => {
        const ms = Math.floor(deadline - performance.now());
        if (expired || signal.aborted || ms <= 0) {
            expire();
            throw unavailable();
        }
        return ms;
    };
    const run = async <R extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<R>> => {
        remaining();
        return Promise.race([client!.query<R>(sql, params), timeout]);
    };
    const query = async <R extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<R>> => {
        await run("SELECT set_config('statement_timeout', $1, true)", [String(remaining())]);
        return run<R>(sql, params);
    };
    const onClientError = (): void => { expire(); };
    try {
        timer = setTimeout(expire, 20_000);
        signal.addEventListener("abort", expire, { once: true });
        if (signal.aborted) expire();
        // 取得待ちが期限を超えた場合、遅れて渡されたクライアントも必ず解放する。
        const acquisition = pool.connect().then(candidate => {
            if (expired) {
                candidate.release();
                throw unavailable();
            }
            client = candidate;
            candidate.on("error", onClientError);
            return candidate;
        });
        try {
            await Promise.race([acquisition, timeout]);
        } catch {
            throw unavailable();
        }
        await run("BEGIN ISOLATION LEVEL READ COMMITTED");
        const result = await work({ query });
        await query("COMMIT");
        return result;
    } catch (error) {
        if (client && !released && !expired) {
            try {
                await run("ROLLBACK");
            } catch {
                release(true);
            }
        }
        throw error;
    } finally {
        if (timer) clearTimeout(timer);
        signal.removeEventListener("abort", expire);
        if (client && !released) {
            release();
        }
    }
}
