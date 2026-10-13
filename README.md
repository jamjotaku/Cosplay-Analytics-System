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
   - HTML5 Canvas + HSV & YCrCb 色空間アルゴリズムによる肌色ピクセル比率検出
   - 金髪ウィッグ・黄色衣装・背景照明の誤検知を徹底排除
   - サーバーレス（Vercel）無料枠に負荷をかけない高速なブラウザ側リアルタイム解析
   - 肌色検出マスクハイライトプレビュー

3. **露出度 vs エンゲージメント相関分析（3段階）**
   - 低露出 (<8%) / 中露出 (8〜18%) / 高露出 (>=18%) の3層比較
   - 各層の平均いいね数および低露出層に対するエンゲージメント倍率を自動集計
   - 蓄積データをもとに「肌色比率 vs いいね数 / インプレッション」の散布図を描画

4. **高速・Cookie完全不要のメタデータ取得エンジン**
   - FxTwitter / VxTwitter API による安定した高速データ取得
   - XアカウントのCookieやログイン認証が一切不要（Cookie切れやBot BANリスクなし）
   - 最低リクエスト間隔 & ガードによる安定稼働

5. **Googleスプレッドシート永続化連携**
   - 画像URLとして保存するためストレージ容量ゼロ
   - Google Apps Script (GAS) Webhook による完全自動追記
   - 公開CSV URLからいつでも過去の分析ログを即座に復元・可視化

6. **モバイル / PWA 対応**
   - iOS ノッチ（iPhone 12 mini など）に最適化されたセーフエリア設計
   - PWA（ホーム画面への追加）によるアプリ化・オフライン耐性

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

Cookie設定は一切不要です。以下の2つのみを設定します：

```env
# Google Sheets Public CSV Export URL (読み取り用)
NEXT_PUBLIC_SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/e/YOUR_SHEET_ID/pub?gid=0&single=true&output=csv"

# Google Apps Script Webhook URL (自動書き込み用)
GAS_WEBHOOK_URL="https://script.google.com/macros/s/YOUR_GAS_ID/exec"
```

---

## Vercelへのデプロイ手順

1. GitHubリポジトリ (`jamjotaku/Cosplay-Analytics-System`) にプッシュ
2. [Vercel](https://vercel.com) でリポジトリをインポート
3. **Environment Variables** に上記2つの環境変数を登録
4. **Deploy** をクリック
