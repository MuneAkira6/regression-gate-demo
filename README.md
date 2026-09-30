# regression-gate-demo — Acme Tasks

A small, honest demonstration of a regression practice: a sample web app, a Playwright suite tied to a
manual test sheet by case id, a coverage report whose denominator is that sheet, and a quality gate that
tells four kinds of red apart — a new red, a declared one, one that crossed a redeployment, and a
declared one that has gone green. The sample app, **Acme Tasks**, is fictional. Everything the README
claims about this repository is quoted from its own runs.

---

## 何を示すか

このリポジトリが示したいのは、テストを増やす方法ではなく、**赤いテストの読み方**です。

一日に何度も再デプロイされる共有環境では、同じ失敗が四つの別のことを意味します。本当の退行かもしれませんし、
すでに理由が分かっている赤かもしれませんし、実行中に被テスト版が入れ替わっただけかもしれませんし、申告済みの
赤が緑に戻ったのかもしれません。この四つを混ぜてしまうと、ゲートは「また赤か」と読み流される置物になります。

そこで次の三つを、動くものとして置いています。

| もの | 役割 |
| --- | --- |
| `catalog/cases.csv` | 手動回帰テストシート。カバレッジの**分母**です |
| `tools/coverage-report.ts` | シートに対して何行が覆われているかを測ります（`pnpm coverage`） |
| `tools/gate.ts` | 失敗を四つに分類し、終了コードで答えます（`pnpm gate`） |

ゲートが正しく分類することは、文章ではなく**負の自己テスト**で示しています。四つの分類と四つの終了コードは、
すべて本物のゲートを本物の失敗する spec に対して走らせて出したものです。レポートを手で書いたものは一つも
ありません。

## 背景

題材にしている実務の状況は、次の二つでした（出典：[goal-pack/materials/practice.md](goal-pack/materials/practice.md)）。

- Web ポータルの回帰テストは手動が中心で、機能仕様書はあっても「どこまでテストされているか」を誰も数えて
  いませんでした。
- 共有のステージング環境を複数のチームが使い、一日に何度も再デプロイされます。テストの実行中に、被テスト版が
  入れ替わることがあります。

一つめは「分母がない」という問題で、二つめは「赤の意味が一つに決まらない」という問題です。このリポジトリは、
その二つにそれぞれ道具を一つ当てています。

実務側の数字はこの README には書きません。分量や規模については、事例のページをご覧ください。

## 設計

規則そのものより、**なぜその規則なのか**を残したいので、六つの規則をそれぞれ理由つきで書きます。例はすべて
この Acme Tasks です。

### 分母をテストではなくシートにする理由

書いたテストの数を数えると「どれだけ作ったか」は分かりますが、「あと何が残っているか」は分かりません。仕様の
側から作った目録に対して何行覆えているかを数えて初めて、覆っていない行が見えます。

`catalog/cases.csv` は 23 行あり、覆われているのは 21 行です。分母はテスト数の 21 ではなく、シートの
23 から対象外（`n/a`）の 1 行を除いた 22 行です。だから全体は 95.5% にとどまります。100% になりません。

`home` / `P1` の行が **0.0%** と出るのも意図どおりです。そこにある TB-003（カウンターの見え方を人の目で
確かめる項目）は自動化しない `manual` ですが、対象外ではないので分母に残ります。0.0% を隠す報告にしてしまえば、
その項目は誰の視界からも消えます。

`automated` の列は「シートで `ui` / `api` と書かれている行数」ではなく「**実際にテストが名乗っている行数**」
です。前者にすると割合は計画の読み上げになり、テストが消えても下がりません。実際この実装を一度そう書いてしまい、
同じ出力の中で `home P0 ... 2 automated ... 100.0%` と `gaps ...: TB-002` が並ぶという、この道具が防ぐべき
ものそのものを印字しました。いまは同じ入力で 50.0% と出ます。

対象外にした行は、あとで疑う対象です。TB-023（`POST /__admin/deploy`）は分母から外していますが、外したことが
「試していない」を意味しないように、ゲートの INCONCLUSIVE 用 fixture がこの経路を実際に叩いています。

### 再デプロイをまたいだ赤を退行として扱わない理由

ある spec ファイルを流している途中で被テスト版が入れ替わったなら、その実行結果はどちらのビルドについても
何も言っていません。それを退行として報告すれば、存在しない欠陥を追うことになります。緑として扱えば、本当の
欠陥を見逃します。どちらでもなく **INCONCLUSIVE**（判断不能）という答えが必要です。

ゲートは単位（spec ファイル）ごとに `GET /version` を前後で読み、`version` か `build` が動いていれば
そう判定して、同じビルドでの再実行を案内します。

```
unit 1/1  tests/fixtures/inconclusive/inconclusive.spec.ts
    version 1.4.0 (build 492e8bc977ef) -> 9.9.9 (build aff283bb098c)  <-- version under test CHANGED during this unit
    0 passed, 1 failed

INCONCLUSIVE — 1 (counts as a failure)
      advice: rerun this unit on one build: the version under test moved from 1.4.0 (build 492e8bc977ef) to 9.9.9 (build aff283bb098c) during this unit
```

判断不能は、失敗として数えます。「分からない」は「大丈夫」ではないからです。

この区別が本物であることは、一回のゲート実行で並べて示しています。`tests/fixtures/mixed/` には申告なしの赤が
二つあり、ビルドが動かなかった単位の TB-906 は **NEW RED**、途中で再デプロイした単位の TB-907 は
**INCONCLUSIVE** になります。違いは再デプロイの有無だけです。

### 緑に戻っても申告を自動で消さない理由

申告済みの赤が緑になったとき、それは「直った」とも「たまたま通った」とも読めます。どちらかを決めるのは人の
判断で、道具の仕事ではありません。自分でベースラインを書き換える道具は、いつか本物の退行を承認します。

ゲートは **WENT GREEN** として報告するだけで、`known-reds.yml` には触りません。

```
WENT GREEN — 1 (reported only)
      advice: verify on one build, then remove the declaration by hand; the gate never rewrites known-reds.yml
```

その単位で被テスト版が動いていた場合は、一言足します。版をまたいで緑になったことは、修正の証拠ではありません。

```
      advice: ... the gate never rewrites known-reds.yml — across a redeployment: not evidence of a fix (1.4.0 (build 5c92fb9d59d4) to 3.0.0 (build 4cb98b6d46f5))
```

「触らない」という説明が本当であることも自己テストで確かめています。宣言ファイルを実行の前後で読み、
1 バイトも変わっていないことを検証しています。

### 製品の判定を写したテストを緩めない理由

期待値は仕様から取ります。ソースコードは観察を説明するために読むだけで、期待値を下げる根拠にはしません。
ときどき赤くなるからといって期待値を緩めると、ユーザーに影響している欠陥を、測る側から消してしまいます。

このリポジトリで一番微妙なのは、この一組です。

| 用例 | 期待 | 結果 | 理由 |
| --- | --- | --- | --- |
| TB-011（UI） | テストメールが**送信される** | 赤 | それが仕様上の振る舞いです。このデモにメール送信の仕組みがないだけです |
| TB-021（API） | `POST /api/notifications/test` が 503 を返す | 緑 | 503 を返すこと自体が契約に書かれています |

同じ一つの事実が、API の層では正当な緑、製品の層では正当な赤になります。TB-011 の期待を「503 が返ること」に
書き換えれば `pnpm e2e` は静かになりますが、機能が動いていないという情報は同時に消えます。ですから期待値は
そのままにして、赤であることを `known-reds.yml` に理由と出典つきで**申告**しています。申告できるのは
「赤でも製品が壊れているわけではない」ものだけで、製品の欠陥を申告で隠してはいけません。

### retries を 0 にする理由

再試行で通ったテストは、通ったのではなく「二回目には通った」だけです。それを緑として報告すると、判断する人
から赤が見えなくなります。ですから `playwright.config.ts` の `retries` は 0 で、ゲートも各単位を
`--retries=0` で流します。

不安定さは再試行で隠すのではなく、待ち方を直して消します。それが次の項目です。

### カウンターを「安定した読み取り」で読む理由

不安定さの多くは、待ち方にあります。「読み込み表示が消えた」といった**状態**を待ってから値を読むと、描画途中の
値を読んでしまいます。

Acme Tasks のホームには、そのための不安定なコントロールをわざと置いています。`data-testid="today-counter"`
は 0 から未完了タスク数まで約 600 ms かけて数え上がり、途中の数字をすべて描画します。一回だけ読むと、その
瞬間には本当で、assert する頃には間違っている数字が返ります。実測した生の読み取りは次のとおりです。

```
TB-002 raw reads (consecutive duplicates collapsed): ["0","1","2","3","4"]
```

そこで状態を待つのではなく、**一致を待ちます**。`tools/stable-read.ts` の `readStable` は、同じ値が N 回
連続で返るまで読み直します。N はコントロールごとの性質なので `tests/controls.json` に置いてあり、この
カウンターは 3 です。

```
TB-002 readStable(n=3) returned "4"
```

これは sleep ではありません。sleep は落ち着くまでの時間を当てずっぽうで決めるので、短ければ間違った値を読み、
長ければ毎回その分だけ待ちます。連続一致は待ち時間の推測ではなく、根拠です。

## 動かし方

前提は Node 24 と pnpm です。ブラウザは Chromium だけを入れます。

```sh
pnpm i && pnpm exec playwright install chromium && pnpm test && pnpm gate
```

この 1 行は終了コード 0 で終わります。判定の権威は **`pnpm gate`** です。

生の回帰スイートだけを走らせたいときは、次のコマンドです。

```sh
pnpm e2e    # このリポジトリでは exit 1 になります（下記）
```

**`pnpm e2e` はこのリポジトリでは終了コード 1 で終わります。** 21 件のうち TB-011 が赤で、生のスイートには
「申告済み」という概念がないからです。赤があれば 1 を返すのが正しい振る舞いで、それを 0 に変えることは
測る側が嘘をつくことになります。申告済みの赤を許容できるのはゲートだけで、それがゲートの存在理由です。

ですから上の 1 行には `pnpm e2e` を入れていません。`&&` でつなぐと必ず `pnpm e2e` で止まり、唯一
「新しい赤」と「申告済みの赤」を区別できる `pnpm gate` に到達しないからです。実行が抜け落ちるわけでは
ありません。`pnpm gate` は `pnpm e2e` と同じ 6 つの spec ファイル・同じ 21 件を、1 ファイル 1 単位として
流します。変わるのは、どちらの終了コードを判定とみなすかだけです。

カバレッジ報告は次のコマンドです。ギャップも orphan もなければ 0、あれば 1 を返します。

```sh
pnpm coverage
```

ポートは既定で 18430 です（`PORT` で変えられます）。

## 結果

このリポジトリ自身の実行結果です。実務の数字ではありません。

### ゲート（`pnpm gate`）

```
Gate — Acme Tasks on http://localhost:18430
units: 6 spec file(s) under tests/ui, tests/api, one at a time in file-name order
known reds: known-reds.yml (1 declaration(s))

unit 1/6  tests/api/notifications.spec.ts
    version 1.4.0 (build dd98eaedf150) -> 1.4.0 (build dd98eaedf150)
    1 passed, 0 failed
...
unit 5/6  tests/ui/notifications.spec.ts
    version 1.4.0 (build dd98eaedf150) -> 1.4.0 (build dd98eaedf150)
    1 passed, 1 failed

KNOWN RED — 1 (not counted as a failure)
  case    unit                            test
  ------  ------------------------------  ------------------------------------------
  TB-011  tests/ui/notifications.spec.ts  TB-011 sends a test email to the recipient
      advice: This demo has no mail transport, so the test email cannot be sent. ... (source: goal-pack/SCOPE.md — the POST /api/notifications/test row of the route table, and "The suite"; declared 2026-09-30)

result: 0 NEW RED, 0 INCONCLUSIVE, 1 KNOWN RED, 0 WENT GREEN
exit 0
```

6 単位すべてが同じ `build dd98eaedf150` を前後で読んでいます。アプリは実行の最初に一度だけ起動して最後まで
立てたままです。`build` はプロセスごとに一度決まる値なので、単位のあいだに再起動すると再デプロイがなくても
すべてが INCONCLUSIVE になってしまいます。

### カバレッジ（`pnpm coverage`、exit 0）

```
Coverage against catalog/cases.csv — the denominator is the sheet, not the number of tests.

domain         priority  cases  automated  manual  n/a  coverage
-------------  --------  -----  ---------  ------  ---  --------
api            P0            7          7       0    0    100.0%
api            P1            5          4       0    1    100.0%
home           P0            2          2       0    0    100.0%
home           P1            1          0       1    0      0.0%
notifications  P0            1          1       0    0    100.0%
notifications  P1            1          1       0    0    100.0%
tasks          P0            4          4       0    0    100.0%
tasks          P1            2          2       0    0    100.0%
-------------  --------  -----  ---------  ------  ---  --------
overall                     23         21       1    1     95.5%

gaps    (a ui or api case with no test): none
orphans (a test id not in the sheet)   : none
```

### 件数

| コマンド | 結果 |
| --- | --- |
| `pnpm test`（自己テスト） | `Test Files  3 passed (3)` / `Tests  34 passed (34)`、exit 0 |
| `pnpm e2e`（生のスイート） | 21 件、`1 failed` / `20 passed`、exit 1 — 赤は申告済みの TB-011 だけです |
| `pnpm gate` | 6 単位、`0 NEW RED, 0 INCONCLUSIVE, 1 KNOWN RED, 0 WENT GREEN`、exit 0 |
| `pnpm coverage` | 23 行に対して 21 行、分母 22、95.5%、exit 0 |
| `pnpm lint` | `Checked 22 files`、exit 0 |
| `pnpm typecheck` | 出力なし、exit 0 |

`pnpm test` の 34 件のうち 12 件はゲートの負の自己テストです。四つの分類と四つの終了コード（0 / 1 / 2 / 3）を
すべて、本物のゲートを fixture に対して走らせて出しています。INCONCLUSIVE は、fixture のテストが自分の単位の
途中で `POST /__admin/deploy` を呼ぶことで作っています。報告を偽造してはいません。

実務での分量・規模については、こちらをご覧ください:
https://github.com/MuneAkira6/engineering-case-studies/blob/main/02-test-automation-and-quality-gates.md

## 制約・既知の限界

- **`@playwright/test` は 1.62.1 に固定しています。** このホスト（Ubuntu 20.04）では 1.63.0 の
  `playwright install chromium` が `ERROR: Playwright does not support chromium on ubuntu20.04-x64` で
  失敗します。1.62.1 は `chromium-1234` と headless shell を入れられ、ヘッドレスのページも開きます。
  上げないでください。
- **ブラウザは Chromium だけです。** ほかのブラウザは対象外です。
- **`pnpm e2e` は健全な状態でも exit 1 です。** 申告済みの赤が赤だからです。判定の権威は `pnpm gate` です
  （「動かし方」を参照）。
- **`reports/gate.json` は最後に走ったゲートのものです。** 自己テストもゲートの実体を走らせるので、
  `pnpm test` は本物のスイートの結果を上書きします。本物の結果が必要なときは `pnpm gate` を走らせ直して
  ください。
- **`pnpm lint` と `pnpm typecheck` は `test/**` と `vitest.config.ts` を見ていません。** 与えられた
  `tsconfig.json` と `biome.json` が `tests` を含めていて `test` を含めていないためです。この 2 ファイルは
  変更してよい対象ではなかったので直していません。中身が未検証というわけではなく、34 件は `pnpm test` が
  実行して通っていますが、型の誤りは `pnpm typecheck` ではなく実行時に出ます。判断が必要な項目として
  [PUBLISHING.md](PUBLISHING.md) の公開前チェックリストに載せています。
- 認証、永続化、実際のメール送信、Docker は対象外です。データはプロセス内のメモリだけに持ちます。
- 契約に削除の経路がないので、`POST /api/tasks` で作られたタスクはプロセスが生きているあいだ残ります。
  そのためタスク一覧の検査は「5 件ちょうど」ではなく「この 5 件がある」「期日なしは期日ありより後ろ」という
  関係で書いてあります。

## 作り方

このリポジトリは、**無人で走る goal-bus 方式のエージェント実行**で作りました。目標を G0〜G3 に分け、各目標の
受け入れ条件を先に台帳に書き、ワーカーが一行ずつ証拠（コマンドの出力と終了コード）を書き込み、別のレビュー側が
各目標の終わりに検査して PASS か REJECT を返す、という進め方です。

その台帳と契約はすべて [goal-pack/](goal-pack/) に残してあります。

- [goal-pack/SCOPE.md](goal-pack/SCOPE.md) — 契約。G3 で AS-BUILT に書き直し、凍結時との違いを理由つきで
  並べています
- [goal-pack/PROGRESS.md](goal-pack/PROGRESS.md) — 台帳。各行の判定と、その根拠として引用した実際の出力
- [goal-pack/materials/practice.md](goal-pack/materials/practice.md) — 実務の一次資料。「設計」の各項目は
  ここに由来します

レビュー側は一度 G2 を差し戻しました。カバレッジの `automated` 列が計画の読み上げになっていて、割合が下がり
得なかったためです。その指摘と、直したこと、そして「直した検査が本当に落ちること」を確かめた記録も
PROGRESS.md に残っています。

---

設計・レビュー・検証：So Ryo ／ 実装：AI エージェント（Claude Code）との協働
