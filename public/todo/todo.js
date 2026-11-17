export class TodoApiError extends Error {
    constructor(message, status = null, code = null, uncertain = false) {
        super(message);
        this.name = "TodoApiError";
        this.status = status;
        this.code = code;
        this.uncertain = uncertain;
    }
}

function isTodo(value) {
    return value !== null && typeof value === "object"
        && Number.isInteger(value.id) && value.id >= 1 && value.id <= 2147483647
        && typeof value.title === "string" && typeof value.completed === "boolean"
        && typeof value.createdAt === "string" && typeof value.updatedAt === "string"
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt)
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.updatedAt);
}

export class TodoApi {
    async list() {
        return this.request("GET", 200);
    }

    async create(title) {
        return this.request("POST", 201, { title });
    }

    async request(method, expected, body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        const mutation = method === "POST";
        try {
            const response = await fetch("/api/v1/todos", {
                method,
                cache: "no-store",
                signal: controller.signal,
                ...(body === undefined ? {} : {
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                }),
            });
            let json;
            try {
                json = await response.json();
            } catch {
                throw new TodoApiError("APIの応答を読み取れませんでした", response.status, null, mutation);
            }
            if (!response.ok) {
                const validError = typeof json?.error?.code === "string" && typeof json?.error?.message === "string";
                throw new TodoApiError(validError ? json.error.message : "APIでエラーが発生しました", response.status,
                    validError ? json.error.code : null, mutation && (!validError || response.status >= 500));
            }
            if (response.status !== expected || !(mutation ? isTodo(json?.data) : Array.isArray(json?.data) && json.data.every(isTodo))) {
                throw new TodoApiError("APIの応答形式が不正です", response.status, null, mutation);
            }
            return json.data;
        } catch (error) {
            if (error instanceof TodoApiError) throw error;
            throw new TodoApiError(controller.signal.aborted ? "通信がタイムアウトしました" : "通信に失敗しました", null, null, mutation);
        } finally {
            clearTimeout(timer);
        }
    }
}

export function initializeTodoPage(page = document) {
    const api = new TodoApi();
    const form = page.getElementById("todo-form");
    const input = page.getElementById("todo-title");
    const submit = page.getElementById("todo-submit");
    const reload = page.getElementById("todo-reload");
    const list = page.getElementById("todo-list");
    const status = page.getElementById("todo-status");
    const errorArea = page.getElementById("todo-error");
    let items = [];
    let hasList = false;
    let generation = 0;
    let registering = false;
    let loading = false;

    function showError(message = "") {
        errorArea.textContent = message;
        errorArea.hidden = !message;
    }

    function render() {
        list.replaceChildren();
        for (const todo of items) {
            const row = page.createElement("li");
            const badge = page.createElement("span");
            badge.className = "state";
            badge.textContent = todo.completed ? "完了" : "未完了";
            const title = page.createElement("span");
            title.textContent = todo.title;
            if (todo.completed) title.className = "completed";
            row.append(badge, title);
            list.append(row);
        }
        status.textContent = !hasList ? "" : items.length === 0 ? "TODOがありません" : `${items.length}件のTODO`;
    }

    function controls() {
        input.disabled = registering;
        submit.disabled = registering;
        reload.disabled = registering || loading;
    }

    async function loadList({ preserveError = false } = {}) {
        const current = ++generation;
        loading = true;
        controls();
        if (!preserveError) showError();
        status.textContent = "読み込み中…";
        try {
            const result = await api.list();
            if (current !== generation) return;
            items = result;
            hasList = true;
            render();
        } catch (error) {
            if (current !== generation) return;
            const prefix = preserveError && !errorArea.hidden ? `${errorArea.textContent} ` : "";
            showError(`${prefix}一覧を取得できませんでした：${error.message}`);
            status.textContent = hasList ? "最後に確認した表示を維持しています" : "一覧を取得できませんでした";
        } finally {
            if (current === generation) {
                loading = false;
                controls();
            }
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (registering) return;
        registering = true;
        // 先行する一覧取得の応答で、登録結果を上書きしない。
        generation++;
        loading = false;
        controls();
        showError();
        status.textContent = "登録中…";
        try {
            const todo = await api.create(input.value);
            items = [todo, ...items.filter(item => item.id !== todo.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
            hasList = true;
            input.value = "";
            render();
            await loadList();
        } catch (error) {
            if (error.uncertain) {
                showError(`登録の成否を確認できません：${error.message}。一覧を確認してください。`);
                await loadList({ preserveError: true });
            } else {
                showError(error.message);
                if (hasList) render();
                else status.textContent = "一覧を確認できていません";
            }
        } finally {
            registering = false;
            controls();
        }
    });

    reload.addEventListener("click", () => { void loadList(); });
    return loadList();
}

if (typeof document !== "undefined") {
    void initializeTodoPage();
}
