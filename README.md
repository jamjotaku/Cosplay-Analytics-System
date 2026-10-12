# Cosplay Analytics System (cosplay-analytics-system)

コスプレ等のX（Twitter）画像ポストのメタデータ（いいね数、RP数、インプレッション、フォロワー数、経過時間）および**被写体の肌色露出比率**を解析・可視化し、バズ判定と露出によるエンゲージメント相関を分析するシステムです。

---

## 主な機能

1. **バズ・エンゲージメント多角分析**
   - 1時間あたりのいいね獲得初速 (Velocity)
   - フォロワー比 / インプレッション比の反応率
   - 拡散意欲比率 (RP / いいね)
   - 総合バズ判定 (SSS / S / A / B / C グレード評価)

2. **クライアントサイド画像解析 (肌色・露出度判定)**
   - HTML5 Canvas + YCrCb & RGB色空間アルゴリズムによる肌色ピクセル比率検出
   - サーバーレス（Vercel）無料枠に負荷をかけない高速なブラウザ側リアルタイム解析
   - 肌色検出マスクハイライトプレビュー

3. **露出度 vs エンゲージメント相関分析**
   - 蓄積データをもとに「肌色比率 vs いいね数 / インプレッション」の散布図を描画
   - 露出度30%以上の層と通常層におけるエンゲージメント倍率を統計化

4. **安全なスクレイピング & Bot認定対策**
   - Xスクレイピング用アカウントのCookie（`auth_token`, `ct0`）による安全取得
   - 15回/分のリクエスト制限ガード & ランダムジッター（待機ディレイ）による自動Bot判定回避

5. **Googleスプレッドシート永続化連携**
   - 画像URLとして保存するためストレージ容量ゼロ
   - 公開CSV URLからいつでも過去の分析ログを即座に復元・可視化
   - ワンクリックでシート貼付用CSV行をクリップボードにコピー

---

## セットアップ & ローカル実行

```bash
# 依存パッケージインストール
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスします。

---

## 環境変数設定 (`.env.local`)

`.env.example` を参考に、ローカルまたはVercel環境変数に設定してください：

```env
# X (Twitter) Scraper Credentials
X_AUTH_TOKEN="f16a901a7ad656f2e5ae76517448fc46e5572314"
X_CT0="c27e286d8942e4ed71fa81935cffbe34c0832597edb12103b0857f9c8ec50bbce94340b440fd383040d67bb9ed17448ac04f5058ce5a0cdc8ecb4203436a65321c624a1582cd7b0d53632cb8bb71b013"
X_TWID="u%3D2015716569335398400"
X_KDT="753ZmPQSYQTmWu3oC3WDT24QQ5Gdl9tK5crolhYv"

# Google Sheets Public CSV Export URL
NEXT_PUBLIC_SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vSW_fo0_u6-6mCRPrdB1ppbWLxjeVqvSpmAculPK_PNafyDUMoqjUBPaNBLnVAWT1oT2DEQkE0a-FWQ/pub?gid=0&single=true&output=csv"
```

---

## Vercelへのデプロイ手順

1. GitHubリポジトリ (`jamjotaku/Cosplay-Analytics-System`) にプッシュ
2. [Vercel](https://vercel.com) でリポジトリをインポート
3. **Environment Variables** に上記環境変数を登録
4. **Deploy** をクリック（設定不要で即座に公開されます）
