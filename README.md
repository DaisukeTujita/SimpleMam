# SimpleMam

OpenMamの業務機能を、Next.js App Router・Material UI・FastAPIで実装する簡易版です。
既存SQL Serverへ直接接続します。DBアダプター、デモ、Storybook、MXFプレイヤーはありません。

## 起動（Windows）

1. Node.js 24 LTS、Python 3.11以上、Microsoft ODBC Driver 17または18 for SQL Serverをインストールします。nginxを使う場合はnginxもインストールします。
2. `setup-simplemam.bat` を実行します。依存関係をインストールし、Next.jsを本番用にビルドします。
3. 作成された `simplemam.toml` のDB接続、メディアフォルダー、アップロードフォルダー、nginx.exeのパスを設定します。
4. `start-simplemam.bat` を実行します。通常は `http://localhost:8080/pc/materials` です。
5. `stop-simplemam.bat` で停止します。変更後は再度セットアップでビルドしてください。

スクリプトはDB接続確認後にNext.jsとnginxを起動します。既にポートが使用中の場合や起動に失敗した場合は終了します。
停止対象は起動時に記録したPIDと開始時刻が一致するSimpleMamのプロセスだけです。
本番用の `simplemam.toml`、セッション署名鍵、ログ、受信ファイルはGitへ登録しません。
Windows統合認証やUNC共有の権限には、スクリプトを実行するWindowsアカウントが使われます。

ODBC Driver 17を使用する場合は、`simplemam.toml` の `[database]` に
`driver = 'ODBC Driver 17 for SQL Server'` を指定してください。サンプルの既定値は18です。
SQLの実行タイムアウトはpyodbcの接続オブジェクトに30秒を設定します。

### nginxなしで起動

セットアップとTOMLのDB・メディア設定を済ませた後、`start-simplemam-no-nginx.bat` を実行します。
FastAPIとNext.jsを起動し、通常は `http://127.0.0.1:3000/pc/materials` を開きます。
起動ポートはTOMLの `backend_port` と `frontend_port` を使います。nginxのインストールや設定は不要です。
`.env.local` を手動で作る必要もありません。APIとサムネイル・HLSはNext.jsの標準のrewritesで転送します。

最初の起動時、またはバックエンドのホスト・ポートを変更した場合は、必要に応じて一度だけ本番ビルドを作り直します。
その後は既存ビルドで起動します。Next.jsは開発モードではなく本番モードです。
停止は共通の `stop-simplemam.bat` を使います。nginxあり／なしを切り替える際も、先に停止してください。
ソース更新後は、従来どおり `setup-simplemam.bat` で再ビルドしてください。

### 起動に失敗した場合

起動バッチは失敗した処理とバックエンド／フロントエンドのエラー末尾を表示します。
`var/log/startup.log` に起動処理のエラー、`var/log/backend.stderr.log` にDBドライバーなどの詳しいエラーが残ります。
`simplemam_*.log` には失敗した段階とSQLSTATEを記録します。
APIは受信時の `RECEIVE` と応答時の `RESPONSE` を同じリクエストIDで記録し、応答にはステータスと所要時間を付けます。
503のDBエラーには、DBドライバーの具体的なメッセージ、SQLSTATE、失敗したSQL、アプリ内のファイル・行番号・関数を記録します。
ブラウザーのNetworkタブで失敗したAPIの `X-Request-Id` 応答ヘッダー、またはJSONの `request_id` を確認し、同じIDをログで検索してください。
SQLパラメーター一覧、APIのクエリ文字列・本文・Cookieは記録せず、設定されたDBパスワードは伏せます。
SQL本文は最大8000文字で記録します。SQLの値は文字列に埋め込まず、引き続きバインドパラメーターで渡してください。
バックエンドを手動起動した場合も、アプリログはTOMLの `[logging].folder` に出力されます。
以前の状態ファイルだけが残り、記録したプロセスが停止済みなら、その記録を除いて再起動します。

nginxなしでもSQL Serverへの接続は必要です。DB接続に失敗すると、フロントエンドを起動する前に終了します。
`simplemam.toml` の `[database]` にある接続先・DB名・ODBCドライバー名・認証方式を確認してください。
`trusted_connection = true` はバッチを実行するWindowsアカウントでの認証です。
SQL Serverのユーザー名・パスワードで接続する場合は `trusted_connection = false` にして `username` と `password` を設定します。
`IM002` や「ドライバーが見つからない」の場合は、インストール済みODBCドライバーと `driver` の指定を合わせてください。
サンプルはDriver 18です。Driver 17の環境では `driver = 'ODBC Driver 17 for SQL Server'` に変更します。
TOMLのDB設定を変更しただけなら、セットアップやフロントエンドの再ビルドは不要です。
サンプルは `encrypt = true` と `trust_server_certificate = false` を明示するため、Driver 17でも証明書を検証します。
証明書エラーの場合はSQL Serverの証明書とクライアントの信頼設定を確認してください。

## 構造

| 場所 | 役割 |
|---|---|
| `frontend/src/app/pc/` | PCのURL、共通枠、各画面と画面専用部品 |
| `frontend/src/app/mobile/` | スマホのURL、共通枠、各画面。PCはここを参照しない |
| `frontend/src/app/login/` | ログインとグループ選択 |
| `frontend/src/components/` | 固定メニュー、素材詳細、運行表など端末に依存しない部品 |
| `frontend/src/lib/` | API通信と型、日付・URLの処理 |
| `frontend/src/theme.ts` | MUIのテーマ |
| `backend/app/routers/` | FastAPIのAPI入口 |
| `backend/app/services/` | 素材・番組・運行表のSQLと業務処理 |
| `backend/app/db.py` | SQL Server接続とSQL計測 |
| `backend/app/auth.py` | 認証、署名Cookie、グループ権限 |
| `infra/` | nginx設定 |
| `scripts/` | 起動・停止・セットアップ |

共有部品はPC/スマホの画面をimportしません。スマホが不要なら `frontend/src/app/mobile/` を削除して再ビルドできます。
メニューは `frontend/src/components/side-menu.tsx` の配列で定義します。子メニューや選択番組の動的追加はありません。
PCの折りたたみはMUIのMini drawer方式で、開閉状態をlocalStorageに保存します。

画面を追加する場合は、たとえば `frontend/src/app/pc/reports/page.tsx` を作り、
`side-menu.tsx` の配列に `{ label: 'レポート', path: '/reports', Icon: ReportIcon }` を1件追加します。
共通枠やルーターの登録は不要です。スマホにも必要な場合だけ `app/mobile/reports/page.tsx` を作ります。

## 機能

- ログイン → グループ選択 → 素材・番組検索。グループ変更には再ログインが必要です。
- 素材検索：作成日、名称、素材番号、カテゴリ、ジャンル、登録経路、状態、種別。
- PCは一覧／サムネイル切り替えと右側の詳細、スマホは2列カードと詳細ダイアログ。
- 素材詳細：サムネイル、HLS、使用番組。名称・カテゴリ・ジャンル・素材内容・引継ぎメモを編集できます。
- 番組検索：PCは一覧＋運行表プレビュー、スマホはカード一覧。詳細ページへ通常のリンクで移動します。
- 番組名、大項目名、小項目名の編集、大項目・小項目の追加・削除。
- 素材登録：FastAPI標準のmultipartアップロード。受信ファイルとメタデータを保存します。
- 編集ボタンは常時表示し、権限がなければ無効にします。一般利用者は同一グループのみ、管理者は全グループを扱えます。

素材登録はファイル受信だけです。DBへの素材登録・トランスコードは実施しません。
アップロード再開（tus）は採用していません。通信断後は最初から再送します。アプリ内のデモAPIはありません。
自動通知サービスはなく、更新ボタンで再取得します。運行表の移動・複製・素材割当は今回の初期実装には含めません。

## メディア配置

`M_SYSTEMS` / `M_SYSTEM_SETTINGS` と `T_MATERIAL_FILES` は参照しません。
以下の配置だけを使います。ファイル名はTOMLで変更できます。素材種別によるパス分岐はありません。

| 種類 | 配置例 | 配信URL |
|---|---|---|
| サムネイル | `thumbnail_root/MAT-001/thumbnail.jpg` | `/media/thumbnails/MAT-001/thumbnail.jpg` |
| HLS | `hls_root/MAT-001/index.m3u8` | `/media/hls/MAT-001/index.m3u8` |

HLSから参照するプレイリスト・セグメントも同じ素材番号フォルダー配下に置き、相対URLで参照してください。
メディアURLは認証なしでアクセスできます。フォルダーは既存のローカルフォルダーまたはUNC共有を指定します。

## DBの前提

対象はOpenMamの `basic_sqlserver` が参照する既存DB定義です。テーブル作成・変更・データ投入は行いません。
素材番号のサブ番号はAPI・検索・SQLから除外しています。既存DBの列を物理的に削除する処理はありません。

- `T_MATERIAL_VERSIONS.material_number` は素材番号単位で一意である必要があります。重複は409エラーにし、勝手に一件を選びません。
- 素材IDは文字列としてAPIから返します。タイトルのNULLは空文字、尺のNULLは未設定として表示します。尺はフレーム数（30フレームで1秒）です。
- 番組は番組ID＋放送日で検索します。NULLと9999から始まる放送日は未定です。
- 既存の大項目・小項目テーブルは放送日を持ちません。同じ番組IDが複数放送日に存在する場合、共有ブロックへの更新を禁止します。参照はできます。
- 小項目IDはDBのIDENTITY、サブ番号を含む省略列はNULL許容またはDB既定値が必要です。
- 素材・名称変更は現在値を確認してから更新します。大項目削除は配下の小項目を論理削除してから大項目を削除し、同一トランザクションで確定します。
- 認証は `T_USERS`、`T_PASSWORDS`、`T_GROUPS`、`T_USERS_GROUPS` を使用します。管理者判定は `authority_flag` の末尾1桁です。
- パスワード形式はTOMLの `plain` または `double_md5` で既存形式に合わせます。値の書き換えはしません。

詳しい必要列は [DB仕様](docs/database.md) を参照してください。

## 開発と検証

バックエンド：`pip install -e './backend[test]'` → `uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000`。
設定ファイルは既定でリポジトリ直下の `simplemam.toml` を読みます。`SIMPLEMAM_CONFIG` で絶対パスを指定できます。
フロント：`frontend` で `npm ci` → `npm run dev`。直接Next.jsへアクセスする開発時は、`.env.local` に `SIMPLEMAM_BACKEND_URL=http://127.0.0.1:8000` を設定します。
通常運用はnginxを通し、ブラウザーの `/api/` と `/media/` をFastAPIへ振り分けます。

CIはPythonテスト、lint、型確認、本番ビルド、Playwrightの画面テスト、Windowsのスクリプト構文確認を実行します。
画面テストのHTTPモックは `frontend/tests/` 内だけで使い、アプリには含めません。実SQL ServerとWindows起動は実環境で別途確認が必要です。
