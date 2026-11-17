BEGIN;

CREATE TABLE todo_tasks (
    id INTEGER GENERATED ALWAYS AS IDENTITY (NO CYCLE) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT todo_tasks_id_positive CHECK (id >= 1),
    CONSTRAINT todo_tasks_title_length CHECK (char_length(title) BETWEEN 1 AND 100),
    CONSTRAINT todo_tasks_title_no_breaks CHECK (
        position(chr(10) in title) = 0
        AND position(chr(13) in title) = 0
        AND position(chr(9) in title) = 0
    )
);

CREATE INDEX todo_tasks_created_at_id_idx
    ON todo_tasks (created_at DESC, id DESC);

COMMIT;
