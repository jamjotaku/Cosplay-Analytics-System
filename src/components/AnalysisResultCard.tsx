'use client';

import React from 'react';
import { TweetAnalysisData } from '@/types/tweet';
import { Clock, Heart, Repeat, Eye, TrendingUp, Sparkles, Image as ImageIcon, Bookmark, Calendar } from 'lucide-react';

interface AnalysisResultCardProps {
  data: TweetAnalysisData;
  onReanalyzeAi?: () => void;
  isAiLoading?: boolean;
}

export const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({ data, onReanalyzeAi, isAiLoading }) => {
  const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
    SSS: { bg: 'bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600', text: 'text-amber-300', border: 'border-amber-400' },
    S: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/50' },
    A: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50' },
    B: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
    C: { bg: 'bg-slate-700/20', text: 'text-slate-400', border: 'border-slate-700' },
  };

  const style = gradeColors[data.buzzGrade] || gradeColors.C;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
      {/* 上部ヘッダー: ユーザー情報 & バズグレードバッジ */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3.5 sm:gap-4">
          {data.authorAvatar ? (
            <img
              src={data.authorAvatar}
              alt={data.authorName}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-slate-700 object-cover"
            />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold">
              {data.authorName.slice(0, 1)}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-1.5">
                {data.authorName}
                <span className="text-xs sm:text-sm font-normal text-slate-400">@{data.authorUsername}</span>
              </h2>
              {data.authorTier && (
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-medium">
                  {data.authorTier}
                </span>
              )}
            </div>

            <p className="text-[11px] sm:text-xs text-slate-400 flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
              <span>フォロワー: <b className="text-slate-200">{data.authorFollowers.toLocaleString()}</b> 人</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {data.postTiming || '投稿時間不明'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {data.hoursElapsed} 時間経過
              </span>
            </p>
          </div>
        </div>

        {/* バズスコア & グレード */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="text-right">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Buzz Potential</p>
            <p className="text-xs sm:text-sm font-medium text-pink-400">{data.buzzProbability}</p>
          </div>
          <div
            className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border ${style.border} ${
              data.buzzGrade === 'SSS' ? style.bg : 'bg-slate-950'
            } shadow-lg`}
          >
            <span className={`text-xl sm:text-2xl font-black ${data.buzzGrade === 'SSS' ? 'text-white' : style.text}`}>
              {data.buzzGrade}
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">{data.buzzScore}点</span>
          </div>
        </div>
      </div>

      {/* メトリクスグリッド (5指標) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* いいね */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-1.5 text-rose-400 text-[11px] sm:text-xs font-medium mb-1">
            <Heart className="w-3.5 h-3.5" /> いいね数
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">{data.likes.toLocaleString()}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            時速 <b className="text-slate-200">{data.velocityHourly}</b> /h
          </p>
        </div>

        {/* リポスト */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] sm:text-xs font-medium mb-1">
            <Repeat className="w-3.5 h-3.5" /> リポスト数
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">{data.retweets.toLocaleString()}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
            RP比: <b className="text-slate-200">{(data.spreadRatio * 100).toFixed(1)}%</b>
          </p>
        </div>

        {/* ブックマーク (保存) */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-1.5 text-amber-400 text-[11px] sm:text-xs font-medium mb-1">
            <Bookmark className="w-3.5 h-3.5" /> 保存(BM)
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">{(data.bookmarks ?? 0).toLocaleString()}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
            保存率: <b className="text-slate-200">{((data.bookmarkRatio ?? 0) * 100).toFixed(1)}%</b>
          </p>
        </div>

        {/* インプレッション */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-1.5 text-blue-400 text-[11px] sm:text-xs font-medium mb-1">
            <Eye className="w-3.5 h-3.5" /> 表示回数
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">
            {data.impressions > 0 ? data.impressions.toLocaleString() : '-'}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
            反応率: <b className="text-slate-200">{data.engagementRateViews}%</b>
          </p>
        </div>

        {/* 肌色露出比率 (Stage 1: AI人物切り抜きハイブリッド ＆ Gemini Vision) */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 sm:p-4 rounded-2xl col-span-2 sm:col-span-1 border-pink-500/20">
          <div className="flex items-center justify-between text-pink-400 text-[11px] sm:text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> 純粋衣装露出度
            </span>
            <div className="flex items-center gap-1">
              {data.isAiAnalyzed && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-medium">
                  AI視覚認識
                </span>
              )}
              {data.framingTag && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30 font-medium">
                  {data.framingTag}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl font-black text-pink-400">
              {((data.averageBodySkinRatio ?? data.averageSkinRatio) * 100).toFixed(1)}%
            </p>
            <span className="text-[10px] text-slate-400">
              (全体比: {(data.averageSkinRatio * 100).toFixed(1)}%)
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>
              {data.possiblySensitive ? (
                <span className="text-amber-400 font-semibold">⚠️ センシティブ設定</span>
              ) : (
                '通常表示設定'
              )}
            </span>
            {data.peakSkinRatio && data.peakSkinRatio > data.averageSkinRatio && (
              <span className="text-rose-400 font-semibold text-[10px]">
                最高: {(data.peakSkinRatio * 100).toFixed(1)}%
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Gemini 視覚AI 判定根拠バナー または 再判定案内 */}
      {data.aiReasoning ? (
        <div className="bg-gradient-to-r from-purple-950/30 via-pink-950/20 to-slate-900 border border-purple-500/30 p-3.5 sm:p-4 rounded-2xl flex items-start gap-3 text-xs">
          <div className="p-1.5 bg-purple-500/20 rounded-xl text-purple-300 shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-purple-300" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-purple-300 text-[11px] tracking-wide">
                Google Gemini 視覚AI 判定解説
              </span>
              <span className="text-[9px] bg-purple-500/15 text-purple-300 px-1.5 py-0.2 rounded-full border border-purple-500/30">
                白服・白壁誤認ゼロ判定
              </span>
            </div>
            <p className="text-slate-300 text-[11px] sm:text-xs leading-relaxed">
              {data.aiReasoning}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 sm:p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>AI一時混雑等によりローカル色彩で判定されています。AI視覚解析を再試行できます</span>
          </div>
          {onReanalyzeAi && (
            <button
              onClick={onReanalyzeAi}
              disabled={isAiLoading}
              className="px-3.5 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-950/30"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAiLoading ? 'AI解析中...' : 'AIで再判定する'}
            </button>
          )}
        </div>
      )}

      {/* 画像プレビュー & 肌色解析マスク一覧 */}
      {data.media && data.media.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-pink-400" />
              添付メディア解析プレビュー ({data.media.length}枚)
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Stage 1: AI人物分離
              </span>
            </h3>
            <span className="text-[10px] sm:text-xs text-slate-500">
              純粋露出度 = 人物領域（服+体）に対する肌の比率
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {data.media.map((m, idx) => (
              <div
                key={idx}
                className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/5]"
              >
                {/* 写真 */}
                <img
                  src={m.url}
                  alt={`media-${idx}`}
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                />

                {/* ホバー詳細情報 (PC) */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition duration-300 flex flex-col justify-end p-2.5 sm:p-3 text-xs text-white">
                  <div className="bg-slate-950/90 p-2.5 rounded-xl backdrop-blur-md border border-slate-800 space-y-1">
                    <p className="text-pink-400 font-bold flex justify-between">
                      <span>純粋衣装露出:</span>
                      <span>{m.bodySkinRatio !== undefined ? (m.bodySkinRatio * 100).toFixed(1) : ((m.skinRatio || 0) * 100).toFixed(1)}%</span>
                    </p>
                    <p className="text-slate-300 text-[11px] flex justify-between">
                      <span>画像全体比率:</span>
                      <span>{m.skinRatio !== undefined ? (m.skinRatio * 100).toFixed(1) : '-'}%</span>
                    </p>
                    {m.framingTag && (
                      <p className="text-slate-400 text-[10px] flex justify-between">
                        <span>構図判定:</span>
                        <span className="text-slate-200">{m.framingTag}</span>
                      </p>
                    )}
                    {m.aiReasoning && (
                      <p className="text-purple-300 text-[10px] pt-1 border-t border-slate-800/80 line-clamp-2">
                        💡 {m.aiReasoning}
                      </p>
                    )}
                    {m.width && m.height && (
                      <p className="text-[10px] text-slate-400 flex justify-between">
                        <span>解像度:</span>
                        <span>{m.width} x {m.height}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* 左上: 画像インデックス */}
                <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium text-pink-300 border border-pink-500/30">
                  画像 #{idx + 1}
                </div>

                {/* 右上: 最高露出バッジ */}
                {m.isPeakSkin && data.media.length > 1 && (
                  <div className="absolute top-2 right-2 bg-rose-600/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold text-white shadow-md shadow-rose-600/40">
                    🌟 最高露出
                  </div>
                )}

                {/* 常時表示の左下構図バッジ ＆ 右下純粋露出度 (スマホ対応) */}
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-between pointer-events-none group-hover:opacity-0 transition duration-200">
                  {m.framingTag ? (
                    <span className="bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-300 border border-slate-700/60">
                      {m.framingTag}
                    </span>
                  ) : <span />}
                  <span className="bg-pink-950/85 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-bold text-pink-300 border border-pink-500/30">
                    露出 {m.bodySkinRatio !== undefined ? (m.bodySkinRatio * 100).toFixed(0) : ((m.skinRatio || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ツイート本文抜粋 */}
      <div className="bg-slate-950/40 p-3.5 sm:p-4 rounded-xl border border-slate-800/60 text-xs text-slate-300">
        <p className="font-semibold text-slate-400 mb-1 text-[11px]">ツイート本文:</p>
        <p className="whitespace-pre-wrap leading-relaxed">{data.text}</p>
      </div>
    </div>
  );
};
