import { SheetRecord } from '@/types/tweet';

/**
 * ツイートURLのSnowflake ID、またはcreatedAt、または経過時間から、
 * X上で実際にポストされた正確な日時（Date）を算出
 */
export function getTweetPostDate(
  record: SheetRecord | { tweetUrl: string; createdAt?: string; timestamp?: string; hoursElapsed?: number }
): Date {
  // 1. createdAt があればそれを優先
  if ('createdAt' in record && record.createdAt) {
    const d = new Date(record.createdAt);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. tweetUrl から Snowflake ID を抽出して逆算 (Twitter epoch: 1288834974657)
  const match = record.tweetUrl?.match(/status\/(\d+)/);
  if (match && match[1]) {
    try {
      const id = BigInt(match[1]);
      // Twitter Snowflake: 上位41ビットがエポックからのミリ秒
      const ms = Number((id >> BigInt(22)) + BigInt('1288834974657'));
      const d = new Date(ms);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2010 && d.getFullYear() <= 2035) {
        return d;
      }
    } catch {
      // BigInt error ignore
    }
  }

  // 3. 経過時間 hoursElapsed と取得日時 timestamp から逆算
  if ('hoursElapsed' in record && record.hoursElapsed && record.timestamp) {
    const scrapedDate = new Date(record.timestamp);
    if (!isNaN(scrapedDate.getTime())) {
      return new Date(scrapedDate.getTime() - record.hoursElapsed * 3600 * 1000);
    }
  }

  // 4. フォールバック: timestamp
  if (record.timestamp) {
    const d = new Date(record.timestamp);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
}

/**
 * 日本標準時 (JST, Asia/Tokyo) における時間帯 (0〜23) と曜日 (0〜6: 日〜土) を取得
 */
export function getTweetJSTInfo(
  record: SheetRecord | { tweetUrl: string; createdAt?: string; timestamp?: string; hoursElapsed?: number }
): {
  hour: number;
  dayIndex: number; // 0: 日曜, 1: 月曜, ... 6: 土曜
  dayName: string; // '日曜', '月曜', ...
  formatted: string; // 例: "月曜 22:06"
} {
  const daysJa = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
  const postDate = getTweetPostDate(record);

  // JSTタイムゾーンでの日時文字列を取得
  const jstString = postDate.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
  const jstDate = new Date(jstString);

  const hour = jstDate.getHours();
  const dayIndex = jstDate.getDay();
  const dayName = daysJa[dayIndex];
  const minutes = String(jstDate.getMinutes()).padStart(2, '0');
  const formatted = `${dayName} ${String(hour).padStart(2, '0')}:${minutes}`;

  return {
    hour,
    dayIndex,
    dayName,
    formatted,
  };
}
