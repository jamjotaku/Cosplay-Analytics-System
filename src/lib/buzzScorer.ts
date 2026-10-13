import { TweetAnalysisData, AuthorTier } from '@/types/tweet';

/**
 * 取得したメタデータおよび画像解析結果からバズ度・エンゲージメント指標を多角的に算出
 */
export function calculateBuzzMetrics(params: {
  createdAt: string;
  authorFollowers: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  impressions: number;
  possiblySensitive: boolean;
  averageSkinRatio: number;
  peakSkinRatio?: number;
}): {
  hoursElapsed: number;
  postTiming: string;
  authorTier: AuthorTier;
  engagementTotal: number;
  engagementRateFollowers: number;
  engagementRateViews: number;
  velocityHourly: number;
  spreadRatio: number;
  bookmarkRatio: number;
  buzzScore: number;
  buzzGrade: TweetAnalysisData['buzzGrade'];
  buzzProbability: string;
} {
  const {
    createdAt,
    authorFollowers,
    likes,
    retweets,
    replies,
    bookmarks,
    impressions,
  } = params;

  // 1. 経過時間計算 (最低0.2時間 = 12分としてゼロ除算回避)
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  const hoursElapsed = Math.max(0.2, Number(diffHours.toFixed(2)));

  // 2. 投稿タイミングのフォーマット (JST 曜日・時刻)
  const daysJa = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'];
  const postTiming = `${daysJa[createdDate.getDay()]} ${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`;

  // 3. アカウント規模（Tier）の判定
  let authorTier: AuthorTier = 'ナノ (<5K)';
  if (authorFollowers >= 100000) {
    authorTier = 'メガ (>100K)';
  } else if (authorFollowers >= 20000) {
    authorTier = 'ミドル (20K-100K)';
  } else if (authorFollowers >= 5000) {
    authorTier = 'マイクロ (5K-20K)';
  }

  // 4. 総エンゲージメント数
  const engagementTotal = likes + retweets + replies + bookmarks;

  // 5. 1時間あたりのいいね獲得初速 (Velocity)
  const velocityHourly = Number((likes / hoursElapsed).toFixed(1));

  // 6. フォロワー比エンゲージメント率 (%)
  const effectiveFollowers = Math.max(1, authorFollowers);
  const engagementRateFollowers = Number(
    ((engagementTotal / effectiveFollowers) * 100).toFixed(2)
  );

  // 7. インプレッション比エンゲージメント率 (%)
  const effectiveImpressions = Math.max(1, impressions || likes * 10);
  const engagementRateViews = Number(
    ((engagementTotal / effectiveImpressions) * 100).toFixed(2)
  );

  // 8. 拡散係数 (RP比率 = リポスト数 / いいね数)
  const spreadRatio = likes > 0 ? Number((retweets / likes).toFixed(3)) : 0;

  // 9. 保存価値比率 (ブックマーク比率 = ブックマーク数 / いいね数)
  const bookmarkRatio = likes > 0 ? Number((bookmarks / likes).toFixed(3)) : 0;

  // 10. 総合バズスコア (0〜100点)
  // 基本重み付け:
  // - 初速 (時速400いいねで満点35点)
  // - インプレッション効率 (3%で満点20点)
  // - 拡散係数 (0.12以上で満点20点)
  // - フォロワー超過率 (規模別動的計算で満点15点)
  // - ブックマーク評価 (保存率5%で満点10点 - X最新アルゴリズム対応)
  let scoreVelocity = Math.min(35, (velocityHourly / 400) * 35);
  let scoreViews = Math.min(20, (engagementRateViews / 3.0) * 20);
  let scoreSpread = Math.min(20, (spreadRatio / 0.12) * 20);
  
  // フォロワー規模に応じた公平な評価:
  // ナノ層(<5k)はフォロワーの5%で満点、メガ層(>100k)は2%で満点
  const followerBenchmark = authorFollowers < 5000 ? 5.0 : authorFollowers < 20000 ? 4.0 : 2.5;
  let scoreFollower = Math.min(15, (engagementRateFollowers / followerBenchmark) * 15);

  // ブックマーク加点:
  let scoreBookmark = Math.min(10, (bookmarkRatio / 0.05) * 10);

  // 初速ブーストボーナス: 投稿から3時間以内で時速100いいね以上なら初速を1.2倍
  if (hoursElapsed <= 3 && velocityHourly >= 100) {
    scoreVelocity = Math.min(35, scoreVelocity * 1.2);
  }

  const rawScore = scoreVelocity + scoreViews + scoreSpread + scoreFollower + scoreBookmark;
  const buzzScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // 11. グレード判定 & バズ可能性テキスト
  let buzzGrade: TweetAnalysisData['buzzGrade'] = 'C';
  let buzzProbability = '通常推移';

  if (buzzScore >= 85 || likes >= 10000) {
    buzzGrade = 'SSS';
    buzzProbability = '超ド級のメガバズ中 (アルゴリズム全面拡散)';
  } else if (buzzScore >= 70 || likes >= 3000) {
    buzzGrade = 'S';
    buzzProbability = 'バズ発生確定 (トレンド波及圏内)';
  } else if (buzzScore >= 50 || velocityHourly >= 150) {
    buzzGrade = 'A';
    buzzProbability = '高初速・バズる可能性極めて高い';
  } else if (buzzScore >= 30) {
    buzzGrade = 'B';
    buzzProbability = '平均以上のエンゲージメント (小バズ兆候)';
  } else {
    buzzGrade = 'C';
    buzzProbability = '安定推移 (フォロワー層中心)';
  }

  return {
    hoursElapsed,
    postTiming,
    authorTier,
    engagementTotal,
    engagementRateFollowers,
    engagementRateViews,
    velocityHourly,
    spreadRatio,
    bookmarkRatio,
    buzzScore,
    buzzGrade,
    buzzProbability,
  };
}
