import { withTodoTransaction } from "./todoDb";
import { TodoError } from "./todoError";
import type { Todo, TodoRow } from "./todoTypes";

export function toTodo(row: TodoRow): Todo {
    return {
        id: row.id,
        title: row.title,
        completed: row.completed,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

export function listTodos(signal: AbortSignal): Promise<Todo[]> {
    return withTodoTransaction(signal, async tx => {
        const result = await tx.query<TodoRow>(`SELECT id, title, completed, created_at, updated_at
            FROM todo_tasks ORDER BY created_at DESC, id DESC`);
        return result.rows.map(toTodo);
    });
}

export function createTodo(title: string, signal: AbortSignal): Promise<Todo> {
    return withTodoTransaction(signal, async tx => {
        await tx.query("LOCK TABLE todo_tasks IN SHARE ROW EXCLUSIVE MODE");
        const result = await tx.query<{ count: number }>("SELECT COUNT(*)::integer AS count FROM todo_tasks");
        if (result.rows[0].count >= 1000) throw new TodoError(409, "LIMIT_EXCEEDED", "登録件数の上限に達しています");
        const inserted = await tx.query<TodoRow>(`INSERT INTO todo_tasks (title) VALUES ($1)
            RETURNING id, title, completed, created_at, updated_at`, [title]);
        return toTodo(inserted.rows[0]);
    });
}
