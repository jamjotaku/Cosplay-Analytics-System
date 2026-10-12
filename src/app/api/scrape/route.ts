import { NextRequest, NextResponse } from 'next/server';

// サーバー内レートリミッター（Bot認定回避用）
interface RateLimitTracker {
  timestamps: number[];
}

const globalTracker: RateLimitTracker = {
  timestamps: [],
};

const MAX_REQUESTS_PER_MINUTE = 20;
const MIN_REQUEST_INTERVAL_MS = 2000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweetUrl } = body;

    if (!tweetUrl || typeof tweetUrl !== 'string') {
      return NextResponse.json({ error: 'ツイートURLを指定してください' }, { status: 400 });
    }

    // 1. ツイートID & ユーザー名の抽出
    const tweetMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i);
    if (!tweetMatch) {
      return NextResponse.json({ error: '有効なX(Twitter)のツイートURLではありません' }, { status: 400 });
    }

    const screenName = tweetMatch[1];
    const tweetId = tweetMatch[2];

    // 2. レート制限チェック（安全ガード）
    const now = Date.now();
    globalTracker.timestamps = globalTracker.timestamps.filter((t) => now - t < 60000);

    if (globalTracker.timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      return NextResponse.json(
        {
          error: 'リクエスト制限中です。約1分後に再度お試しください。',
        },
        { status: 429 }
      );
    }

    if (globalTracker.timestamps.length > 0) {
      const lastTime = globalTracker.timestamps[globalTracker.timestamps.length - 1];
      const elapsed = now - lastTime;
      if (elapsed < MIN_REQUEST_INTERVAL_MS) {
        const jitter = Math.floor(Math.random() * 500) + 100;
        await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed + jitter));
      }
    }
    globalTracker.timestamps.push(Date.now());

    // 3. 高精度メタデータAPI（fxtwitter / vxtwitter ハイブリッド取得）
    let tweetData: any = null;

    try {
      const fxRes = await fetch(`https://api.fxtwitter.com/${screenName}/status/${tweetId}`, {
        headers: {
          'User-Agent': 'CosplayAnalyticsBot/1.0 (Mozilla/5.0 compatible)',
        },
        next: { revalidate: 60 },
      });

      if (fxRes.ok) {
        const fxJson = await fxRes.json();
        if (fxJson?.tweet) {
          tweetData = parseFxResult(fxJson.tweet, tweetId, tweetUrl);
        }
      }
    } catch (fxErr) {
      console.warn('FxTwitter API fetch failed:', fxErr);
    }

    // フォールバック: vxtwitter API
    if (!tweetData) {
      try {
        const vxRes = await fetch(`https://api.vxtwitter.com/${screenName}/status/${tweetId}`);
        if (vxRes.ok) {
          const vxJson = await vxRes.json();
          tweetData = parseVxResult(vxJson, tweetId, tweetUrl);
        }
      } catch (vxErr) {
        console.warn('VxTwitter API fallback failed:', vxErr);
      }
    }

    if (!tweetData) {
      return NextResponse.json(
        { error: 'ツイート情報の取得に失敗しました。URLをご確認ください。' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: tweetData });
  } catch (error: any) {
    console.error('Scrape API Exception:', error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました' }, { status: 500 });
  }
}

function parseFxResult(tw: any, tweetId: string, tweetUrl: string) {
  const mediaList: any[] = [];
  
  if (tw.media?.photos && Array.isArray(tw.media.photos)) {
    for (const p of tw.media.photos) {
      mediaList.push({
        type: 'photo',
        url: p.url,
        previewUrl: p.url,
        width: p.width,
        height: p.height,
      });
    }
  }

  return {
    tweetId,
    tweetUrl,
    createdAt: tw.created_at || new Date().toISOString(),
    authorName: tw.author?.name || 'Unknown',
    authorUsername: tw.author?.screen_name || 'unknown',
    authorAvatar: tw.author?.avatar_url || '',
    authorFollowers: tw.author?.followers || 0,
    text: tw.text || '',
    likes: tw.likes || 0,
    retweets: tw.retweets || 0,
    replies: tw.replies || 0,
    bookmarks: tw.bookmarks || 0,
    impressions: tw.views || 0,
    possiblySensitive: tw.possibly_sensitive || false,
    media: mediaList,
  };
}

function parseVxResult(tw: any, tweetId: string, tweetUrl: string) {
  const mediaList: any[] = [];

  if (tw.mediaURLs && Array.isArray(tw.mediaURLs)) {
    for (const url of tw.mediaURLs) {
      mediaList.push({
        type: 'photo',
        url: url,
        previewUrl: url,
      });
    }
  }

  return {
    tweetId,
    tweetUrl,
    createdAt: tw.date || new Date().toISOString(),
    authorName: tw.user_name || 'Unknown',
    authorUsername: tw.user_screen_name || 'unknown',
    authorAvatar: '',
    authorFollowers: 0,
    text: tw.text || '',
    likes: tw.likes || 0,
    retweets: tw.retweets || 0,
    replies: tw.replies || 0,
    bookmarks: 0,
    impressions: tw.views || 0,
    possiblySensitive: false,
    media: mediaList,
  };
}
