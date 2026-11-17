# TODO V1 一覧・登録の実装と確認手順

対象ブランチ：`feature/todo-app`。対象：REQ-01、REQ-02。REQ-03、REQ-04のAPIおよび画面操作は未実装。
根拠：`01_requirements.md`、`02_design.md`（fa6f28f）、`03_implementation_plan.md`（57ec8b9）。

## 変更ファイルと理由

| ファイル | 変更理由 |
| --- | --- |
| `index.ts` | API Routerと画面用Controllerのimport・登録を4行追加。既存TOP、DB接続確認、静的配信、EJS、起動処理を維持する。 |
| `src/apps/todo/todoTypes.ts` | DB行（snake_case）とAPI（camelCase）の型を分ける。 |
| `src/apps/todo/todoError.ts` | TODO専用エラー形式・HTTPステータス・安全なログを統一する。 |
| `src/apps/todo/todoValidator.ts` | メディアタイプ、本文サイズ・UTF-8・JSON、クエリ、タイトルを検証する。 |
| `src/apps/todo/todoDb.ts` | 既存poolを利用するトランザクション・20秒のDB期限・接続解放を扱う。 |
| `src/apps/todo/todoModel.ts` | 一覧SELECTと登録INSERT、登録上限と競合制御、日時キーの変換を担当する。 |
| `src/apps/todo/todoController.ts` | EJS描画、Model呼び出し、200/201のJSON応答を担当する。 |
| `src/apps/todo/todoRouter.ts` | GET/POSTとHEAD/OPTIONSを登録し、専用本文解析、25秒のAPI期限、404/405、エラー処理を提供する。 |
| `views/todo/index.ejs` | 一覧・登録フォーム・状態・エラーの画面骨格を作る。 |
| `public/todo/todo.js` | TodoApiクラスと画面イベントを同一ファイルに配置する。Fetch・API URL・応答処理はTodoApiに集約し、画面イベントはlist()/create()のみ呼び出す。従来の状態管理・再取得・期限処理を維持する。 |
| `public/todo/todo.css` | PC・スマートフォンでの表示、完了・未完了の識別とキーボードフォーカスを整える。 |
| `sql/todo/020_create_todo_tasks.sql` | リポジトリに未存在の設計書3章DDLを保存する。適用は別工程。 |
| `src/apps/todo/tests/validator.test.ts` | 入力検証とエラー分類を自動確認する。 |
| `src/apps/todo/tests/api.test.ts` | 分離DBでHTTP・永続化・同時登録の上限を自動確認する。 |
| `src/apps/todo/tests/todoApi.test.mjs` | ブラウザ向けTodoApiの送受信形式と再試行なしをモックで確認する。 |
| `docs/todo/implementation_list_create.md` | 変更理由、手順、確認状況、対象外を記録する。 |

`db.ts`、`tsconfig.json`、`package.json`、`package-lock.json`、既存の要件定義書・設計書・実装計画書は変更しない。依存の追加も行わない。

## 適用手順

既存の `feature/todo-app` を使用する（新規ブランチを作成しないという既存の指示に従う）。作業前に差分を確認し、既存作業を上書きしないこと。提供ZIPは変更対象のみを含む。パッチは未適用の元のリポジトリ向け。旧パッチを適用済みの場合は、差分を確認して旧todoApi.jsを除去し、今回変更されたtodo.js、テスト、手順書のみ更新する。パッチをプロジェクト直下に置いた場合は次で適用できる。

```bash
git branch --show-current
git status --short
git apply --check todo_v1_list_create_integrated.patch
git apply todo_v1_list_create_integrated.patch
git diff --check
```

### 工程1：SQLのGit保存

まずSQLファイルだけを確認する。実DBへの変更はまだ実施しない。

```bash
git add sql/todo/020_create_todo_tasks.sql
git diff --cached --check
git diff --cached -- sql/todo/020_create_todo_tasks.sql
```

必要に応じてSQLのみをコミットする。別のステージ済み変更があれば混ぜない。

### 工程2：Neon SQL Editorで手動適用

テスト・開発専用の分離DBを管理画面で識別する。次をSQL Editorで実行する。

```sql
SELECT current_database(), current_schema(), current_user;
SELECT to_regclass('todo_tasks'), to_regclass('todos');
```

対象が正しく、既存の `todo_tasks` も旧案の `todos` も存在しないことを確認した場合のみ、020 SQLを全文貼り付けて実行する。既存テーブルが存在する場合は定義を照合し、勝手な削除・改名・移行は行わない。

```sql
SELECT column_name, data_type, is_nullable, is_identity, datetime_precision
FROM information_schema.columns
WHERE table_schema = current_schema() AND table_name = 'todo_tasks'
ORDER BY ordinal_position;
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = current_schema() AND tablename = 'todo_tasks';
SELECT COUNT(*) FROM todo_tasks;
```

期待：5列、降順インデックス、初回0件。失敗時はNeonの選択ブランチ・DB・権限・SQLエラーを確認する。

### 工程3：ビルド、起動、既存機能

分離DBの `DATABASE_URL` を既存の `.env` 等で設定する。接続情報をGitに入れない。

```bash
npm ci
npm run build
npm run dev
```

別ターミナル：

```bash
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/db-check
curl -i http://localhost:3000/todo
curl -i http://localhost:3000/api/v1/todos
```

期待：`/` は従来の200・`2026-11-10 test`、`/api/db-check` は200・従来のJSON、`/todo` は200のHTML、一覧は200・空DBなら `{"data":[]}`。失敗時は `index.ts` の登録位置・import、`db.ts` の接続先、`todoRouter.ts`、EJSのパスを確認する。

### 工程4：登録と再取得

```bash
curl -i -X POST http://localhost:3000/api/v1/todos -H 'Content-Type: application/json' --data-binary '{"title":"  Sample task  "}'
curl -i http://localhost:3000/api/v1/todos
curl -i -X POST http://localhost:3000/api/v1/todos -H 'Content-Type: application/json' --data-binary '{"title":""}'
curl -i -X POST http://localhost:3000/api/v1/todos --data-binary 'invalid'
```

期待：登録201、`title` は `Sample task`、`completed` はfalse、`createdAt` と `updatedAt` が同一。GETで取得可能。空文字422、メディアタイプ違反415。Chrome/Edgeで `/todo` を開き、空表示、登録、入力欄クリア、再読み込み後の永続化、失敗時の入力保持を確認する。失敗時はNetwork、`todo.js`、Validator、Model、SQL Editorを確認する。

## テスト

実DBテストの準備がなくても単体テストは実行可能。

```bash
npx tsx --test src/apps/todo/tests/validator.test.ts
node --test src/apps/todo/tests/todoApi.test.mjs
```

実DB結合テストは、共有DBではない空の専用テーブルに020 SQLを適用してからのみ実行する（最大1,000件を一時作成する）。実行前に接続先を目視確認し、アプリの開発サーバーを止め、他のテストや利用者が同じテーブルを変更していない状態にする。テスト自身が作成したIDだけを削除するが、異常終了時はデータが残る可能性がある。ID採番は巻き戻さない。Git Bash等の例：

```bash
TODO_ISOLATED_TEST_DB=yes npx tsx --test src/apps/todo/tests/api.test.ts
```

PowerShellの例：

```powershell
$env:TODO_ISOLATED_TEST_DB = 'yes'
npx tsx --test src/apps/todo/tests/api.test.ts
Remove-Item Env:TODO_ISOLATED_TEST_DB
```

## 現時点の確認状況と未確定事項

- Node 22.16.0・環境内ts-nodeのtranspile-onlyによるValidator/エラー分類テスト5件、TodoApiの通信モックテスト1件が成功。今回の統合後は通信・画面イベントのモックテスト2件が成功。実DBテストはスキップ。TypeScriptの構文変換およびブラウザ用JSの構文確認を実施した。
- 実ファイルの依存関係による `npm ci`、`npm run build`、型検査、Express/EJS起動、Neonへの適用、DB通信や期限処理の実動作、ブラウザ表示、Vercelは未検証。テストの追加と実行を経てから完了判定する。
- 日時のJSONキーは改訂設計案に従いcamelCase（要件書の日時項目名との差異は未解消）。画面ルート登録方式と自動テスト配置は改訂設計案の推奨方式を採用した。今回の指示に従い、設計書の分離案と異なりTodoApiをtodo.js内に集約し、別ファイルtodoApi.jsは配布対象から除外した。EJSは従来のmodule読み込みで接続する。要件書・設計書は変更していない。
- 既存poolの設定を変更していないため、接続取得待ちの内部処理が期限後まで残る場合は遅れて取得したクライアントを解放する方式とした。20秒期限、物理接続の破棄および接続枯渇防止は実DBで検証が必要。
- 今回は一覧・登録だけなので、ID付きAPIパスは未定義（404）、コレクションの未対応メソッドは405とし、AllowはGET/POST/HEAD/OPTIONSのみ。PATCH・DELETEは後工程。テストの後処理に用いるSQLのDELETEはアプリの削除機能ではない。
- GitHubへのコミット・プッシュ、Neonへの手動SQL適用は未実施。
