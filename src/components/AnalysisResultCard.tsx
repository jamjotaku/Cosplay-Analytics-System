'use client';

import React from 'react';
import { TweetAnalysisData } from '@/types/tweet';
import { Flame, Clock, Heart, Repeat, Eye, TrendingUp, Sparkles, Image as ImageIcon } from 'lucide-react';

interface AnalysisResultCardProps {
  data: TweetAnalysisData;
}

export const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({ data }) => {
  const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
    SSS: { bg: 'bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600', text: 'text-amber-300', border: 'border-amber-400' },
    S: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/50' },
    A: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50' },
    B: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
    C: { bg: 'bg-slate-700/20', text: 'text-slate-400', border: 'border-slate-700' },
  };

  const style = gradeColors[data.buzzGrade] || gradeColors.C;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
      {/* 上部ヘッダー: ユーザー情報 & バズグレードバッジ */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          {data.authorAvatar ? (
            <img
              src={data.authorAvatar}
              alt={data.authorName}
              className="w-14 h-14 rounded-full border-2 border-slate-700 object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold">
              {data.authorName.slice(0, 1)}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {data.authorName}
              <span className="text-sm font-normal text-slate-400">@{data.authorUsername}</span>
            </h2>
            <p className="text-xs text-slate-400 flex items-center gap-3 mt-1">
              <span>フォロワー: <b className="text-slate-200">{data.authorFollowers.toLocaleString()}</b> 人</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                投稿後 {data.hoursElapsed} 時間経過
              </span>
            </p>
          </div>
        </div>

        {/* バズスコア & グレード */}
        <div className="flex items-center gap-4 self-end md:self-auto">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Buzz Potential</p>
            <p className="text-sm font-medium text-pink-400">{data.buzzProbability}</p>
          </div>
          <div
            className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl border ${style.border} ${
              data.buzzGrade === 'SSS' ? style.bg : 'bg-slate-950'
            } shadow-lg`}
          >
            <span className={`text-2xl font-black ${data.buzzGrade === 'SSS' ? 'text-white' : style.text}`}>
              {data.buzzGrade}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{data.buzzScore}点</span>
          </div>
        </div>
      </div>

      {/* メトリクスグリッド */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-medium mb-1">
            <Heart className="w-4 h-4" /> いいね数
          </div>
          <p className="text-2xl font-black text-white">{data.likes.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            時速 <b className="text-slate-200">{data.velocityHourly}</b> /h
          </p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1">
            <Repeat className="w-4 h-4" /> リポスト数
          </div>
          <p className="text-2xl font-black text-white">{data.retweets.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            RP/いいね比: <b className="text-slate-200">{data.spreadRatio}</b>
          </p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-medium mb-1">
            <Eye className="w-4 h-4" /> インプレッション
          </div>
          <p className="text-2xl font-black text-white">
            {data.impressions > 0 ? data.impressions.toLocaleString() : '取得中/非公開'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            閲覧反応率: <b className="text-slate-200">{data.engagementRateViews}%</b>
          </p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-pink-400 text-xs font-medium mb-1">
            <Sparkles className="w-4 h-4" /> 肌色・露出比率
          </div>
          <p className="text-2xl font-black text-pink-400">
            {(data.averageSkinRatio * 100).toFixed(1)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {data.possiblySensitive ? (
              <span className="text-amber-400 font-semibold">⚠️ センシティブ警告フラグ有</span>
            ) : (
              '通常表示設定'
            )}
          </p>
        </div>
      </div>

      {/* 画像プレビュー & 肌色解析マスク一覧 */}
      {data.media && data.media.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-pink-400" />
              添付メディア解析プレビュー (肌色ハイライト)
            </h3>
            <span className="text-xs text-slate-500">
              ピンク色領域 = 検出された肌色・露出エリア
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {data.media.map((m, idx) => (
              <div
                key={idx}
                className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/5]"
              >
                {/* 原本写真 */}
                <img
                  src={m.url}
                  alt={`media-${idx}`}
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                />

                {/* 肌色マスクオーバーレイ（ホバーまたは常時表示） */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex flex-col justify-end p-3 text-xs text-white">
                  <div className="bg-slate-950/80 p-2 rounded-lg backdrop-blur-md">
                    <p className="text-pink-400 font-bold">
                      肌色率: {m.skinRatio !== undefined ? (m.skinRatio * 100).toFixed(1) : (data.averageSkinRatio * 100).toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-slate-300">
                      解像度: {m.width} x {m.height}
                    </p>
                  </div>
                </div>

                <div className="absolute top-2 left-2 bg-slate-950/70 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-medium text-pink-300 border border-pink-500/30">
                  画像 #{idx + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ツイート本文抜粋 */}
      <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 text-xs text-slate-300">
        <p className="font-semibold text-slate-400 mb-1">ツイート本文:</p>
        <p className="whitespace-pre-wrap leading-relaxed">{data.text}</p>
      </div>
    </div>
  );
};
