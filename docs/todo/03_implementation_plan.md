# TODOアプリ V1 実装計画書

状態：改訂実装計画案（未実施・設計上の要確認事項あり）  
対象ブランチ：`feature/todo-app`  
根拠：[`01_requirements.md`](./01_requirements.md)（確定版）、[`02_design.md`](./02_design.md)（改訂設計案・コミット `fa6f28f`）

参照時のGit blob：要件定義書 `d2b7d95907349f8d73208e4650dc64f1820a5cb6`、設計書 `8c7cb9bdd9f9787ff4d3c6b932b47e889fe50b01`。両文書は変更しない。

## 1. 実装方針と現状

要件定義書のREQ-01〜REQ-04および共通要件を、既存のExpress＋TypeScript＋EJSサイトに小さな変更単位で実装する。工程ごとに確認し、失敗した場合は次へ進まず、原因を解消する。各工程の変更を確認できる単位でコミットする。DBへのSQL適用とGitへのファイル保存は別工程とする。テーブル名は `todo_tasks`、画面は `/todo`、APIの基点は `/api/v1/todos` とする。APIのJSONキーは改訂設計案に従いcamelCase、DB列はsnake_caseとする。ただし日時キーの差異等は設計書8章の要確認事項であり、本書だけで確定しない。該当工程の開始前に確認する。

### 1.1 既存ファイルの確認結果

| ファイル | 現在の内容 | 実装方針 |
| --- | --- | --- |
| `index.ts` | Express起動、3000番ポート、`express.urlencoded()`、`public`、EJSの`views`、`/`、`/api/db-check` | API専用Routerと画面用Controllerのimport・登録を追加する案。既存処理は移動・削除しない。 |
| `db.ts` | `dotenv/config`、`DATABASE_URL`必須、`pg.Pool`の`max: 2` | 既存poolを再利用し、必要な接続取得期限の設定のみ追加する。 |
| `tsconfig.json` | ES2022、CommonJS、strict、出力先`dist`、`include: ["index.ts"]` | importされたTODOのTSファイルもコンパイルされる。原則維持し、不足が確認された場合のみ変更する。 |
| `package.json` | `dev: tsx watch ./index.ts`、`build: tsc`、`start: node ./dist/index.js`。Express 5、EJS、pg、dotenv、tsx導入済み | 既存スクリプトを維持し、テストスクリプトだけ追加する。追加ライブラリは原則不要。 |
| `.gitignore` | `.env`、`.env.*`、`node_modules/`、`dist/`、`.vercel/`等を除外 | 維持し、接続情報を追跡しない。 |

以前のリポジトリ確認時点に `public/`、`views/`、`src/`、`sql/`、`tests/` は存在しなかった。実装開始時に `git ls-tree --name-only HEAD` で実在を再確認する。以下は新規作成予定の推奨配置であり、配置の変更が必要な場合は理由を記録する。Vercelの実際の構成と分離したテスト専用Neon DBの準備状況は要確認。

### 1.2 予定する追加・変更

```text
プロジェクト直下/
├── index.ts                         変更（API・画面ルート登録案）
├── db.ts                            必要最小限の変更
├── package.json                     テストスクリプト追加
├── tsconfig.json                    原則変更なし
├── src/apps/todo/
│   ├── todoTypes.ts
│   ├── todoError.ts
│   ├── todoValidator.ts
│   ├── todoDb.ts
│   ├── todoModel.ts
│   ├── todoController.ts
│   ├── todoRouter.ts
│   └── tests/                       自動テスト（要確認）
├── views/todo/index.ejs
├── public/todo/
│   ├── todoApi.js
│   ├── todo.js
│   └── todo.css
├── sql/todo/
│   ├── 020_create_todo_tasks.sql
│   └── README.md                    適用手順（追加提案）
└── docs/todo/
    ├── 01_requirements.md           既存・変更なし
    ├── 02_design.md                 既存・変更なし
    ├── 03_implementation_plan.md   本書
    └── 04_test_results.md           テスト工程で作成
```

授業の参考SQL（`000_check_connection.sql`、第2回演習者向けの`010_setup_sample_products.sql`）は本機能の前提にしない。必要な場合は別途確認する。Vercelの設定ファイルは現状確認後に必要なものだけ追加する。SQL適用手順は指定の追加先に収めるため `sql/todo/README.md` を提案する（改訂設計書ではファイル名未確定）。

### 1.3 確認コマンドの前提

コマンドはプロジェクト直下で実行する。HTTPの例はBash互換シェル（Git Bash等）の`curl`を使用する。Windowsでは必要に応じて`curl.exe`を用いる。`npm run dev`は別ターミナルで起動し、通常は `http://localhost:3000` にアクセスする。起動は分離した開発・テスト用Neon DBの`DATABASE_URL`を設定してから行い、共有DBを誤って操作しない。

`curl -i`でステータス・ヘッダー・本文を確認する。例示の`TODO_ID`はPOSTで返された実際のIDに置き換える。確認に使用するタイトルは架空の文字列とし、取得・変更対象が自分の確認用データであることを確かめる。Router登録前の新規TSを個別に型検査する例では、既存tsconfigとの衝突を避けるため `--ignoreConfig` を指定する（現行コンパイラで `npx tsc --help --all` を確認し、未対応の場合は同等の一時的な型検査用設定を使用する）。テストコマンドは設計書の `src/apps/todo/tests/` を使う案で記載し、配置確認後に揃える。各工程で`git diff --check`および差分を確認し、秘密情報を含めない。未追跡ファイルはステージ後の`git diff --cached`でも確認する。

## 2. 実装工程

APIの確認時は設計書5.1〜5.4に従う。

| 要件ID | HTTPメソッド・URL | 本文 | 成功 | 失敗 | TodoApi |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | GET `/api/v1/todos` | なし | 200、`data: Todo[]` | 400/500/503 | `list()` |
| REQ-02 | POST `/api/v1/todos` | `{"title":"Sample task"}` | 201、`data: Todo` | 400/409/413/415/422/500/503 | `create(title)` |
| REQ-03 | PATCH `/api/v1/todos/:id` | `{"completed":true}` | 200、`data: Todo` | 400/404/413/415/422/500/503 | `updateCompleted(id, completed)` |
| REQ-04 | DELETE `/api/v1/todos/:id` | なし | 204、本文なし | 400/404/500/503 | `remove(id)` |

TodoのJSON例（日時キーは要確認1の案）：

```json
{"data":{"id":1,"title":"Sample task","completed":false,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}}
```

共通エラー例：`{"error":{"code":"VALIDATION_ERROR","message":"入力値が不正です"}}`。405・404のルーティングエラー、HEAD/OPTIONS、Allow等の補助HTTP操作は工程09・17・18で確認する。

### 工程01：開発環境と既存機能の基準確認

**対象ファイル：** `index.ts`、`db.ts`、`tsconfig.json`、`package.json`、`package-lock.json`、`.gitignore`（参照のみ）。

**作業内容：** 現在のブランチと差分を確認し、`feature/todo-app`を使用する。設計書8章の要確認事項を担当者と確認する（4章の工程別開始条件を参照）。分離した開発用Neon DBを準備し、`DATABASE_URL`をGit管理外の環境変数または`.env`に設定する。依存関係をロックファイルから導入する。既存ルートの応答とビルド結果を基準として記録する。DB接続先の識別情報は記録しても接続URL・パスワードは記録しない。

**確認コマンド：**

```bash
git branch --show-current
git status --short
git ls-tree --name-only HEAD
git rev-parse HEAD:docs/todo/01_requirements.md HEAD:docs/todo/02_design.md
node --version
npm --version
npm ci
npm run build
git check-ignore .env
npm run dev
```

別ターミナル：

```bash
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/db-check
```

**期待結果：** ブランチが`feature/todo-app`、参照文書が冒頭のblobと一致（変更されていれば計画を再照合）、依存関係導入とビルドが成功。`/`は200で`2026-11-10 test`、`/api/db-check`は200で`{"status":"ok","database":"connected"}`。`.env`が除外対象である。実際の結果は後の回帰確認に使用する。

**失敗時に最初に見る場所：** `package-lock.json`、Node/npmのバージョン、`db.ts`の環境変数・Neon接続先、3000番ポート。対象DBの分離が未確認ならDB変更工程へ進まない。

### 工程02：DB作成SQLをGitに保存する（実行しない）

**対象ファイル：** `sql/todo/020_create_todo_tasks.sql`、`sql/todo/README.md`（新規）。

**作業内容：** 設計書3章のDDLを転記する。`todo_tasks`にINTEGER IDENTITY（NO CYCLE）、主キー、正のID制約、VARCHAR(100)、BOOLEANの初期値FALSE、TIMESTAMPTZ(3)の日時、タイトル長・改行・タブの制約、登録日時・ID降順インデックスを定義する。BEGIN/COMMITでまとめる。READMEに適用先の確認、手動適用、既存同名テーブルがある場合の中止・照合手順を記載する。DROP、TRUNCATE、起動時のDDLは含めない。設計書3章のSQLは次のとおり（この工程では保存のみ）。

```sql
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
```

**確認コマンド：**

```bash
git add sql/todo/README.md sql/todo/020_create_todo_tasks.sql
git diff --cached --check
git diff --cached -- sql/
git status --short
```

レビュー後、SQLファイルだけの変更としてコミットし、必要に応じてpushする（他の作業中ファイルを含めない）。

```bash
git commit -m 'docs: TODOテーブル作成SQLと適用手順を追加'
git show --stat --oneline HEAD
```

**期待結果：** SQLと適用手順がGitに保存される。既存アプリ・Neon DBには変更がない。SQLの構文・実行結果は次工程で検証する。

**失敗時に最初に見る場所：** DDLと設計書3章の差分、ステージ済みファイル、文字コード・SQLの制約とトランザクション。

### 工程03：Neon SQL Editorで分離DBへ手動適用する

**対象ファイル：** 工程02のSQL（参照のみ）。対象DB：分離した開発・テスト用Neon DB。

**作業内容：** Neon管理画面でプロジェクト・ブランチ・データベースを確認する。SQL Editorで次の確認SQLを実行し、接続先が開発・テスト用で、`todo_tasks`が未作成であることを確かめる。`todo_tasks` または旧案の `todos` が存在する場合は適用を止め、定義・既存データ・互換性を確認し、改名・移行・初期化を勝手に行わない。確認後、保存済みのDDLをSQL Editorへ貼り付け、手動実行する。

**確認コマンド（Neon SQL Editor）：**

適用前：

```sql
SELECT current_database(), current_schema(), current_user;
SELECT to_regclass('todo_tasks') AS existing_todo_tasks,
    to_regclass('todos') AS legacy_todos;
```

適用後：

```sql
SELECT column_name, data_type, is_nullable, column_default,
       is_identity, identity_generation, datetime_precision
FROM information_schema.columns
WHERE table_schema = current_schema() AND table_name = 'todo_tasks'
ORDER BY ordinal_position;

SELECT identity_start, identity_increment, identity_minimum,
       identity_maximum, identity_cycle
FROM information_schema.columns
WHERE table_schema = current_schema()
    AND table_name = 'todo_tasks' AND column_name = 'id';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'todo_tasks'::regclass;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema() AND tablename = 'todo_tasks';

SELECT COUNT(*) FROM todo_tasks;
```

**期待結果：** 初回作成時にテーブルとインデックスが作成され、5カラム、制約、初期値、日時精度、IDENTITYの上限2,147,483,647・循環なしが設計どおりで0件。既存データを削除していない。適用対象と結果を記録する。

**失敗時に最初に見る場所：** SQL Editorのエラー行、選択中のNeonブランチ・DB・スキーマ・権限。同名テーブルやDDL失敗時は実行を中止し、状態を確認（必要ならROLLBACK）する。安易にDROPして再実行しない。

### 工程04：共通型とエラー処理を実装する

**対象ファイル：** `src/apps/todo/todoTypes.ts`、`todoError.ts`（新規）、`src/apps/todo/tests/`の共通処理テスト（新規）。

**作業内容：** 日時キーとテスト配置（要確認1・3）を確認してから、DB行型 `TodoRow`（`created_at: Date`、`updated_at: Date`）とAPIの `Todo` 型（`createdAt: string`、`updatedAt: string` の案）、CreateTodoInput、UpdateTodoInput、ApiSuccess、ApiErrorBodyを定義する。DBのキーをそのままAPIに返さない。共通エラー型と4引数エラーミドルウェア、ステータス・コード・安全なメッセージ変換、HEADの本文抑止、応答済み時の処理、指定4項目のログを実装する。元の例外や接続情報・本文を公開しない。既存ルートへは適用しない。

**確認コマンド：**

```bash
npx tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --strict --esModuleInterop --skipLibCheck src/apps/todo/todoTypes.ts src/apps/todo/todoError.ts
npx tsx --test src/apps/todo/tests/error.test.ts
git diff --check
```

テストファイル名`error.test.ts`は本計画の推奨名。以後のテスト名も同様とする。

**期待結果：** 型検査が成功し、400/404/405/409/413/415/422/500/503の共通エラー形式とログが検証できる。秘密情報は出力されない。

**失敗時に最初に見る場所：** `todoTypes.ts`の型、`todoError.ts`のステータス変換・ロガー・ミドルウェア引数。

### 工程05：入力検証と本文処理を実装する

**対象ファイル：** `src/apps/todo/todoValidator.ts`、`src/apps/todo/tests/validator.test.ts`（新規）、必要に応じて`todoError.ts`。

**作業内容：** 設計書4章の検証順序を実装する。POST/PATCHのみContent-Type（UTF-8、非圧縮）を確認後、`express.raw()`で8,192バイト上限を適用。厳格なUTF-8デコードとJSON.parseで構文・空本文400、サイズ413、形式415を分類する。その後ID、クエリ、入力オブジェクトの順で検証する。IDはASCIIの正の10進整数、上限2,147,483,647、先頭ゼロなし。タイトルはtrim後のコードポイント1〜100文字、NUL・孤立サロゲート・残る改行やタブを拒否し、正規化しない。completedは真偽値だけ、余分なキーは禁止。GET等の本文は解析しない。

**確認コマンド：**

```bash
npx tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --strict --esModuleInterop --skipLibCheck src/apps/todo/todoValidator.ts
npx tsx --test src/apps/todo/tests/validator.test.ts
git diff --check
```

**期待結果：** ID・文字数・Unicode・型・余分なキーの境界値と正常系が合格する。後のRouter結合テストで本文サイズ、メディアタイプ、検証順序を確認する。

**失敗時に最初に見る場所：** `todoValidator.ts`の正規表現、コードポイント数、UTF-8デコード、JSON構文と値の判定順序。

### 工程06：既存poolを使うDB処理・期限管理を実装する

**対象ファイル：** `src/apps/todo/todoDb.ts`、`src/apps/todo/tests/db.test.ts`（新規）、`db.ts`（必要な接続取得タイムアウト設定のみ変更）。

**作業内容：** 既存`pool`（上限2）をimportして利用する。同一クライアントでトランザクションを扱い、DB接続待ちを含む合計20秒の共通期限と残り時間に応じたSQL・ロック待ちの制限を設ける。接続取得の期限設定（`connectionTimeoutMillis`等）、`statement_timeout`等の適用、期限後のCOMMIT抑止、ROLLBACK、接続解放・破棄を実装する。サーバー側25秒の期限と連携できるようにする。単にPromise.raceで応答だけ終了させない。既にcommitされた変更の取り消しは保証しない。

**確認コマンド：**

```bash
npm run build
npx tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --strict --esModuleInterop --skipLibCheck src/apps/todo/todoDb.ts
npx tsx --test src/apps/todo/tests/db.test.ts
curl -i http://localhost:3000/api/db-check
```

`curl` は起動中の開発サーバーに対して実行する。

**期待結果：** 正常時・例外時・期限超過時のクライアント解放と未確定変更の取り消しが確認できる。プール枯渇や期限後の処理続行がなく、既存DB確認は200。障害試験は分離DBだけで実施する。

**失敗時に最初に見る場所：** `db.ts`のpool設定、`todoDb.ts`の期限起点・残り時間、ROLLBACKとrelease/destroy、接続取得の遅延。

### 工程07：Modelを実装する（REQ-01〜REQ-04）

**対象ファイル：** `src/apps/todo/todoModel.ts`、`src/apps/todo/tests/model.test.ts`（新規）、必要に応じて`todoDb.ts`。

**作業内容：** 次の順にModelを実装し、各機能を独立して確認する。設計書5.1〜5.4のSQLを用い、入力はSQLパラメーターで渡す。すべてのSQLの対象は `todo_tasks` とする。DB行の `created_at`・`updated_at` を `toISOString()` でUTC・ミリ秒のISO文字列へ変換し、確定したAPIの日時キー（本案では `createdAt`・`updatedAt`）に明示的に詰め替える。

| 小変更 | 内容 | 確認対象 |
| --- | --- | --- |
| 07-a | 一覧：`ORDER BY created_at DESC, id DESC` | 0件、順序、同一日時、日時形式 |
| 07-b | 登録：READ COMMITTED、SHARE ROW EXCLUSIVEロック、件数確認、INSERT RETURNING、COMMIT | 初期値、日時一致、同名、999件からの競合、1,000件制限409、ID枯渇500 |
| 07-c | 更新：単一のUPDATE RETURNING、状態変化時のみ更新日時を変更 | 双方向、同一状態、他項目維持、存在しないID、更新・削除の競合 |
| 07-d | 削除：DELETE RETURNING | 対象のみ削除、再削除404、ID非再利用 |

対象が存在しない場合・登録上限・DB障害等を適切なエラーに変換する。変更系はCOMMITが成功してから結果を返す。IDシーケンスのリセットは起動・通常処理で行わない。各テストは分離DBで準備と後処理を行い、互いに依存させない。

**確認コマンド：**

```bash
npx tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --strict --esModuleInterop --skipLibCheck src/apps/todo/todoModel.ts
npx tsx --test src/apps/todo/tests/model.test.ts
```

**期待結果：** 4操作のDBテストが成功し、件数上限の競合・削除後の復活防止・時刻の条件・データ整合性を満たす。

**失敗時に最初に見る場所：** `todoModel.ts`のSQLと引数、`todoDb.ts`、SQL Editorで実際に適用したスキーマ、ロックとトランザクションの範囲。

### 工程08：Controllerを実装する

**対象ファイル：** `src/apps/todo/todoController.ts`、`src/apps/todo/tests/controller.test.ts`（新規）。

**作業内容：** 画面用の `renderTodoPage`（推奨名）で `res.render("todo/index")` を呼び、一覧・登録・更新・削除の各APIハンドラーと分離する。Validatorの結果をModelに渡し、GET 200、POST 201、PATCH 200は`{data: ...}`、DELETE 204は`res.status(204).end()`とする。エラーは共通処理へ渡す。GETのno-store、条件付きリクエストで304にならない応答方式、HEADの本文なしを実現する。ModelとHTTP処理を分離する。

**確認コマンド：**

```bash
npx tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --strict --esModuleInterop --skipLibCheck src/apps/todo/todoController.ts
npx tsx --test src/apps/todo/tests/controller.test.ts
```

**期待結果：** 正常・異常応答が定義どおりで204の本文が空。入力エラー時にModelを呼び出さない。画面ルートは次の工程で結合確認する。

**失敗時に最初に見る場所：** `todoController.ts`の検証・Model呼び出し・レスポンス送信順序、`todoError.ts`。

### 工程09：RouterとAPI専用ミドルウェアを実装する（まだindex.tsに登録しない）

**対象ファイル：** `src/apps/todo/todoRouter.ts`、`src/apps/todo/tests/router.test.ts`（新規）。

**作業内容：** `express.Router()` を用いてAPI専用の `todoRouter` をdefault exportする。相対パス `/` にGET/POST、`/:id` にPATCH/DELETEを登録する。Router内で `/api/v1/todos` を重複指定せず、画面の `GET /todo` は含めない。GET/POST/PATCH/DELETEの4操作、一覧HEAD、両パスのOPTIONS、405とAllow、未定義パス404を実装する。POST/PATCHだけ本文解析ミドルウェアを通し、ID・クエリ・入力値の検証を順に適用する。API専用Routerの末尾に4引数の共通エラーミドルウェアを配置し、他ルートへ影響させない。API処理の25秒期限を管理し、DB期限と連携、二重応答を防止する。

テスト専用Expressアプリに `app.use("/api/v1/todos", todoRouter)` を登録してlistenし、実際のHTTPとしてテストする。`index.ts`の起動副作用を回避する。GETの暗黙的HEADやExpressの自動OPTIONS・404・エラー処理に依存せず、期待する応答を検証する。

**確認コマンド：**

```bash
npx tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --strict --esModuleInterop --skipLibCheck src/apps/todo/todoRouter.ts
npx tsx --test src/apps/todo/tests/router.test.ts
```

**期待結果：** 4操作のAPI、HEAD/OPTIONS、Allow、未定義パス、全共通エラー、検証順序、条件付きGET、期限処理の結合テストが成功する。既存ルートと静的アセットに相当するテスト経路にはTODO用の404やエラー形式が適用されない。既存実アプリはまだ変更されない。

**失敗時に最初に見る場所：** `todoRouter.ts`のマウントパス、登録順序、HEAD/OPTIONS、ミドルウェアの適用範囲、`todoValidator.ts`と`todoError.ts`。

### 工程10：EJSの画面骨格と静的ファイルを追加する

**対象ファイル：** `views/todo/index.ejs`、`public/todo/todo.css`（新規）。`public/todo/todo.js`は空の初期ファイルではなく、工程12以降で完成させる。画面用JSの参照URLは工程13で `todo.js` を作成してから有効化する。

**作業内容：** タイトル入力フォーム、登録ボタン、読み込み・エラー・0件領域、一覧コンテナを用意する。入力ラベル、状態通知、キーボード操作、PC・スマートフォン向けCSS、完了時の取り消し線を設計どおり作成する。HTMLにはDBデータを埋め込まない。EJSのレンダリングを単体確認する。画面骨格段階ではCRUD操作は未接続と明示し、フォームが意図しない送信を行わないよう一時的に無効化する。

**確認コマンド：**

```bash
node -e "require('ejs').renderFile('views/todo/index.ejs', {}, (err, html) => { if (err) throw err; console.log(html.includes('TODO')); })"
git diff --check
```

**期待結果：** EJSのレンダリングが成功し、画面骨格が生成される。新規ファイルはUTF-8。まだ公開URLへの登録はしていない。

**失敗時に最初に見る場所：** `views/todo/index.ejs`のEJS構文、相対パス、CSSの参照URL。

### 工程11：index.tsへTODO Routerを最小限の差分で登録する

**対象ファイル：** `index.ts`（変更）、既存の`tsconfig.json`（原則変更なし）。

**作業内容：** 設計書1章に従い、画面ルート方式（要確認2）を確認したうえで、次の差分を2つの小変更に分ける。11-a：`todoRouter` をimportし、既存の `express.urlencoded()` より前に `app.use("/api/v1/todos", todoRouter)` を追加する。既存の2ルートとAPIを確認する。11-b：`renderTodoPage` をimportし、既存のEJS設定後に `app.get("/todo", renderTodoPage)` を追加し、画面と静的ファイルを確認する。計4行の追加案で、既存行を変更・移動・削除しない。画面専用Routerを選ぶ場合は確認済みの差分に置き換える。

```diff
 import express, { Request, Response } from "express";
 import path from "path";
 import { pool } from "./db";
+import todoRouter from "./src/apps/todo/todoRouter";
+import { renderTodoPage } from "./src/apps/todo/todoController";

 const app = express(); // Expressアプリケーションを作成
 const port: number = 3000; // ローカルで使用するポート番号

 // ------------------------------
 // Expressの基本設定
 // ------------------------------
+app.use("/api/v1/todos", todoRouter);
 app.use(express.urlencoded({ extended: true })); // フォームから送信されたデータを受け取れるようにする
 app.use(express.static(path.join(process.cwd(), "public"))); // CSSや画像などの静的ファイルを公開する
 app.set("view engine", "ejs"); // テンプレートエンジンにEJSを設定
 app.set("views", path.join(process.cwd(), "views")); // EJSファイルを保存するフォルダーを指定
+app.get("/todo", renderTodoPage);
```

**確認コマンド：**

```bash
git diff -- index.ts tsconfig.json
npm run build
npm run dev
```

別ターミナル：

```bash
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/db-check
curl -i http://localhost:3000/todo
curl -i http://localhost:3000/api/v1/todos
curl -i http://localhost:3000/todo/todo.css
```

devを終了してから、ビルド済みの起動も確認する。

```bash
npm start
```

別ターミナルで上記の5URLを再確認する。

**期待結果：** 11-a、11-bのそれぞれで既存2ルートは工程01の結果と一致。11-aで一覧APIは200 JSON、11-bで `/todo` はHTML、CSSは200。`dist/index.js`とimportされたTODO TSが出力され、`npm start`でも動作する。画面操作の接続は後工程。既存コードの不要な整形・設定変更がない。

**失敗時に最初に見る場所：** `index.ts`の登録位置とimport、`todoRouter.ts`、`tsconfig.json`のincludeと`dist`出力、EJS・静的ファイルの設定パス。

### 工程12：TodoApiクラスを実装する

**対象ファイル：** `public/todo/todoApi.js`（新規）、必要に応じて`src/apps/todo/tests/`のFetch単体テスト。

**作業内容：** ES moduleとしてTodoApiを名前付きexportし、`list()`、`create(title)`、`updateCompleted(id, completed)`、`remove(id)`と共通`request()`を実装する。同一オリジンのAPIを利用し、POST/PATCHはJSON、GETはno-store。期待するHTTPステータスおよびレスポンス形式を確認する。Todoの日時キーは確認済みの仕様（案：`createdAt`・`updatedAt`）に統一し、DBのsnake_case列名をブラウザに漏らさない。204は解析せず、JSON以外や通信障害にも対応する。AbortControllerで本文読取まで30秒の期限を適用し、変更系は自動再試行しない。DOM操作は行わない。

**確認コマンド：**

```bash
node --input-type=module --check < public/todo/todoApi.js
curl -i http://localhost:3000/todo/todoApi.js
```

ブラウザの開発者ツールのConsole（`/todo`と同じオリジン）：

```javascript
const { TodoApi } = await import('/todo/todoApi.js');
const api = new TodoApi();
await api.list();
```

**期待結果：** 構文エラーがなく静的配信が200。TodoApiが一覧を取得できる。後の画面確認と自動テストで201/200/204、エラー・タイムアウト時の挙動を検証する。

**失敗時に最初に見る場所：** `todoApi.js`のexport、URL、Fetchのmethod/header、JSON解析、AbortController、Networkタブ。

### 工程13：画面の一覧表示を接続する（REQ-01）

**対象ファイル：** `public/todo/todo.js`（新規）、`views/todo/index.ejs`、`public/todo/todo.css`（必要に応じて変更）。

**作業内容：** `todo.js`がTodoApiをimportし、EJSに`<script type="module" src="/todo/todo.js"></script>`を追加する。初回表示で一覧取得し、読み込み中・0件・取得失敗・一覧表示を区別する。DOM生成は`createElement`、`textContent`等を使用する。最後に確認した一覧と取得世代を管理する。未実装の変更操作は次工程まで無効にする。

**確認コマンド：**

```bash
node --input-type=module --check < public/todo/todo.js
curl -i http://localhost:3000/todo/todo.js
curl -i http://localhost:3000/api/v1/todos
```

**期待結果：** `/todo`をChromeまたはEdgeで開くとFetchが実行され、DBの一覧と一致する。0件なら200と `{"data":[]}` を返し「TODOがありません」と表示する。0件表示と取得エラーが区別され、HTMLタグを含むタイトルは文字列として表示される。

**失敗時に最初に見る場所：** EJSのmodule読込、ブラウザのConsole・Network、`todo.js`のDOM参照・取得処理、`todoApi.js`。

### 工程14：画面の登録を接続する（REQ-02）

**対象ファイル：** `public/todo/todo.js`、`views/todo/index.ejs`、必要に応じて`todo.css`。

**作業内容：** フォーム送信（Enter含む）でTodoApi.createを呼ぶ。処理中は入力欄と登録ボタンを無効化し、成功時だけ入力をクリアする。成功データを画面に反映後、一覧を再取得する。確定失敗はエラー表示と入力維持。成否不明、再取得失敗、競合応答は設計書6章の扱いに従う。finallyで無効化を解除する。

**確認コマンド：**

```bash
curl -i -X POST http://localhost:3000/api/v1/todos \
    -H 'Content-Type: application/json' \
    --data-binary '{"title":"  Sample task  "}'
curl -i http://localhost:3000/api/v1/todos
```

**期待結果：** POSTは201、タイトルは`Sample task`、completedはfalse、`createdAt` と `updatedAt` は一致（日時キーは要確認1の確定後の仕様に従う）。ブラウザでも登録・再読込・重複タイトル・失敗時の入力維持・ボタン復帰が確認できる。

**失敗時に最初に見る場所：** `todo.js`のsubmitと状態管理、`todoApi.js`のPOST、Networkの送信JSON、Controller・Validator・Model。

### 工程15：画面の完了状態変更を接続する（REQ-03）

**対象ファイル：** `public/todo/todo.js`、`public/todo/todo.css`（必要に応じて変更）。

**作業内容：** チェックボックスから明示的な真偽値を送る。同じTODOの更新・削除操作を処理中に無効化する。確定前は従来の表示を維持し、失敗時は元の状態に戻す。成功データを反映し一覧を再取得。取得世代を管理し、古い応答で最新の状態を上書きしない。

**確認コマンド：**

```bash
# POSTで得た自分の確認用IDに置き換える
TODO_ID='実際の確認用IDに置き換える'
curl -i -X PATCH "http://localhost:3000/api/v1/todos/$TODO_ID" \
    -H 'Content-Type: application/json' --data-binary '{"completed":true}'
curl -i -X PATCH "http://localhost:3000/api/v1/todos/$TODO_ID" \
    -H 'Content-Type: application/json' --data-binary '{"completed":true}'
curl -i -X PATCH "http://localhost:3000/api/v1/todos/$TODO_ID" \
    -H 'Content-Type: application/json' --data-binary '{"completed":false}'
```

**期待結果：** 全て200。双方向変更ができ、同一状態への再指定は `updatedAt` 不変、タイトル・`createdAt`・IDは不変（日時キーは要確認1の確定後の仕様に従う）。画面でもチェックと取り消し線、失敗時の復元、操作の無効化が確認できる。

**失敗時に最初に見る場所：** `todo.js`のchangeイベントと行ロック、`todoApi.js`のPATCH、ModelのUPDATE SQL。

### 工程16：画面の削除を接続する（REQ-04）

**対象ファイル：** `public/todo/todo.js`、必要に応じて`todo.css`。

**作業内容：** `window.confirm()`で確認し、承認時だけTodoApi.removeを実行する。キャンセルはAPIを送信しない。成功後に対象行を除去し、一覧を再取得する。失敗時の維持、成否不明の表示と再取得、登録・更新との応答競合に対応する。

**確認コマンド：**

```bash
# 削除するのは自分の確認用IDのみ
TODO_ID='実際の確認用IDに置き換える'
curl -i -X DELETE "http://localhost:3000/api/v1/todos/$TODO_ID"
curl -i -X DELETE "http://localhost:3000/api/v1/todos/$TODO_ID"
curl -i http://localhost:3000/api/v1/todos
```

**期待結果：** 最初は204・本文なし、再削除は404。他のTODOは維持される。ブラウザでキャンセル時に通信しないこと、承認時の削除、リロード後の消失、失敗時の復帰を確認する。

**失敗時に最初に見る場所：** `todo.js`の確認ダイアログ・行の操作管理、`todoApi.js`の204処理、ControllerとModelのDELETE。

### 工程17：自動テストをまとめて実行する

**対象ファイル：** `src/apps/todo/tests/`、`package.json`（テストスクリプトのみ追加）、必要に応じてテスト用TS設定（配置は要確認）。

**作業内容：** 各工程のテストを独立して実行できるよう整備する。`node:test`と既存のtsxを利用し、`package.json`の既存3スクリプトを維持して、例えば `"test": "tsx --test --test-concurrency=1 src/apps/todo/tests/*.test.ts"` を追加する。テストファイルを直下に置く場合の案であり、使用するNode/npm/tsxでの実行結果を確認して確定する。APIテストはテスト専用Expressアプリに `/api/v1/todos` でRouterをマウントして実施し、必要に応じて実アプリの回帰テストも行う。HTTPサーバーとpoolを後処理で終了する。分離したテストDBを使用することを実行前に明示的に確認し、未確認の場合はDBテストを中止する。DBテスト間の干渉を避けるため、同一DBを使うテストは直列実行するか、各テストに独立した環境を用意する。障害試験やID枯渇試験は専用DBで実施し、本番用シーケンスを変更しない。

**確認コマンド：**

```bash
npm run build
npm test
git diff -- package.json tsconfig.json
```

**期待結果：** 全自動テストが成功し、終了コード0。既存3スクリプトを維持。以下の検証表に未実施・失敗がないことを確認する。

| 対象 | 必須確認内容 |
| --- | --- |
| REQ-01 | 200・空配列、日時とIDの降順、API日時キーとDB列名の変換、HEAD、no-store、条件付きGETでも304にならないこと |
| REQ-02 | 201、1/100/101コードポイント、trim・絵文字・禁止文字・正規化なし・同名・両日時一致、999件からの同時登録・上限409・削除後登録・ID枯渇500 |
| REQ-03 | 200、双方向・同一状態時の日時不変・他項目不変、不正ID、存在しないID404、競合更新・削除 |
| REQ-04 | 204・空本文、他行保持、再削除404、ID非再利用 |
| 入力・HTTP | 400/404/405/409/413/415/422/500/503、空本文・不正JSON・不正UTF-8・非オブジェクト、8,192/8,193バイト、Content-Type・charset・圧縮、ID上下限・形式、クエリ、禁止キー、HEAD・OPTIONS・Allow、エラー判定順序 |
| DB・障害・安全性 | 20秒DB期限と25秒サーバー期限、接続枯渇・ロック待ち・ROLLBACK/解放/破棄、500/503分類、SQL注入対策、指定ログ項目・秘密情報除外、DB未設定時の起動エラー・起動時の既存データ維持 |
| ブラウザ通信 | 期待ステータス・JSON構造・204・非JSON応答、30秒期限、変更の自動再試行なし（自動または後工程の手動で確認） |

**失敗時に最初に見る場所：** 失敗したテスト名とアサーション、対応する実装ファイル、テストDBの分離状況、セットアップ・後処理・並行実行設定、テストのタイムアウト。テストを無効化して通過扱いにしない。

### 工程18：Localで画面・API・既存ルートを総合確認する

**対象ファイル：** `index.ts`、TODO関連のTS・JS・EJS・CSS、`docs/todo/04_test_results.md`（記録用に新規作成）。

**作業内容：** Chrome・Edgeの最新版、PC・スマートフォン相当の画面幅、キーボード操作で受け入れ条件を確認する。初期・空・取得中・エラー、入力の保持・クリア、二重操作防止、削除キャンセル、HTMLの安全な表示、操作成功後の再取得失敗、通信切断・非JSON・タイムアウト、古い応答の競合を確認する。通信異常は開発者ツールや分離DBのテスト環境で再現する。ID上限・DB障害等を共有DBで試さない。既存ルートを再比較し、ビルド済み起動も確認する。

**確認コマンド：**

```bash
npm run build
npm test
npm run dev
```

別ターミナル：

```bash
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/db-check
curl -i http://localhost:3000/todo
curl -i http://localhost:3000/api/v1/todos
curl -I http://localhost:3000/api/v1/todos
curl -i -X OPTIONS http://localhost:3000/api/v1/todos
curl -i -X PUT http://localhost:3000/api/v1/todos
curl -i 'http://localhost:3000/api/v1/todos?unknown=1'
curl -i http://localhost:3000/api/v1/todos/unknown/extra
```

**期待結果：** 既存2ルートは基準と一致。TODO画面・一覧は200、HEADは本文なし、OPTIONSは204とAllow、PUTは405とAllow、クエリ不正は400、未定義パスは404。要件の受け入れ条件、共通要件、画面確認が全て合格し、結果書に証跡と実測値を記録する。

**失敗時に最初に見る場所：** ブラウザConsole・Network、サーバーログ、対象REQのController/Model・画面状態管理、テスト結果。HTML/CSSだけの問題か、通信・DBの問題かを切り分ける。

### 工程19：公開環境の設定を確認し、共有Neon DBへ手動適用する

**対象ファイル：** `sql/todo/020_create_todo_tasks.sql`、`sql/todo/README.md`（参照）、Vercelの実際の設定（要確認）、必要な場合のみ設定ファイル・既存コード。

**作業内容：** Local合格後、Vercelの既存デプロイ方式、Preview/Productionの環境変数、実行時間上限、EJS・静的アセットの同梱方式を確認する。PreviewとProductionが同一のNeon DBを参照し、テストDBとは分離されていることを確認する。接続情報を表示・記録しない。Vercelによる自動Previewデプロイが先行しても、共有DB準備が完了するまで受け入れ確認を開始しない。SQL Editorで工程03と同じ確認を行い、共有DBに `todo_tasks` と旧案の `todos` のどちらも存在しないことを確認できれば、Git保存済みのDDLを手動適用する。いずれかが存在する場合は定義と既存データを確認し、必要に応じて互換性のある変更として別途計画する。共有DBを初期化しない。Vercelの設定変更が必要な場合は理由を記録し、既存ルートを維持する最小差分とする。

**確認コマンド：**

```bash
npm run build
git status --short
git diff --check
```

Neon SQL Editor（適用前および適用後に工程03の確認SQLを使用）：

```sql
SELECT current_database(), current_schema(), current_user;
SELECT to_regclass('todo_tasks') AS existing_todo_tasks,
    to_regclass('todos') AS legacy_todos;
```

Vercel設定の確認は管理画面で行う。現時点でCLI導入や設定ファイルの存在を前提としない。

**期待結果：** 共有DBに設計どおりのテーブル・制約・インデックスが用意され、既存データを保持。Preview/Productionの接続先が一致し、公開環境の実行上限が25秒のAPI期限を妨げない構成を確認できる。設定と適用結果を記録する。

**失敗時に最初に見る場所：** Neon SQL Editorの接続先・エラー、Vercelの環境変数適用範囲、プロジェクト設定とビルドログ。既存アプリへの影響が疑われる場合は公開を止める。

### 工程20：Vercel Previewで確認する

**対象ファイル：** デプロイ対象の実装、必要な公開設定、`docs/todo/04_test_results.md`。

**作業内容：** VercelのPreview URLを取得し、既存ルート、画面、JS/CSS、4操作と永続化を確認する。自動テストは分離DBで全て成功した状態とする。共有DBでは正常系と非破壊の確認のみ実施し、架空の確認用TODOだけを操作する。共有確認に使うTODOのIDを記録し、Production確認まで残す。他の確認用データは自分が作成したものだけ削除する。

**確認コマンド：**

```bash
# 管理画面で確認したPreview URLに置き換える（末尾の / は除く）
PREVIEW_URL='https://YOUR-PREVIEW-URL.invalid'
curl -i "$PREVIEW_URL/"
curl -i "$PREVIEW_URL/api/db-check"
curl -i "$PREVIEW_URL/todo"
curl -i "$PREVIEW_URL/todo/todo.js"
curl -i "$PREVIEW_URL/todo/todoApi.js"
curl -i "$PREVIEW_URL/todo/todo.css"
curl -i "$PREVIEW_URL/api/v1/todos"
```

4操作は工程14〜16のコマンドのベースURLを置き換え、ブラウザでも確認する。Previewにアクセス保護がある場合は承認された方法でアクセスし、保護を勝手に解除しない。

**期待結果：** Vercelのビルド成功。許可されたアクセスで既存ルート200、画面・静的アセット200、各APIが200/201/200/204。リロード後も永続化される。Production公開前の受け入れ条件と自動テストが合格し、結果が記録されている。

**失敗時に最初に見る場所：** Vercelのビルド・関数ログ、`DATABASE_URL`のPreview適用範囲、EJSのパス・成果物への同梱、静的アセット、Router登録。未合格ならProductionへ進まない。

### 工程21：Vercel Productionで確認し、テスト結果を確定する

**対象ファイル：** デプロイ対象の実装、`docs/todo/04_test_results.md`。

**作業内容：** Preview合格後、既存のProduction公開手順に従う（具体的なブランチ昇格・マージ方式はVercel設定により要確認）。Production URLで既存ルートとTODOの4操作、画面表示を確認する。Previewで登録した架空のTODOをProductionで取得し、Productionで完了状態を変更してPreviewを再読込し反映を確認する。Productionで削除した後、Previewでも消失することを確認する。確認に使用した自分のデータのみ削除する。混入データや既存データは操作しない。なお、Preview/Productionの同時アクセスをリアルタイム同期する要件ではない。

**確認コマンド：**

```bash
# 管理画面で確認したProduction URLに置き換える
PRODUCTION_URL='https://YOUR-PRODUCTION-URL.invalid'
curl -i "$PRODUCTION_URL/"
curl -i "$PRODUCTION_URL/api/db-check"
curl -i "$PRODUCTION_URL/todo"
curl -i "$PRODUCTION_URL/api/v1/todos"
curl -i "$PREVIEW_URL/api/v1/todos"
```

4操作は確認対象IDを明示したうえで工程14〜16のコマンドのベースURLを置き換えて実施する。画面操作、アセット、デプロイ設定・共有DBの互換性も確認する。

```bash
git diff --check
git status --short
```

**期待結果：** Productionの正常系、既存機能、両環境でのデータ共有・互換性を確認できる。全受け入れ条件、自動テスト、環境別確認が合格し、確認データの後処理と結果記録が完了する。要件定義書4.1のリリース条件を満たす。

**失敗時に最初に見る場所：** Vercel Productionのデプロイ・関数ログ、環境変数適用範囲、Previewとのデプロイ差分、Neonの同一DB・互換性。DBの破壊的な変更で復旧しない。必要に応じて互換性を保てる前のデプロイに戻す方針を検討する。

## 3. 変更単位と完了判定

| 要件ID（要件定義書2章） | Model工程 | Controller・Router工程 | 画面工程 | 確認工程 |
| --- | --- | --- | --- | --- |
| REQ-01 一覧表示 | 07-a | 08・09 | 12・13 | 17・18・20・21 |
| REQ-02 登録 | 07-b | 08・09 | 12・14 | 17・18・20・21 |
| REQ-03 完了状態の部分更新 | 07-c | 08・09 | 12・15 | 17・18・20・21 |
| REQ-04 削除 | 07-d | 08・09 | 12・16 | 17・18・20・21 |

完了判定には `01_requirements.md` の該当REQの受け入れ条件、共通要件および環境別確認を使用する。本書は新たな要件を定義しない。設計書5.1〜5.4のAPI仕様と照らし、各操作の実測結果を `04_test_results.md` に記録する。

工程01・03・19の手動作業、工程20・21の公開確認は、コード変更とは別に結果を記録する。SQLのGit登録と実DBへの適用は同じコミットの結果と見なさない。各コード変更は対象ファイルのみをステージして差分を確認し、意味のある単位でコミットする。既存ブランチ `feature/todo-app` を使用し、他ブランチへのマージは公開手順が確定するまで行わない。

| 区分 | 完了条件 |
| --- | --- |
| DB準備 | Git管理済みSQLと分離DBへの適用結果が記録されている。 |
| API実装 | REQ-01〜REQ-04、補助HTTP操作、共通検証・応答・期限が合格している。 |
| 画面実装 | TodoApi経由で4操作が行え、エラー・競合・操作性の条件を満たす。 |
| 回帰・テスト | 既存ルート維持、ビルド、全自動テスト、Local確認が合格している。 |
| 公開 | Preview合格後にProductionを確認し、共有DB・既存機能・秘密情報の扱いを確認している。 |
| 記録 | `04_test_results.md` に対象コミット、環境、実施日、確認方法、期待結果、実測結果、合否、未解決事項を記録している。 |

## 4. 要確認事項と本書の範囲

設計書8章の要確認事項を次の工程開始条件に引き継ぐ。決定事項と確認結果は記録し、未確認のまま該当工程を実行しない。

| 設計書No. | 確認事項 | 工程開始条件・本計画の案 |
| --- | --- | --- |
| 1 | APIの日時キー | 工程04前：要件定義書3.1の `created_at`・`updated_at` と設計書の `createdAt`・`updatedAt` の差異を確認。要件定義書は改変しない。本計画はcamelCase案で記載する。 |
| 2 | 画面ルートの登録方式 | 工程08・11前：API専用Routerと `index.ts` の `app.get("/todo", renderTodoPage)` を採用するか、画面専用Routerを分けるか確認。 |
| 3 | 自動テストの配置 | 工程04前：`src/apps/todo/tests/` の案と旧 `tests/todo/` のどちらにするか確認。テスト名・追加設定・実行スクリプトも実装時に検証する。 |
| 4 | 既存テーブル | 工程03・19前：Neonで `todo_tasks`・旧 `todos` の有無を確認。既存データがあれば無断で削除・改名・移行しない。 |
| 5 | Vercel | 工程19前：実際の設定・デプロイ方式・関数実行時間上限・EJSとpublicの同梱方式・公開手順を確認。 |
| 6 | テスト用DB | 工程01・03・17前：Preview/Productionとの分離を確認。未確認ならDBテストや変更を中止する。 |
| 7 | 実装計画書への反映 | 本書で改訂設計案を反映済み。上記の未確定事項の決定後、該当工程とテストを再照合する。 |

SQL適用手順の補足ファイル `sql/todo/README.md` は計画上の追加提案であり、工程02前に配置を確認する。
- 本書は実装計画のみ。コード変更、SQL実行、テスト実行、実際のデプロイは未実施であり、記載した期待結果は実測ではない。
