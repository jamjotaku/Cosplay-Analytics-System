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

  // 肌色高グループ(30%以上) vs 低グループ(30%未満)の平均いいね数
  const highSkinGroup = records.filter((r) => r.skinRatio >= 0.3);
  const lowSkinGroup = records.filter((r) => r.skinRatio < 0.3);

  const avgLikesHigh = highSkinGroup.length > 0
    ? Math.round(highSkinGroup.reduce((a, b) => a + b.likes, 0) / highSkinGroup.length)
    : 0;

  const avgLikesLow = lowSkinGroup.length > 0
    ? Math.round(lowSkinGroup.reduce((a, b) => a + b.likes, 0) / lowSkinGroup.length)
    : 0;

  const skinEffectMultiplier = avgLikesLow > 0 ? (avgLikesHigh / avgLikesLow).toFixed(2) : '-';

  return (
    <div className="space-y-6">
      {/* 統計サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">平均 肌色検出比率</p>
          <p className="text-2xl font-bold text-pink-400 mt-1">{avgSkin.toFixed(1)}%</p>
          <p className="text-[11px] text-slate-500 mt-1">蓄積件数: {records.length} 件</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">肌色比率 30%以上 の平均いいね数</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{avgLikesHigh.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-1">該当件数: {highSkinGroup.length} 件</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400">露出によるインプレッション倍率 (推定)</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{skinEffectMultiplier} 倍</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {skinEffectMultiplier !== '-' ? '低露出層と比較した平均いいね比率' : 'データ蓄積中'}
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
