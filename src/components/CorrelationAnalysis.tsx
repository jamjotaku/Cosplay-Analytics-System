'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ZAxis,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { SheetRecord } from '@/types/tweet';
import { Camera, Sparkles, TrendingUp, Clock, Award, Users, Calendar } from 'lucide-react';
import { getTweetJSTInfo } from '@/lib/tweetTime';

interface CorrelationAnalysisProps {
  records: SheetRecord[];
}

export const CorrelationAnalysis: React.FC<CorrelationAnalysisProps> = ({ records }) => {
  // 散布図の横軸モード: 'body' (純粋衣装露出度 - AI) または 'total' (画像全体肌色比率)
  const [metricMode, setMetricMode] = useState<'body' | 'total'>('body');
  // 散布図の縦軸モード: 'likes' (いいね数) または 'impressions' (表示回数)
  const [yAxisMode, setYAxisMode] = useState<'likes' | 'impressions'>('likes');
  // 投稿タイミンググラフの切り替え: 'hour' (24時間) または 'day' (曜日別)
  const [timingTab, setTimingTab] = useState<'hour' | 'day'>('hour');

  if (!records || records.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 space-y-2">
        <Sparkles className="w-8 h-8 text-pink-400/50 mx-auto" />
        <p className="text-sm font-semibold text-slate-300">蓄積データがまだありません</p>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          ツイートのURLを分析すると自動的にデータが蓄積され、露出度・構図・時間帯の相関分析チャートが生成されます。
        </p>
      </div>
    );
  }

  // --- 1. 構図別 (引き / ミドル / アップ) の統計集計 ---
  const framingStats = useMemo(() => {
    const groups: Record<string, { count: number; totalLikes: number; totalImps: number; totalScore: number }> = {
      '引き・全身': { count: 0, totalLikes: 0, totalImps: 0, totalScore: 0 },
      'ミドル・半身': { count: 0, totalLikes: 0, totalImps: 0, totalScore: 0 },
      'アップ・接写': { count: 0, totalLikes: 0, totalImps: 0, totalScore: 0 },
    };

    records.forEach((r) => {
      const tag = r.framingTag || 'ミドル・半身';
      if (groups[tag]) {
        groups[tag].count++;
        groups[tag].totalLikes += r.likes || 0;
        groups[tag].totalImps += r.impressions || 0;
        groups[tag].totalScore += r.buzzScore || 0;
      }
    });

    return Object.entries(groups).map(([tag, data]) => ({
      tag,
      count: data.count,
      avgLikes: data.count > 0 ? Math.round(data.totalLikes / data.count) : 0,
      avgImps: data.count > 0 ? Math.round(data.totalImps / data.count) : 0,
      avgScore: data.count > 0 ? Number((data.totalScore / data.count).toFixed(1)) : 0,
    }));
  }, [records]);

  // 最もいいねが多い構図
  const bestFraming = useMemo(() => {
    const valid = framingStats.filter((f) => f.count > 0);
    if (valid.length === 0) return null;
    return valid.reduce((prev, curr) => (curr.avgLikes > prev.avgLikes ? curr : prev));
  }, [framingStats]);

  // --- 2. 露出度別 (3段階) の統計集計 ---
  const skinGroupStats = useMemo(() => {
    const isBody = metricMode === 'body';
    const lowThreshold = isBody ? 0.15 : 0.08;
    const highThreshold = isBody ? 0.35 : 0.18;

    const lowGroup = records.filter((r) => {
      const val = isBody ? (r.bodySkinRatio ?? r.skinRatio) : r.skinRatio;
      return val < lowThreshold;
    });
    const midGroup = records.filter((r) => {
      const val = isBody ? (r.bodySkinRatio ?? r.skinRatio) : r.skinRatio;
      return val >= lowThreshold && val < highThreshold;
    });
    const highGroup = records.filter((r) => {
      const val = isBody ? (r.bodySkinRatio ?? r.skinRatio) : r.skinRatio;
      return val >= highThreshold;
    });

    const getAvg = (list: SheetRecord[]) =>
      list.length > 0 ? Math.round(list.reduce((acc, cur) => acc + (cur.likes || 0), 0) / list.length) : 0;

    const avgLow = getAvg(lowGroup);
    const avgMid = getAvg(midGroup);
    const avgHigh = getAvg(highGroup);

    return {
      low: { count: lowGroup.length, avgLikes: avgLow, label: isBody ? '<15%' : '<8%' },
      mid: { count: midGroup.length, avgLikes: avgMid, label: isBody ? '15〜35%' : '8〜18%' },
      high: { count: highGroup.length, avgLikes: avgHigh, label: isBody ? '35%〜' : '18%〜' },
      multiplier: avgLow > 0 && avgHigh > 0 ? (avgHigh / avgLow).toFixed(1) : '-',
    };
  }, [records, metricMode]);

  // --- 3. 散布図用データ成形 ---
  const scatterData = useMemo(() => {
    return records.map((r) => {
      const effectiveSkin = metricMode === 'body' ? (r.bodySkinRatio ?? r.skinRatio) : r.skinRatio;
      const timingInfo = getTweetJSTInfo(r);
      return {
        name: r.author,
        skinPct: Number((effectiveSkin * 100).toFixed(1)),
        likes: r.likes,
        impressions: r.impressions,
        buzzScore: r.buzzScore,
        framing: r.framingTag || 'ミドル・半身',
        postTiming: timingInfo.formatted,
        imageUrl: r.imageUrl,
        url: r.tweetUrl,
      };
    });
  }, [records, metricMode]);

  // --- 4. 投稿時間帯別 (24時間) のパフォーマンス ---
  // XのSnowflake IDまたはcreatedAtから真の投稿時間(JST)を正確に集計
  const hourlyData = useMemo(() => {
    const hours: { hour: string; count: number; totalLikes: number; avgLikes: number }[] = Array.from(
      { length: 24 },
      (_, i) => ({
        hour: `${String(i).padStart(2, '0')}時`,
        count: 0,
        totalLikes: 0,
        avgLikes: 0,
      })
    );

    records.forEach((r) => {
      try {
        const { hour } = getTweetJSTInfo(r);
        if (hour >= 0 && hour < 24) {
          hours[hour].count++;
          hours[hour].totalLikes += r.likes || 0;
        }
      } catch {
        // ignore
      }
    });

    hours.forEach((h) => {
      h.avgLikes = h.count > 0 ? Math.round(h.totalLikes / h.count) : 0;
    });

    return hours;
  }, [records]);

  const bestHour = useMemo(() => {
    const activeHours = hourlyData.filter((h) => h.count > 0);
    if (activeHours.length === 0) return null;
    return activeHours.reduce((prev, curr) => (curr.avgLikes > prev.avgLikes ? curr : prev));
  }, [hourlyData]);

  // --- 5. 曜日別パフォーマンス (日〜土) ---
  // XのSnowflake IDまたはcreatedAtから真の投稿曜日(JST)を正確に集計
  const weekdayData = useMemo(() => {
    const days = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
    const list = days.map((day) => ({
      day,
      count: 0,
      totalLikes: 0,
      avgLikes: 0,
    }));

    records.forEach((r) => {
      try {
        const { dayIndex } = getTweetJSTInfo(r);
        if (dayIndex >= 0 && dayIndex < 7) {
          list[dayIndex].count++;
          list[dayIndex].totalLikes += r.likes || 0;
        }
      } catch {
        // ignore
      }
    });

    list.forEach((item) => {
      item.avgLikes = item.count > 0 ? Math.round(item.totalLikes / item.count) : 0;
    });

    return list;
  }, [records]);

  const bestDay = useMemo(() => {
    const activeDays = weekdayData.filter((d) => d.count > 0);
    if (activeDays.length === 0) return null;
    return activeDays.reduce((prev, curr) => (curr.avgLikes > prev.avgLikes ? curr : prev));
  }, [weekdayData]);

  // --- 6. フォロワー規模 (Tier) 別ベンチマーク ---
  const tierStats = useMemo(() => {
    const tiers: Record<string, { label: string; count: number; totalLikes: number; totalImps: number; totalScore: number }> = {
      nano: { label: 'ナノ (<5K)', count: 0, totalLikes: 0, totalImps: 0, totalScore: 0 },
      micro: { label: 'マイクロ (5K-20K)', count: 0, totalLikes: 0, totalImps: 0, totalScore: 0 },
      middle: { label: 'ミドル (20K-100K)', count: 0, totalLikes: 0, totalImps: 0, totalScore: 0 },
      mega: { label: 'メガ (>100K)', count: 0, totalLikes: 0, totalImps: 0, totalScore: 0 },
    };

    records.forEach((r) => {
      const f = r.followers || 0;
      let key = 'nano';
      if (f >= 100000) key = 'mega';
      else if (f >= 20000) key = 'middle';
      else if (f >= 5000) key = 'micro';

      tiers[key].count++;
      tiers[key].totalLikes += r.likes || 0;
      tiers[key].totalImps += r.impressions || 0;
      tiers[key].totalScore += r.buzzScore || 0;
    });

    return Object.values(tiers).map((t) => ({
      label: t.label,
      count: t.count,
      avgLikes: t.count > 0 ? Math.round(t.totalLikes / t.count) : 0,
      avgImps: t.count > 0 ? Math.round(t.totalImps / t.count) : 0,
      avgScore: t.count > 0 ? Number((t.totalScore / t.count).toFixed(1)) : 0,
    }));
  }, [records]);

  return (
    <div className="space-y-6">
      {/* 構図別パフォーマンス比較 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 backdrop-blur-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-pink-400" />
            <h3 className="text-sm sm:text-base font-bold text-white">構図別パフォーマンス比較</h3>
            <span className="text-[10px] bg-pink-500/15 text-pink-300 px-2 py-0.5 rounded-full border border-pink-500/30">
              Stage 2
            </span>
          </div>
          {bestFraming && bestFraming.count > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-full font-medium">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>最高反応構図: <b>{bestFraming.tag}</b> (平均 {bestFraming.avgLikes.toLocaleString()} いいね)</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {framingStats.map((item) => {
            const isTop = bestFraming?.tag === item.tag && item.count > 0;
            return (
              <div
                key={item.tag}
                className={`p-4 rounded-xl sm:rounded-2xl border transition ${
                  isTop
                    ? 'bg-gradient-to-b from-pink-950/30 to-slate-950 border-pink-500/40 shadow-lg shadow-pink-500/10'
                    : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">{item.tag}</span>
                  <span className="text-[10px] text-slate-500">{item.count} 件</span>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-xl sm:text-2xl font-black text-white">
                    {item.avgLikes > 0 ? item.avgLikes.toLocaleString() : '-'}
                    <span className="text-xs font-normal text-slate-400 ml-1">avg いいね</span>
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <span>平均スコア: <b className="text-amber-400">{item.avgScore}点</b></span>
                    <span>インプ: <b className="text-blue-400">{item.avgImps > 0 ? item.avgImps.toLocaleString() : '-'}</b></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 露出3区分 統計サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
          <p className="text-[11px] sm:text-xs text-slate-400">蓄積サンプル数</p>
          <p className="text-xl sm:text-2xl font-bold text-pink-400 mt-1">{records.length} 件</p>
          <p className="text-[10px] text-slate-500 mt-0.5 sm:mt-1">
            基準: {metricMode === 'body' ? '純粋衣装露出度 (AI)' : '画像全体比率'}
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
          <p className="text-[11px] sm:text-xs text-slate-400">低露出 ({skinGroupStats.low.label})</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-200 mt-1">
            {skinGroupStats.low.avgLikes > 0 ? skinGroupStats.low.avgLikes.toLocaleString() : '-'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 sm:mt-1">衣装・顔中心: {skinGroupStats.low.count} 件</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-pink-500/20">
          <p className="text-[11px] sm:text-xs text-slate-400">中露出 ({skinGroupStats.mid.label})</p>
          <p className="text-xl sm:text-2xl font-bold text-pink-300 mt-1">
            {skinGroupStats.mid.avgLikes > 0 ? skinGroupStats.mid.avgLikes.toLocaleString() : '-'}
          </p>
          <p className="text-[10px] text-pink-400/80 mt-0.5 sm:mt-1">
            サンプル: {skinGroupStats.mid.count} 件
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-rose-500/30">
          <p className="text-[11px] sm:text-xs text-slate-400">高露出 ({skinGroupStats.high.label})</p>
          <p className="text-xl sm:text-2xl font-bold text-rose-400 mt-1">
            {skinGroupStats.high.avgLikes > 0 ? skinGroupStats.high.avgLikes.toLocaleString() : '-'}
          </p>
          <p className="text-[10px] text-rose-400/80 mt-0.5 sm:mt-1">
            {skinGroupStats.multiplier !== '-' ? `低露出の ${skinGroupStats.multiplier} 倍 (${skinGroupStats.high.count}件)` : `${skinGroupStats.high.count} 件`}
          </p>
        </div>
      </div>

      {/* 散布図: 露出比率 vs いいね数 / 表示回数 */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pink-400" />
              露出度 vs 反応 相関分布図
            </h3>
            <p className="text-xs text-slate-400">
              横軸: {metricMode === 'body' ? '純粋衣装露出度(AI人物切抜)' : '画像全体肌色比率'}(%) / 縦軸: {yAxisMode === 'likes' ? 'いいね数' : '表示回数'}
            </p>
          </div>

          {/* 指標切り替えコントロール */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 横軸トグル */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setMetricMode('body')}
                className={`px-2.5 py-1 rounded-lg transition font-medium ${
                  metricMode === 'body' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                純粋衣装露出 (AI)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('total')}
                className={`px-2.5 py-1 rounded-lg transition font-medium ${
                  metricMode === 'total' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                全体比率
              </button>
            </div>

            {/* 縦軸トグル */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setYAxisMode('likes')}
                className={`px-2.5 py-1 rounded-lg transition font-medium ${
                  yAxisMode === 'likes' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                いいね
              </button>
              <button
                type="button"
                onClick={() => setYAxisMode('impressions')}
                className={`px-2.5 py-1 rounded-lg transition font-medium ${
                  yAxisMode === 'impressions' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                表示回数
              </button>
            </div>
          </div>
        </div>

        <div className="w-full h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                dataKey="skinPct"
                name={metricMode === 'body' ? '純粋衣装露出度' : '全体肌色比率'}
                unit="%"
                stroke="#94a3b8"
                domain={[0, 100]}
              />
              <YAxis
                type="number"
                dataKey={yAxisMode}
                name={yAxisMode === 'likes' ? 'いいね数' : '表示回数'}
                stroke="#94a3b8"
              />
              <ZAxis
                type="number"
                dataKey="buzzScore"
                range={[40, 260]}
                name="バズスコア"
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-950/95 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1 backdrop-blur-md">
                        <p className="font-bold text-pink-400 flex items-center justify-between gap-3">
                          <span>@{data.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{data.framing}</span>
                        </p>
                        <p className="text-slate-300">
                          {metricMode === 'body' ? '純粋衣装露出度:' : '全体肌色比率:'}{' '}
                          <span className="font-bold text-white">{data.skinPct}%</span>
                        </p>
                        <p className="text-slate-300">
                          いいね数: <span className="font-bold text-rose-400">{data.likes.toLocaleString()}</span>
                        </p>
                        {data.impressions > 0 && (
                          <p className="text-slate-300">
                            表示回数: <span className="font-bold text-blue-400">{data.impressions.toLocaleString()}</span>
                          </p>
                        )}
                        <p className="text-slate-300">
                          バズスコア: <span className="font-bold text-amber-400">{data.buzzScore}点</span>
                        </p>
                        {data.postTiming && (
                          <p className="text-[10px] text-slate-400 pt-0.5 border-t border-slate-800">
                            投稿日時: <span className="text-slate-200 font-medium">{data.postTiming}</span>
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="ポスト" data={scatterData} fill="#ec4899" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 投稿タイミング分析 (24時間帯 / 曜日別 切り替え) */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              投稿タイミング別パフォーマンス (JST)
            </h3>
            <p className="text-xs text-slate-400">何曜日・何時台の投稿が最も平均いいね・初速を獲得できているかを可視化</p>
          </div>

          <div className="flex items-center gap-2">
            {/* タブ切り替え */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTimingTab('hour')}
                className={`px-3 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                  timingTab === 'hour' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> 24時間別
              </button>
              <button
                type="button"
                onClick={() => setTimingTab('day')}
                className={`px-3 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                  timingTab === 'day' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> 曜日別
              </button>
            </div>
          </div>
        </div>

        {/* ハイライトバッジ */}
        <div className="flex flex-wrap items-center gap-2">
          {timingTab === 'hour' && bestHour && bestHour.count > 0 && (
            <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full font-medium">
              🌟 最強時間帯: <b>{bestHour.hour}</b> (平均 {bestHour.avgLikes.toLocaleString()} いいね / {bestHour.count}件)
            </span>
          )}
          {timingTab === 'day' && bestDay && bestDay.count > 0 && (
            <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full font-medium">
              🌟 最強曜日: <b>{bestDay.day}</b> (平均 {bestDay.avgLikes.toLocaleString()} いいね / {bestDay.count}件)
            </span>
          )}
        </div>

        {/* チャート表示 */}
        <div className="w-full h-60 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {timingTab === 'hour' ? (
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950/95 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{d.hour} 投稿データ</p>
                          <p className="text-slate-300">投稿数: <span className="font-bold text-white">{d.count} 件</span></p>
                          <p className="text-slate-300">平均いいね: <span className="font-bold text-emerald-400">{d.avgLikes.toLocaleString()}</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="avgLikes" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.hour === bestHour?.hour && entry.count > 0 ? '#10b981' : '#ec4899'}
                      fillOpacity={entry.count > 0 ? 0.9 : 0.2}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={weekdayData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950/95 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{d.day} 投稿データ</p>
                          <p className="text-slate-300">投稿数: <span className="font-bold text-white">{d.count} 件</span></p>
                          <p className="text-slate-300">平均いいね: <span className="font-bold text-emerald-400">{d.avgLikes.toLocaleString()}</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="avgLikes" radius={[4, 4, 0, 0]}>
                  {weekdayData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.day === bestDay?.day && entry.count > 0 ? '#10b981' : '#a855f7'}
                      fillOpacity={entry.count > 0 ? 0.9 : 0.2}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* アカウント規模 (フォロワーTier) 別ベンチマーク (Stage 3 新機能) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 backdrop-blur-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm sm:text-base font-bold text-white">アカウント規模（Tier）別ベンチマーク</h3>
            <span className="text-[10px] bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
              Stage 3
            </span>
          </div>
          <span className="text-xs text-slate-400">同規模アカウントでの目標値・期待値の目安</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {tierStats.map((tier) => (
            <div
              key={tier.label}
              className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl sm:rounded-2xl space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300">{tier.label}</span>
                <span className="text-[10px] text-slate-500">{tier.count} 件</span>
              </div>
              <div>
                <p className="text-xl font-black text-white">
                  {tier.avgLikes > 0 ? tier.avgLikes.toLocaleString() : '-'}
                  <span className="text-xs font-normal text-slate-400 ml-1">avg いいね</span>
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 mt-2 border-t border-slate-800/60">
                  <span>表示回数: <b className="text-blue-400">{tier.avgImps > 0 ? tier.avgImps.toLocaleString() : '-'}</b></span>
                  <span>スコア: <b className="text-amber-400">{tier.avgScore}点</b></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
