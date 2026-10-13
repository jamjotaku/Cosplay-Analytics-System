'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Table,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  BarChart3,
  AlertCircle,
  Download,
  ClipboardPaste,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Share2,
} from 'lucide-react';
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
  const [existingRecordNotice, setExistingRecordNotice] = useState<string | null>(null);

  // PWA インストールプロンプト (Android / PC Chrome / Edge)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // スプレッドシート連携データ
  const [sheetRecords, setSheetRecords] = useState<SheetRecord[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analyzer' | 'correlation' | 'history'>('analyzer');
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // シート記録の絞り込み & ソート状態
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'likes' | 'bodySkinRatio' | 'skinRatio' | 'buzzScore' | 'impressions'>('newest');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // 公開CSV URL
  const sheetCsvUrl = process.env.NEXT_PUBLIC_SHEET_CSV_URL || '';

  // 初回データ読み込み & PWA サービスワーカー登録 & インストール監視
  useEffect(() => {
    if (sheetCsvUrl) {
      loadSheetData();
    }
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [sheetCsvUrl]);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

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

  // クリップボードからのワンタップ貼り付け
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.includes('twitter.com') || text.includes('x.com'))) {
        setTweetUrl(text.trim());
      } else if (text) {
        setTweetUrl(text.trim());
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tweetUrl.trim()) return;

    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setExistingRecordNotice(null);

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

      // 2. ブラウザ側で画像の肌色比率 ＆ AI人物セグメンテーションを解析
      let totalSkin = 0;
      let totalBodySkin = 0;
      let photoCount = 0;
      let peakSkinRatio = 0;
      let peakIndex = -1;
      let primaryFramingTag = 'ミドル・半身';
      const mediaWithSkin = [...raw.media];

      for (let i = 0; i < mediaWithSkin.length; i++) {
        if (mediaWithSkin[i].type === 'photo') {
          const skinResult = await analyzeImageSkinTone(mediaWithSkin[i].url, true);
          mediaWithSkin[i].skinRatio = skinResult.skinRatio;
          mediaWithSkin[i].bodySkinRatio = skinResult.bodySkinRatio;
          mediaWithSkin[i].personRatio = skinResult.personRatio;
          mediaWithSkin[i].framingTag = skinResult.framingTag;
          
          totalSkin += skinResult.skinRatio;
          totalBodySkin += skinResult.bodySkinRatio;
          photoCount++;

          if (i === 0) {
            primaryFramingTag = skinResult.framingTag;
          }

          if (skinResult.skinRatio > peakSkinRatio) {
            peakSkinRatio = skinResult.skinRatio;
            peakIndex = i;
          }
        }
      }

      if (peakIndex >= 0) {
        mediaWithSkin[peakIndex].isPeakSkin = true;
      }

      const avgSkinRatio = photoCount > 0 ? Number((totalSkin / photoCount).toFixed(4)) : 0;
      const avgBodySkinRatio = photoCount > 0 ? Number((totalBodySkin / photoCount).toFixed(4)) : 0;

      // 3. バズスコア & エンゲージメント指標を計算
      const buzz = calculateBuzzMetrics({
        createdAt: raw.createdAt,
        authorFollowers: raw.authorFollowers,
        likes: raw.likes,
        retweets: raw.retweets,
        replies: raw.replies,
        bookmarks: raw.bookmarks || 0,
        impressions: raw.impressions,
        possiblySensitive: raw.possiblySensitive,
        averageSkinRatio: avgSkinRatio,
        peakSkinRatio,
      });

      const finalData: TweetAnalysisData = {
        tweetId: raw.tweetId,
        tweetUrl: raw.tweetUrl,
        createdAt: raw.createdAt,
        postTiming: buzz.postTiming,
        hoursElapsed: buzz.hoursElapsed,
        authorName: raw.authorName,
        authorUsername: raw.authorUsername,
        authorAvatar: raw.authorAvatar,
        authorFollowers: raw.authorFollowers,
        authorTier: buzz.authorTier,
        text: raw.text,
        likes: raw.likes,
        retweets: raw.retweets,
        replies: raw.replies,
        bookmarks: raw.bookmarks || 0,
        impressions: raw.impressions,
        possiblySensitive: raw.possiblySensitive,
        media: mediaWithSkin,
        averageSkinRatio: avgSkinRatio,
        averageBodySkinRatio: avgBodySkinRatio,
        peakSkinRatio,
        framingTag: primaryFramingTag,
        engagementTotal: buzz.engagementTotal,
        engagementRateFollowers: buzz.engagementRateFollowers,
        engagementRateViews: buzz.engagementRateViews,
        velocityHourly: buzz.velocityHourly,
        spreadRatio: buzz.spreadRatio,
        bookmarkRatio: buzz.bookmarkRatio,
        buzzScore: buzz.buzzScore,
        buzzGrade: buzz.buzzGrade,
        buzzProbability: buzz.buzzProbability,
        analyzedAt: new Date().toISOString(),
      };

      setAnalysisResult(finalData);

      // 重複チェック (過去に同じツイートが記録されているか確認)
      const existing = sheetRecords.find(
        (r) => r.tweetUrl.includes(raw.tweetId) || raw.tweetUrl.includes(r.tweetUrl)
      );
      if (existing) {
        setExistingRecordNotice(
          `このポストは既にシートに記録されています (前回の記録: ${existing.likes.toLocaleString()}いいね / ${existing.buzzGrade}判定)`
        );
      }

      // レコード作成
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
        bodySkinRatio: finalData.averageBodySkinRatio,
        framingTag: finalData.framingTag,
      };

      // ローカル一覧を更新（既存があれば最新化、なければ先頭追加）
      setSheetRecords((prev) => {
        const filtered = prev.filter((r) => !r.tweetUrl.includes(raw.tweetId));
        return [newRecord, ...filtered];
      });

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
      bodySkinRatio: analysisResult.averageBodySkinRatio,
      framingTag: analysisResult.framingTag,
    };

    const row = formatAsCsvRow(record);
    navigator.clipboard.writeText(row);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2500);
  };

  // SNS共有用バズ診断テキストのコピー
  const copyShareText = () => {
    if (!analysisResult) return;
    const bodySkin = ((analysisResult.averageBodySkinRatio ?? analysisResult.averageSkinRatio) * 100).toFixed(1);
    const totalSkin = (analysisResult.averageSkinRatio * 100).toFixed(1);
    const text = [
      `【Cosplay Analytics バズ診断結果】`,
      `👤 @${analysisResult.authorUsername} (${analysisResult.authorName})`,
      `🎖️ バズ判定: ${analysisResult.buzzGrade} (${analysisResult.buzzScore}点) - ${analysisResult.buzzProbability}`,
      `✨ 純粋衣装露出度: ${bodySkin}% (全体比: ${totalSkin}% / 構図: ${analysisResult.framingTag})`,
      `❤️ いいね数: ${analysisResult.likes.toLocaleString()} (時速: ${analysisResult.velocityHourly}/h)`,
      `🔁 RP: ${analysisResult.retweets.toLocaleString()} | 🔖 保存(BM): ${(analysisResult.bookmarks ?? 0).toLocaleString()}`,
      `#CosplayAnalytics`,
      `https://cosplay-analytics-system.vercel.app`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  // 蓄積全レコードのUTF-8 BOM付きCSV一括ダウンロード
  const downloadAllCsv = () => {
    if (filteredAndSortedRecords.length === 0) return;
    const header = CSV_HEADER;
    const rows = filteredAndSortedRecords.map(formatAsCsvRow);
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cosplay_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // シート記録の絞り込み & ソートロジック
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...sheetRecords];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) => r.author.toLowerCase().includes(q) || r.tweetUrl.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let comp = 0;
      switch (sortBy) {
        case 'likes':
          comp = a.likes - b.likes;
          break;
        case 'bodySkinRatio':
          comp = (a.bodySkinRatio ?? a.skinRatio) - (b.bodySkinRatio ?? b.skinRatio);
          break;
        case 'skinRatio':
          comp = a.skinRatio - b.skinRatio;
          break;
        case 'buzzScore':
          comp = a.buzzScore - b.buzzScore;
          break;
        case 'impressions':
          comp = a.impressions - b.impressions;
          break;
        case 'newest':
        default:
          comp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
      }
      return sortOrder === 'desc' ? -comp : comp;
    });

    return result;
  }, [sheetRecords, searchQuery, sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* ナビゲーションバー (iPhoneノッチ・ステータスバー回避) */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-50 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-7xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img
              src="/icon.png"
              alt="Cosplay Analytics"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain bg-slate-900 border border-slate-700 shadow-md shadow-pink-500/20 shrink-0"
            />
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                Cosplay Analytics
                <span className="text-[9px] sm:text-[10px] bg-pink-500/20 text-pink-400 font-semibold px-1.5 py-0.5 rounded-full border border-pink-500/30">
                  v2.2 (Stage 3)
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 hidden md:block">AI人物分離・構図判定・曜日×時間帯アナリティクス ＆ 露出相関ダッシュボード</p>
            </div>
          </div>

          {/* タブ切り替え */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs shrink-0">
            <button
              onClick={() => setActiveTab('analyzer')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center gap-1 sm:gap-1.5 font-medium text-[11px] sm:text-xs ${
                activeTab === 'analyzer'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>単体分析</span>
            </button>
            <button
              onClick={() => setActiveTab('correlation')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center gap-1 sm:gap-1.5 font-medium text-[11px] sm:text-xs ${
                activeTab === 'correlation'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>露出相関</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center gap-1 sm:gap-1.5 font-medium text-[11px] sm:text-xs ${
                activeTab === 'history'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>シート ({sheetRecords.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-8 w-full space-y-6 sm:space-y-8">
        {/* 入力検索バー */}
        <div className="max-w-3xl mx-auto space-y-2 sm:space-y-3">
          <form onSubmit={handleAnalyze} className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                placeholder="XポストURLを貼り付け (https://x.com/...)"
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl pl-4 pr-16 py-3 sm:py-3.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition shadow-inner"
              />
              {/* クリップボード貼付ボタン */}
              <button
                type="button"
                onClick={handlePasteClipboard}
                title="クリップボードから貼り付け"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pink-400 p-1.5 rounded-lg hover:bg-slate-800 transition text-[11px] flex items-center gap-1"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span className="text-[10px] hidden sm:inline">貼付</span>
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || !tweetUrl.trim()}
              className="bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-semibold text-xs sm:text-sm px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 active:scale-98"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  バズ分析
                </>
              )}
            </button>
          </form>

          {/* セーフティ・Bot制限インジケータ & PWAインストールボタン */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[10px] sm:text-[11px] text-slate-500 px-1 gap-1.5">
            <span>🛡️ Bot検知回避: 待機ジッター & 20回/分リクエストガード有効</span>
            {deferredPrompt ? (
              <button
                type="button"
                onClick={handleInstallApp}
                className="text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 px-2.5 py-1 rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" />
                アプリをインストール
              </button>
            ) : (
              <span>📱 PWA対応: PC/Android/iPhoneでアプリ化可能</span>
            )}
          </div>
        </div>

        {/* 既存レコード重複通知 */}
        {existingRecordNotice && (
          <div className="max-w-3xl mx-auto bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 sm:p-4 rounded-2xl flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
            <p>{existingRecordNotice}</p>
          </div>
        )}

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
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={copyShareText}
                      className="text-xs bg-slate-900 border border-slate-800 hover:border-pink-500/50 text-pink-300 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                    >
                      {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-pink-400" />}
                      {copiedShare ? '共有文コピー済' : '診断結果共有'}
                    </button>
                    <button
                      onClick={copyCsvRow}
                      className="text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                    >
                      {copiedCsv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCsv ? 'CSVコピー済' : 'CSV行コピー'}
                    </button>
                    <a
                      href={analysisResult.tweetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl hover:border-slate-700 transition flex items-center gap-1"
                    >
                      元ポスト <ExternalLink className="w-3 h-3 ml-0.5" />
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
                  いいね・RP・表示回数・保存数(BM)の初速、フォロワー比率、被写体の肌色露出率を総合判定してバズポテンシャルを可視化します。
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'correlation' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">肌色露出比率 vs エンゲージメント相関分析</h2>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">蓄積レコード・リサーチデータベース</h2>
                <p className="text-xs text-slate-400">スプレッドシート永続化データ ({filteredAndSortedRecords.length} / {sheetRecords.length} 件)</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={downloadAllCsv}
                  disabled={filteredAndSortedRecords.length === 0}
                  className="text-xs bg-slate-900 border border-slate-800 hover:border-pink-500/50 text-pink-300 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                  title="表示中のデータをUTF-8 BOM付きCSVとして保存"
                >
                  <Download className="w-3.5 h-3.5 text-pink-400" />
                  CSV一括出力 ({filteredAndSortedRecords.length}件)
                </button>
                <button
                  onClick={loadSheetData}
                  disabled={sheetLoading}
                  className="text-xs bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl hover:border-slate-700 transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sheetLoading ? 'animate-spin' : ''}`} />
                  スプレッドシート再同期
                </button>
              </div>
            </div>

            {/* リサーチ・検索 & ソートバー */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl">
              {/* 検索入力 */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="コスプレイヤー名で絞り込み..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 pl-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
                <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* ソートコントロール */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                <span className="text-[11px] text-slate-400 shrink-0">並び順:</span>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-pink-500"
                >
                  <option value="newest">新着順</option>
                  <option value="likes">いいね数 順</option>
                  <option value="bodySkinRatio">純粋衣装露出 順 (AI)</option>
                  <option value="skinRatio">画像全体肌色 順</option>
                  <option value="buzzScore">バズスコア 順</option>
                  <option value="impressions">表示回数 順</option>
                </select>

                <button
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  title={sortOrder === 'desc' ? '降順 (大きい順)' : '昇順 (小さい順)'}
                  className="bg-slate-950 border border-slate-800 text-slate-300 hover:text-pink-400 p-1.5 rounded-xl transition flex items-center gap-1"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{sortOrder === 'desc' ? '大→小' : '小→大'}</span>
                </button>
              </div>
            </div>

            {filteredAndSortedRecords.length === 0 ? (
              <div className="text-center py-12 border border-slate-800 rounded-2xl text-slate-500 text-sm">
                該当するデータがありません。ツイート分析を実行してデータを蓄積してください。
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/60 shadow-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">画像</th>
                      <th className="p-3">構図</th>
                      <th className="p-3">ユーザー</th>
                      <th className="p-3 cursor-pointer hover:text-pink-400 transition" onClick={() => { setSortBy('likes'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}>
                        いいね {sortBy === 'likes' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="p-3">RP</th>
                      <th className="p-3 cursor-pointer hover:text-pink-400 transition" onClick={() => { setSortBy('impressions'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}>
                        表示回数 {sortBy === 'impressions' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="p-3">経過</th>
                      <th className="p-3 cursor-pointer hover:text-pink-400 transition" onClick={() => { setSortBy('bodySkinRatio'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}>
                        純粋露出(全体) {sortBy === 'bodySkinRatio' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="p-3 cursor-pointer hover:text-pink-400 transition" onClick={() => { setSortBy('buzzScore'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}>
                        スコア {sortBy === 'buzzScore' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="p-3">判定</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredAndSortedRecords.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="p-3">
                          {r.imageUrl ? (
                            <img
                              src={r.imageUrl}
                              alt="thumb"
                              className="w-10 h-10 object-cover rounded-lg border border-slate-700 hover:scale-110 transition"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-slate-800 rounded-lg" />
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {r.framingTag || 'ミドル'}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-white max-w-[120px] truncate">
                          <a
                            href={r.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-pink-400 transition"
                          >
                            @{r.author}
                          </a>
                        </td>
                        <td className="p-3 font-semibold text-rose-400">{(r.likes ?? 0).toLocaleString()}</td>
                        <td className="p-3 text-emerald-400">{(r.retweets ?? 0).toLocaleString()}</td>
                        <td className="p-3 text-blue-400">{r.impressions > 0 ? r.impressions.toLocaleString() : '-'}</td>
                        <td className="p-3">{r.hoursElapsed ?? 1}h</td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="text-pink-400 font-bold">
                              {(((r.bodySkinRatio ?? r.skinRatio) ?? 0) * 100).toFixed(1)}%
                            </span>
                            <span className="text-[9px] text-slate-500">
                              (全体: {((r.skinRatio ?? 0) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </td>
                        <td className="p-3 font-bold text-amber-400">{r.buzzScore ?? 0}点</td>
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
        <p>Cosplay Analytics System • Zero-cost operation on Vercel & Google Sheets</p>
      </footer>
    </div>
  );
}
