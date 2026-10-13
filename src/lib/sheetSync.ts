import Papa from 'papaparse';
import { SheetRecord } from '@/types/tweet';

function cleanNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
}

function cleanSkinRatio(val: any): number {
  if (val === null || val === undefined) return 0;
  const str = String(val).trim();
  if (str.endsWith('%')) {
    const parsed = parseFloat(str.replace('%', ''));
    return isNaN(parsed) ? 0 : Number((parsed / 100).toFixed(4));
  }
  const parsed = parseFloat(str.replace(/,/g, ''));
  if (isNaN(parsed)) return 0;
  return parsed > 1 ? Number((parsed / 100).toFixed(4)) : Number(parsed.toFixed(4));
}

/**
 * 公開されたGoogleスプレッドシートのCSVデータを取得・パース
 */
export async function fetchSheetData(csvUrl: string): Promise<SheetRecord[]> {
  try {
    const res = await fetch(csvUrl, {
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn('Failed to fetch Google Sheets CSV:', res.status);
      return [];
    }

    const csvText = await res.text();
    if (!csvText || csvText.trim() === '') {
      return [];
    }

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const records: SheetRecord[] = [];

    for (const row of parsed.data) {
      // カラム名の揺れ（日本語 / 英語）に対応
      const tweetUrl = row['tweetUrl'] || row['Tweet URL'] || row['URL'] || row['ツイートURL'] || '';
      if (!tweetUrl) continue;

      const skinRatio = cleanSkinRatio(row['skinRatio'] ?? row['Skin Ratio'] ?? row['肌色比率']);
      const bodySkinRatio = row['bodySkinRatio'] || row['純粋露出度']
        ? cleanSkinRatio(row['bodySkinRatio'] ?? row['純粋露出度'])
        : skinRatio;
      const framingTag = row['framingTag'] || row['構図'] || (skinRatio > 0.35 ? 'アップ・接写' : skinRatio < 0.12 ? '引き・全身' : 'ミドル・半身');

      records.push({
        timestamp: row['timestamp'] || row['Timestamp'] || row['取得日時'] || new Date().toISOString(),
        tweetUrl,
        author: row['author'] || row['Author'] || row['ユーザー名'] || '',
        followers: cleanNumber(row['followers'] ?? row['Followers'] ?? row['フォロワー数']),
        likes: cleanNumber(row['likes'] ?? row['Likes'] ?? row['いいね数']),
        retweets: cleanNumber(row['retweets'] ?? row['Retweets'] ?? row['RP数']),
        impressions: cleanNumber(row['impressions'] ?? row['Impressions'] ?? row['インプレッション']),
        hoursElapsed: cleanNumber(row['hoursElapsed'] ?? row['Hours Elapsed'] ?? row['経過時間'], 1),
        skinRatio,
        buzzScore: cleanNumber(row['buzzScore'] ?? row['Buzz Score'] ?? row['バズスコア']),
        buzzGrade: row['buzzGrade'] || row['Buzz Grade'] || row['評価'] || 'C',
        imageUrl: row['imageUrl'] || row['Image URL'] || row['画像URL'] || '',
        bodySkinRatio,
        framingTag,
      });
    }

    return records;
  } catch (err) {
    console.error('Error fetching sheet data:', err);
    return [];
  }
}

/**
 * 分析結果をCSV形式の行テキストとして生成（スプレッドシートへの手動貼付けやダウンロード用）
 */
export function formatAsCsvRow(record: SheetRecord): string {
  return [
    `"${record.timestamp}"`,
    `"${record.tweetUrl}"`,
    `"${record.author}"`,
    record.followers,
    record.likes,
    record.retweets,
    record.impressions,
    record.hoursElapsed,
    record.skinRatio,
    record.buzzScore,
    `"${record.buzzGrade}"`,
    `"${record.imageUrl}"`,
    record.bodySkinRatio ?? record.skinRatio,
    `"${record.framingTag ?? 'ミドル・半身'}"`,
  ].join(',');
}

export const CSV_HEADER = 'timestamp,tweetUrl,author,followers,likes,retweets,impressions,hoursElapsed,skinRatio,buzzScore,buzzGrade,imageUrl,bodySkinRatio,framingTag';

