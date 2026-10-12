import Papa from 'papaparse';
import { SheetRecord } from '@/types/tweet';

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

      records.push({
        timestamp: row['timestamp'] || row['Timestamp'] || row['取得日時'] || new Date().toISOString(),
        tweetUrl,
        author: row['author'] || row['Author'] || row['ユーザー名'] || '',
        followers: Number(row['followers'] || row['Followers'] || row['フォロワー数'] || 0),
        likes: Number(row['likes'] || row['Likes'] || row['いいね数'] || 0),
        retweets: Number(row['retweets'] || row['Retweets'] || row['RP数'] || 0),
        impressions: Number(row['impressions'] || row['Impressions'] || row['インプレッション'] || 0),
        hoursElapsed: Number(row['hoursElapsed'] || row['Hours Elapsed'] || row['経過時間'] || 1),
        skinRatio: Number(row['skinRatio'] || row['Skin Ratio'] || row['肌色比率'] || 0),
        buzzScore: Number(row['buzzScore'] || row['Buzz Score'] || row['バズスコア'] || 0),
        buzzGrade: row['buzzGrade'] || row['Buzz Grade'] || row['評価'] || 'C',
        imageUrl: row['imageUrl'] || row['Image URL'] || row['画像URL'] || '',
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
  ].join(',');
}

export const CSV_HEADER = 'timestamp,tweetUrl,author,followers,likes,retweets,impressions,hoursElapsed,skinRatio,buzzScore,buzzGrade,imageUrl';
