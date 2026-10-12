import { NextRequest, NextResponse } from 'next/server';

// サーバー内レートリミッター（Bot認定回避用）
// メモリ内で過去1分・1時間のリクエスト頻度を記録
interface RateLimitTracker {
  timestamps: number[];
}

const globalTracker: RateLimitTracker = {
  timestamps: [],
};

const MAX_REQUESTS_PER_MINUTE = 15; // 1分あたり最大15回までに安全制限
const MIN_REQUEST_INTERVAL_MS = 2500; // 最低リクエスト間隔 2.5秒

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweetUrl } = body;

    if (!tweetUrl || typeof tweetUrl !== 'string') {
      return NextResponse.json({ error: 'ツイートURLを指定してください' }, { status: 400 });
    }

    // 1. ツイートIDの抽出
    const tweetIdMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i);
    if (!tweetIdMatch) {
      return NextResponse.json({ error: '有効なX(Twitter)のツイートURLではありません' }, { status: 400 });
    }

    const tweetId = tweetIdMatch[2];

    // 2. レート制限チェック（Bot BAN回避）
    const now = Date.now();
    globalTracker.timestamps = globalTracker.timestamps.filter((t) => now - t < 60000);

    if (globalTracker.timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      return NextResponse.json(
        {
          error: 'Bot認定回避のためのリクエスト制限中です。約1分後に再度お試しください。',
        },
        { status: 429 }
      );
    }

    // 前のリクエストとの間に安全な待機（ジッター）を入れる
    if (globalTracker.timestamps.length > 0) {
      const lastTime = globalTracker.timestamps[globalTracker.timestamps.length - 1];
      const elapsed = now - lastTime;
      if (elapsed < MIN_REQUEST_INTERVAL_MS) {
        const jitter = Math.floor(Math.random() * 800) + 200; // 200~1000msのランダムジッター
        await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed + jitter));
      }
    }
    globalTracker.timestamps.push(Date.now());

    // 3. 環境変数からCookie情報を取得
    const authToken = process.env.X_AUTH_TOKEN;
    const ct0 = process.env.X_CT0;

    if (!authToken || !ct0) {
      return NextResponse.json(
        {
          error: 'サーバーにXの認証情報(Cookie)が設定されていません。.env.localまたはVercel環境変数をご確認ください。',
        },
        { status: 500 }
      );
    }

    // 4. Twitter GraphQL API / Syndication API リクエストの実行
    // X内部GraphQLエンドポイント (TweetResultByRestId)
    const graphqlEndpoint = 'https://x.com/i/api/graphql/2ICvd9TISFEokPvQnlPgwA/TweetResultByRestId';
    const variables = {
      tweetId: tweetId,
      withCommunity: false,
      includePromotedContent: false,
      withVoice: false,
    };
    const features = {
      creator_subscriptions_tweet_preview_api_enabled: true,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      tweetypie_unmention_optimization_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      rweb_video_timestamps_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    };

    const queryParams = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(features),
    });

    const bearerToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

    let tweetData: any = null;

    try {
      const response = await fetch(`${graphqlEndpoint}?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${bearerToken}`,
          'x-csrf-token': ct0,
          cookie: `auth_token=${authToken}; ct0=${ct0};`,
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-client-language': 'ja',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          referer: 'https://x.com/',
        },
      });

      if (response.ok) {
        const json = await response.json();
        const tweetResult = json?.data?.tweetResult?.result;
        if (tweetResult) {
          tweetData = parseGraphQLResult(tweetResult, tweetId, tweetUrl);
        }
      }
    } catch (apiErr) {
      console.warn('GraphQL endpoint failed, falling back to syndication API:', apiErr);
    }

    // GraphQLが取得できなかった場合のSyndication APIフォールバック
    if (!tweetData) {
      try {
        const synRes = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=ja`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          },
        });
        if (synRes.ok) {
          const synJson = await synRes.json();
          tweetData = parseSyndicationResult(synJson, tweetId, tweetUrl);
        }
      } catch (synErr) {
        console.error('Syndication API error:', synErr);
      }
    }

    if (!tweetData) {
      return NextResponse.json(
        { error: 'ツイート情報の取得に失敗しました。URLまたはCookieが有効かご確認ください。' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: tweetData });
  } catch (error: any) {
    console.error('Scrape API Exception:', error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました' }, { status: 500 });
  }
}

function parseGraphQLResult(rawResult: any, tweetId: string, tweetUrl: string) {
  // TweetWithVisibilityResults などのラッパーを展開
  let result = rawResult;
  if (result?.__typename === 'TweetWithVisibilityResults' && result?.tweet) {
    result = result.tweet;
  }
  if (result?.__typename === 'TweetWithCommunityResults' && result?.tweet) {
    result = result.tweet;
  }

  const legacy = result?.legacy || result?.tweet?.legacy || {};
  const core = result?.core?.user_results?.result || result?.tweet?.core?.user_results?.result || {};
  const userLegacy = core?.legacy || {};
  const views = result?.views?.count || result?.tweet?.views?.count || '0';

  const mediaList: any[] = [];
  const extendedMedia = legacy?.extended_entities?.media || [];
  for (const m of extendedMedia) {
    mediaList.push({
      type: m.type || 'photo',
      url: m.media_url_https,
      previewUrl: m.media_url_https,
      width: m.original_info?.width,
      height: m.original_info?.height,
    });
  }

  const authorName = userLegacy.name || core?.rest_id || 'Unknown';
  const authorUsername = userLegacy.screen_name || 'unknown';

  return {
    tweetId,
    tweetUrl,
    createdAt: legacy.created_at || new Date().toISOString(),
    authorName,
    authorUsername,
    authorAvatar: userLegacy.profile_image_url_https || '',
    authorFollowers: userLegacy.followers_count || 0,
    text: legacy.full_text || '',
    likes: legacy.favorite_count || 0,
    retweets: legacy.retweet_count || 0,
    replies: legacy.reply_count || 0,
    bookmarks: legacy.bookmark_count || 0,
    impressions: parseInt(views, 10) || 0,
    possiblySensitive: legacy.possibly_sensitive || false,
    media: mediaList,
  };
}

function parseSyndicationResult(result: any, tweetId: string, tweetUrl: string) {
  const mediaList: any[] = [];
  if (result.photos && Array.isArray(result.photos)) {
    for (const p of result.photos) {
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
    createdAt: result.created_at || new Date().toISOString(),
    authorName: result.user?.name || 'Unknown',
    authorUsername: result.user?.screen_name || 'unknown',
    authorAvatar: result.user?.profile_image_url_https || '',
    authorFollowers: result.user?.followers_count || 0,
    text: result.text || '',
    likes: result.favorite_count || 0,
    retweets: result.conversation_count || 0, // Fallback
    replies: 0,
    bookmarks: 0,
    impressions: 0, // Syndication does not always provide views
    possiblySensitive: result.possibly_sensitive || false,
    media: mediaList,
  };
}
