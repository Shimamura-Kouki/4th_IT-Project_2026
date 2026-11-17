export interface TodoRow {
    id: number;
    title: string;
    completed: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Todo {
    id: number;
    title: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTodoInput {
    title: string;
}

export interface ApiSuccess<T> {
    data: T;
}

export interface ApiErrorBody {
    error: { code: string; message: string };
}
