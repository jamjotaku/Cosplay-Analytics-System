'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Search, Table, RefreshCw, Copy, Check, ExternalLink, BarChart3, AlertCircle } from 'lucide-react';
import { TweetAnalysisData, SheetRecord } from '@/types/tweet';
import { analyzeImageSkinTone } from '@/lib/skinToneDetector';
import { calculateBuzzMetrics } from '@/lib/buzzScorer';
import { fetchSheetData, formatAsCsvRow, CSV_HEADER } from '@/lib/sheetSync';
import { AnalysisResultCard } from '@/components/AnalysisResultCard';
import { CorrelationAnalysis } from '@/components/CorrelationAnalysis';

export default function Home() {
  const [tweetUrl, setTweetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<TweetAnalysisData | null>(null);

  // スプレッドシート連携データ
  const [sheetRecords, setSheetRecords] = useState<SheetRecord[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analyzer' | 'correlation' | 'history'>('analyzer');
  const [copiedCsv, setCopiedCsv] = useState(false);

  // 公開CSV URL
  const sheetCsvUrl = process.env.NEXT_PUBLIC_SHEET_CSV_URL || '';

  // 初回データ読み込み
  useEffect(() => {
    if (sheetCsvUrl) {
      loadSheetData();
    }
  }, [sheetCsvUrl]);

  const loadSheetData = async () => {
    if (!sheetCsvUrl) return;
    setSheetLoading(true);
    try {
      const records = await fetchSheetData(sheetCsvUrl);
      setSheetRecords(records);
    } catch (e) {
      console.error(e);
    } finally {
      setSheetLoading(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tweetUrl.trim()) return;

    setLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // 1. サーバーサイドでXのメタデータを取得
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetUrl }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'ツイートの取得に失敗しました');
      }

      const raw = resData.data;

      // 2. ブラウザ側で画像の肌色比率を解析 (CORSプロキシ経由)
      let totalSkin = 0;
      let photoCount = 0;
      const mediaWithSkin = [...raw.media];

      for (let i = 0; i < mediaWithSkin.length; i++) {
        if (mediaWithSkin[i].type === 'photo') {
          const skinResult = await analyzeImageSkinTone(mediaWithSkin[i].url, true);
          mediaWithSkin[i].skinRatio = skinResult.skinRatio;
          totalSkin += skinResult.skinRatio;
          photoCount++;
        }
      }

      const avgSkinRatio = photoCount > 0 ? Number((totalSkin / photoCount).toFixed(4)) : 0;

      // 3. バズスコア & エンゲージメント指標を計算
      const buzz = calculateBuzzMetrics({
        createdAt: raw.createdAt,
        authorFollowers: raw.authorFollowers,
        likes: raw.likes,
        retweets: raw.retweets,
        replies: raw.replies,
        bookmarks: raw.bookmarks,
        impressions: raw.impressions,
        possiblySensitive: raw.possiblySensitive,
        averageSkinRatio: avgSkinRatio,
      });

      const finalData: TweetAnalysisData = {
        tweetId: raw.tweetId,
        tweetUrl: raw.tweetUrl,
        createdAt: raw.createdAt,
        hoursElapsed: buzz.hoursElapsed,
        authorName: raw.authorName,
        authorUsername: raw.authorUsername,
        authorAvatar: raw.authorAvatar,
        authorFollowers: raw.authorFollowers,
        text: raw.text,
        likes: raw.likes,
        retweets: raw.retweets,
        replies: raw.replies,
        bookmarks: raw.bookmarks,
        impressions: raw.impressions,
        possiblySensitive: raw.possiblySensitive,
        media: mediaWithSkin,
        averageSkinRatio: avgSkinRatio,
        engagementTotal: buzz.engagementTotal,
        engagementRateFollowers: buzz.engagementRateFollowers,
        engagementRateViews: buzz.engagementRateViews,
        velocityHourly: buzz.velocityHourly,
        spreadRatio: buzz.spreadRatio,
        buzzScore: buzz.buzzScore,
        buzzGrade: buzz.buzzGrade,
        buzzProbability: buzz.buzzProbability,
        analyzedAt: new Date().toISOString(),
      };

      setAnalysisResult(finalData);

      // 一時的なローカルレコード追加（即座に相関チャートへ反映）
      const newRecord: SheetRecord = {
        timestamp: finalData.analyzedAt,
        tweetUrl: finalData.tweetUrl,
        author: finalData.authorUsername,
        followers: finalData.authorFollowers,
        likes: finalData.likes,
        retweets: finalData.retweets,
        impressions: finalData.impressions,
        hoursElapsed: finalData.hoursElapsed,
        skinRatio: finalData.averageSkinRatio,
        buzzScore: finalData.buzzScore,
        buzzGrade: finalData.buzzGrade,
        imageUrl: finalData.media[0]?.url || '',
      };

      setSheetRecords((prev) => [newRecord, ...prev]);

      // Googleスプレッドシートへ自動同期 (GAS Webhook)
      fetch('/api/sheet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      }).catch((e) => console.warn('Auto sync to sheet failed:', e));
    } catch (err: any) {
      setError(err.message || '予期せぬエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const copyCsvRow = () => {
    if (!analysisResult) return;
    const record: SheetRecord = {
      timestamp: analysisResult.analyzedAt,
      tweetUrl: analysisResult.tweetUrl,
      author: analysisResult.authorUsername,
      followers: analysisResult.authorFollowers,
      likes: analysisResult.likes,
      retweets: analysisResult.retweets,
      impressions: analysisResult.impressions,
      hoursElapsed: analysisResult.hoursElapsed,
      skinRatio: analysisResult.averageSkinRatio,
      buzzScore: analysisResult.buzzScore,
      buzzGrade: analysisResult.buzzGrade,
      imageUrl: analysisResult.media[0]?.url || '',
    };

    const row = formatAsCsvRow(record);
    navigator.clipboard.writeText(row);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* ナビゲーションバー */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Cosplay Analytics System
                <span className="text-[10px] bg-pink-500/20 text-pink-400 font-semibold px-2 py-0.5 rounded-full border border-pink-500/30">
                  v1.0
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">X画像ポストのバズ初速 & 肌色露出相関ダッシュボード</p>
            </div>
          </div>

          {/* タブ切り替え */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('analyzer')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium ${
                activeTab === 'analyzer'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              単体分析
            </button>
            <button
              onClick={() => setActiveTab('correlation')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium ${
                activeTab === 'correlation'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              露出相関
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium ${
                activeTab === 'history'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              シート記録 ({sheetRecords.length})
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full space-y-8">
        {/* 入力検索バー */}
        <div className="max-w-3xl mx-auto space-y-3">
          <form onSubmit={handleAnalyze} className="relative flex items-center">
            <input
              type="text"
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              placeholder="https://x.com/username/status/1234567890..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-4 pr-32 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition shadow-inner"
            />
            <button
              type="submit"
              disabled={loading || !tweetUrl.trim()}
              className="absolute right-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-medium text-xs px-5 py-2.5 rounded-xl transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-pink-500/25"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  バズ分析
                </>
              )}
            </button>
          </form>

          {/* セーフティ・Bot制限インジケータ */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-2">
            <span>🛡️ Bot検知回避: 待機ジッター & 15回/分リクエストガード有効</span>
            <span>⚡ クライアント側Canvas肌色解析 (高速・サーバーレス対応)</span>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="max-w-3xl mx-auto bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-2xl flex items-center gap-3 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <p>{error}</p>
          </div>
        )}

        {/* タブに応じた表示 */}
        {activeTab === 'analyzer' && (
          <div className="space-y-6">
            {analysisResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-300">分析レポート</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyCsvRow}
                      className="text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                    >
                      {copiedCsv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCsv ? 'スプレッドシート用CSV行をコピー済' : 'シート貼付用CSVをコピー'}
                    </button>
                    <a
                      href={analysisResult.tweetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl hover:border-slate-700 transition flex items-center gap-1"
                    >
                      元ツイートを開く <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                </div>
                <AnalysisResultCard data={analysisResult} />
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-slate-800 rounded-3xl space-y-3">
                <Sparkles className="w-10 h-10 text-pink-400/50 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">ポストのURLを入力して分析を開始してください</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  いいね・RP・インプレッションの初速、フォロワー比率、被写体の肌色露出率を総合判定してバズポテンシャルを可視化します。
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'correlation' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">肌色露出比率 vs エンゲージメント相関分析</h2>
                <p className="text-xs text-slate-400">蓄積データから露出度がインプレッションやいいねに与える影響度を統計化</p>
              </div>
              <button
                onClick={loadSheetData}
                disabled={sheetLoading}
                className="text-xs bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl hover:border-slate-700 transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sheetLoading ? 'animate-spin' : ''}`} />
                再読み込み
              </button>
            </div>
            <CorrelationAnalysis records={sheetRecords} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Googleスプレッドシート蓄積レコード</h2>
                <p className="text-xs text-slate-400">永続化されているデータ一覧（画像URLプレビュー付き）</p>
              </div>
              <button
                onClick={loadSheetData}
                disabled={sheetLoading}
                className="text-xs bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl hover:border-slate-700 transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sheetLoading ? 'animate-spin' : ''}`} />
                スプレッドシート再同期
              </button>
            </div>

            {sheetRecords.length === 0 ? (
              <div className="text-center py-12 border border-slate-800 rounded-2xl text-slate-500 text-sm">
                データはまだありません。ツイート分析を実行してデータを蓄積してください。
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/60">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">画像</th>
                      <th className="p-3">ユーザー</th>
                      <th className="p-3">いいね</th>
                      <th className="p-3">RP</th>
                      <th className="p-3">表示回数</th>
                      <th className="p-3">経過時間</th>
                      <th className="p-3">肌色率</th>
                      <th className="p-3">バズスコア</th>
                      <th className="p-3">評価</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {sheetRecords.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="p-3">
                          {r.imageUrl ? (
                            <img
                              src={r.imageUrl}
                              alt="thumb"
                              className="w-10 h-10 object-cover rounded-lg border border-slate-700"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-slate-800 rounded-lg" />
                          )}
                        </td>
                        <td className="p-3 font-medium text-white">
                          <a
                            href={r.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-pink-400 transition"
                          >
                            @{r.author}
                          </a>
                        </td>
                        <td className="p-3 font-semibold text-rose-400">{r.likes.toLocaleString()}</td>
                        <td className="p-3 text-emerald-400">{r.retweets.toLocaleString()}</td>
                        <td className="p-3 text-blue-400">{r.impressions.toLocaleString()}</td>
                        <td className="p-3">{r.hoursElapsed}h</td>
                        <td className="p-3 text-pink-400 font-bold">{(r.skinRatio * 100).toFixed(1)}%</td>
                        <td className="p-3 font-bold text-amber-400">{r.buzzScore}点</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md font-black bg-slate-800 text-slate-200">
                            {r.buzzGrade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <p>Cosplay Analytics System • Designed for zero-cost operation on Vercel & Google Sheets</p>
      </footer>
    </div>
  );
}
