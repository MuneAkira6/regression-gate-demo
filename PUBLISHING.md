# PUBLISHING.md

Everything a person needs to decide before this repository is made public. The checklist below has
items only a human can settle; they are marked **要判断** and none of them should be resolved by an
agent.

## Description

> A Playwright regression suite tied to a manual test sheet by case id, a coverage report whose
> denominator is that sheet, and a quality gate that tells four kinds of red apart — a new red, a
> declared one, one that crossed a redeployment, and a declared one that has gone green.

Japanese, if a Japanese description is wanted:

> 手動回帰テストシートを分母にしたカバレッジ報告と、赤いテストを四つに分類する品質ゲートの実装例。
> 新しい赤／申告済みの赤／再デプロイをまたいだ実行／緑に戻った申告を区別します。

## Topics

```
playwright  regression-testing  quality-gate  test-automation  test-coverage
e2e-testing  typescript  nodejs  qa  vitest
```

## 公開前チェックリスト

### 要判断 1 — `test/**` が lint と typecheck の対象外です

**事実。** 与えられた `tsconfig.json` の `include` は `["apps", "tools", "tests", "playwright.config.ts"]`、
`biome.json` の `includes` は `["apps/**", "tools/**", "tests/**", "playwright.config.ts"]` です。どちらも
`tests` を含み、`test` を含みません。SCOPE.md は Vitest の自己テストを `test/` に置くと定めているため、
次の 4 ファイルはどちらのコマンドからも見えていません。

- `test/stable-read.test.ts`
- `test/coverage-report.test.ts`
- `test/gate.test.ts`
- `vitest.config.ts`

測定結果として、`tsc --noEmit --listFiles` の出力に 4 ファイルとも現れず、`pnpm exec biome check <file>` は
それぞれ `Checked 0 file` を返します。

**影響。** 中身が未検証というわけではありません。`pnpm test` が 34 件すべてを実行して通しています。ただし
型の誤りは `pnpm typecheck` ではなく実行時に出ます。そして `test/gate.test.ts` は、ゲートの四つの分類と
四つの終了コードが正しいことを確かめる唯一の自動検査です。このリポジトリで最も重要なテストファイルが、
静的検査の外にあります。`pnpm lint` の `Checked 22 files` という表示を見た読み手は、おそらく逆の想定をします。

**なぜ直していないか。** `tsconfig.json` と `biome.json` はこの作業で変更してはいけない所与のファイルでした
（goal-brief.md の red line 6）。エージェントの側では直せません。

**直す場合の変更（これで全部です）。**

```jsonc
// tsconfig.json
"include": ["apps", "test", "tools", "tests", "playwright.config.ts"]
```

```jsonc
// biome.json
"includes": ["apps/**", "test/**", "tools/**", "tests/**", "playwright.config.ts"]
```

追加後は `pnpm lint` と `pnpm typecheck` を走らせ、新しく見えるようになったファイルの指摘を解消してください。

### 要判断 2 — `goal-pack/` を今のまま公開するかどうか

`goal-pack/` はこの実行の監査記録です。契約（SCOPE.md）、台帳（PROGRESS.md）、レビューの全文
（BUS-REVIEWS.md）、レビュー側の記憶（BUS-MEMORY.md）が入っていて、**残す前提**のものです。各行の判定が
どの出力に基づくのかを後から追えることが、このリポジトリの価値の一部だからです。

ただし、次のものがこのホストの情報として含まれています。公開してよいかどうかは公開する人の判断です。

| 対象 | 内容 | 実測 |
| --- | --- | --- |
| `goal-pack/PROGRESS.md` | このホストの絶対パス（アカウント名を含む）と、ブラウザ置き場のパス | `/home/<user>` 形式のパス 4 件、`ms-playwright` の言及 2 件、アカウント名 2 件 |
| `goal-pack/BUS-MEMORY.md` | 同上 | パス 1 件、`ms-playwright` 1 件、アカウント名 1 件 |
| `goal-pack/BUS-LOG.md` | エージェント実行のセッション識別子（UUID 1 件） | UUID 1 件 |
| `goal-pack/BUS-REVIEWS.md` | レビュー全文 4 件。絶対パス・アカウント名・UUID は検出されませんでした | 0 件 |

`goal-pack/` 以外のファイル（`README.md`、`apps/`、`tools/`、`tests/`、`test/`、`catalog/`、
`known-reds.yml`、`.github/`、設定ファイル）には、絶対パスもアカウント名も含まれていません。これは測定して
確認しています。

選択肢は三つあります。

1. そのまま公開する — 監査記録としては最も価値が高く、ホストのアカウント名とパスが公開されます。
2. パスとアカウント名と UUID を伏せ字にして公開する — 証拠の引用は残り、ホストの情報は消えます。行番号や
   コマンド出力の対応が一部読みにくくなります。
3. `goal-pack/` を公開対象から外す — README の「作り方」のリンクが切れるので、外す場合はそのリンクも
   直してください。

なお、資格情報・トークン・パスワードに相当するものは含まれていません（要判断 3 の走査で確認します）。
プロキシ設定は環境変数から来るもので、どのファイルにも書かれていません。

### 要判断 3 — 公開前に木全体の漏えい走査を一度

公開の直前に、作業ツリー全体（`goal-pack/` と `.github/` を含み、`node_modules/` を除く）を一度走査して
ください。エージェントの走査は目的を絞ったもので、これの代わりにはなりません。

見るもの: 資格情報・API キー・トークン・パスワード・秘密鍵、社内ホスト名や内部 URL、個人名やメールアドレス、
このホストの絶対パス、セッション識別子。`git log` と、公開時に履歴を持っていく場合は過去のコミットの中身も
対象です。

`gitleaks detect --no-git` や `trufflehog filesystem .` のような専用のツールを使うのが確実です。

### 公開前の機械的な確認

以下はコマンドで確かめられます。括弧内はこのリポジトリで確認済みの結果です。

- [ ] `git diff --stat -- LICENSE` が空であること（空。MIT License のまま変更していません）
- [ ] `pnpm install --frozen-lockfile`（`Done in 401ms using pnpm v11.28.0`、exit 0）
- [ ] `pnpm lint`（`Checked 22 files`、exit 0）
- [ ] `pnpm typecheck`（出力なし、exit 0）
- [ ] `pnpm test`（`Tests  34 passed (34)`、exit 0）
- [ ] `pnpm gate`（`0 NEW RED, 0 INCONCLUSIVE, 1 KNOWN RED, 0 WENT GREEN`、exit 0）
- [ ] `pnpm coverage`（`overall 23 21 1 1 95.5%`、gaps なし・orphans なし、exit 0）
- [ ] `pnpm e2e` が **exit 1** で終わること（21 件中 TB-011 のみ赤。これは想定どおりで、直す対象では
      ありません。理由は README の「動かし方」と「制約・既知の限界」にあります）
- [ ] `reports/` と `test-results/` が `.gitignore` に入っていること（入っています）
- [ ] `reports/gate.json` が本物のスイートの結果であること。`pnpm test` はゲートの実体を走らせるので
      このファイルを上書きします。必要なら公開前に `pnpm gate` を走らせ直してください
- [ ] 18430〜18439 で何も待ち受けていないこと（`ss -ltnp | grep -E ':184[3][0-9] '` が空）

### 公開後の設定

- [ ] 上の Description と Topics を設定する
- [ ] CI（`.github/workflows/ci.yml`）は `workflow_dispatch` のみです。マージごとには走りません。これは
      意図した設計で、理由はワークフロー内のコメントと README の「設計」にあります。バッジを出したい場合は
      トリガーを増やす前に、`e2e` ステップが `continue-on-error: true` である理由を読んでください
- [ ] Actions を有効にした場合、初回は手動で一度起動して緑になることを確認する
