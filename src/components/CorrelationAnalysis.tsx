'use client';

import React from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ZAxis } from 'recharts';
import { SheetRecord } from '@/types/tweet';

interface CorrelationAnalysisProps {
  records: SheetRecord[];
}

export const CorrelationAnalysis: React.FC<CorrelationAnalysisProps> = ({ records }) => {
  if (!records || records.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
        <p className="text-sm">過去の蓄積データがまだありません。ツイートを分析すると相関チャートが生成されます。</p>
      </div>
    );
  }

  // 散布図用データ成形 (肌色比率 % vs いいね数 / インプレッション)
  const chartData = records.map((r) => ({
    name: r.author,
    skinPct: Number((r.skinRatio * 100).toFixed(1)), // 0〜100%
    likes: r.likes,
    impressions: r.impressions,
    buzzScore: r.buzzScore,
    url: r.tweetUrl,
    imageUrl: r.imageUrl,
  }));

  // 平均肌色比率
  const avgSkin = (records.reduce((acc, r) => acc + r.skinRatio, 0) / records.length) * 100;

  // 3段階の露出層グループ分割 (高露出: >=18%, 中露出: 8〜18%, 低露出: <8%)
  const highSkinGroup = records.filter((r) => r.skinRatio >= 0.18);
  const midSkinGroup = records.filter((r) => r.skinRatio >= 0.08 && r.skinRatio < 0.18);
  const lowSkinGroup = records.filter((r) => r.skinRatio < 0.08);

  const avgLikesHigh = highSkinGroup.length > 0
    ? Math.round(highSkinGroup.reduce((a, b) => a + b.likes, 0) / highSkinGroup.length)
    : 0;

  const avgLikesMid = midSkinGroup.length > 0
    ? Math.round(midSkinGroup.reduce((a, b) => a + b.likes, 0) / midSkinGroup.length)
    : 0;

  const avgLikesLow = lowSkinGroup.length > 0
    ? Math.round(lowSkinGroup.reduce((a, b) => a + b.likes, 0) / lowSkinGroup.length)
    : 0;

  const highVsLowMultiplier = avgLikesLow > 0 && avgLikesHigh > 0
    ? (avgLikesHigh / avgLikesLow).toFixed(2)
    : '-';

  const midVsLowMultiplier = avgLikesLow > 0 && avgLikesMid > 0
    ? (avgLikesMid / avgLikesLow).toFixed(2)
    : '-';

  return (
    <div className="space-y-6">
      {/* 露出3区分 統計サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
          <p className="text-[11px] sm:text-xs text-slate-400">平均 肌色検出率</p>
          <p className="text-xl sm:text-2xl font-bold text-pink-400 mt-1">{avgSkin.toFixed(1)}%</p>
          <p className="text-[10px] text-slate-500 mt-0.5 sm:mt-1">全体: {records.length} 件</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
          <p className="text-[11px] sm:text-xs text-slate-400">低露出 (&lt;8%)</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-200 mt-1">
            {avgLikesLow > 0 ? avgLikesLow.toLocaleString() : '-'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 sm:mt-1">衣装・顔中心: {lowSkinGroup.length} 件</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-pink-500/20">
          <p className="text-[11px] sm:text-xs text-slate-400">中露出 (8〜18%)</p>
          <p className="text-xl sm:text-2xl font-bold text-pink-300 mt-1">
            {avgLikesMid > 0 ? avgLikesMid.toLocaleString() : '-'}
          </p>
          <p className="text-[10px] text-pink-400/80 mt-0.5 sm:mt-1">
            {midVsLowMultiplier !== '-' ? `低露出の ${midVsLowMultiplier} 倍 (${midSkinGroup.length}件)` : `${midSkinGroup.length} 件`}
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-rose-500/30">
          <p className="text-[11px] sm:text-xs text-slate-400">高露出 (18%〜)</p>
          <p className="text-xl sm:text-2xl font-bold text-rose-400 mt-1">
            {avgLikesHigh > 0 ? avgLikesHigh.toLocaleString() : '-'}
          </p>
          <p className="text-[10px] text-rose-400/80 mt-0.5 sm:mt-1">
            {highVsLowMultiplier !== '-' ? `低露出の ${highVsLowMultiplier} 倍 (${highSkinGroup.length}件)` : `${highSkinGroup.length} 件`}
          </p>
        </div>
      </div>


      {/* 散布図: 肌色比率 vs いいね数 */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">肌色比率 vs いいね数 相関分布図</h3>
            <p className="text-xs text-slate-400">横軸: 肌色比率(%) / 縦軸: いいね数 (バズスコアに応じて円サイズが変化)</p>
          </div>
        </div>

        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                dataKey="skinPct"
                name="肌色比率"
                unit="%"
                stroke="#94a3b8"
                domain={[0, 100]}
              />
              <YAxis
                type="number"
                dataKey="likes"
                name="いいね数"
                stroke="#94a3b8"
              />
              <ZAxis
                type="number"
                dataKey="buzzScore"
                range={[40, 300]}
                name="バズスコア"
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
                        <p className="font-semibold text-pink-400">@{data.name}</p>
                        <p className="text-slate-300">肌色比率: <span className="font-bold text-white">{data.skinPct}%</span></p>
                        <p className="text-slate-300">いいね数: <span className="font-bold text-white">{data.likes.toLocaleString()}</span></p>
                        <p className="text-slate-300">バズスコア: <span className="font-bold text-amber-400">{data.buzzScore}点</span></p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="ツイート" data={chartData} fill="#ec4899" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
