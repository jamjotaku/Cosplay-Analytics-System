import { TweetAnalysisData } from '@/types/tweet';

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
}): {
  hoursElapsed: number;
  engagementTotal: number;
  engagementRateFollowers: number;
  engagementRateViews: number;
  velocityHourly: number;
  spreadRatio: number;
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
    averageSkinRatio,
  } = params;

  // 1. 経過時間計算 (最低0.2時間 = 12分としてゼロ除算回避)
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  const hoursElapsed = Math.max(0.2, Number(diffHours.toFixed(2)));

  // 2. 総エンゲージメント数
  const engagementTotal = likes + retweets + replies + bookmarks;

  // 3. 1時間あたりのいいね獲得初速 (Velocity)
  const velocityHourly = Number((likes / hoursElapsed).toFixed(1));

  // 4. フォロワー比エンゲージメント率 (%)
  const effectiveFollowers = Math.max(1, authorFollowers);
  const engagementRateFollowers = Number(
    ((engagementTotal / effectiveFollowers) * 100).toFixed(2)
  );

  // 5. インプレッション比エンゲージメント率 (%)
  const effectiveImpressions = Math.max(1, impressions || likes * 10);
  const engagementRateViews = Number(
    ((engagementTotal / effectiveImpressions) * 100).toFixed(2)
  );

  // 6. 拡散係数 (RP比率 = リポスト数 / いいね数)
  // 一般的にコスプレ等ではRP/Likeが0.1〜0.15を超えると外部タイムラインへ激しく拡散中
  const spreadRatio = likes > 0 ? Number((retweets / likes).toFixed(3)) : 0;

  // 7. 総合バズスコア (0〜100点)
  // 重み付け:
  // - 初速 (時速500いいねで満点40点)
  // - インプレッション効率 (3%で満点25点)
  // - 拡散係数 (0.15以上で満点20点)
  // - フォロワー超過率 (フォロワーの10%超で満点15点)
  let scoreVelocity = Math.min(40, (velocityHourly / 500) * 40);
  let scoreViews = Math.min(25, (engagementRateViews / 3.0) * 25);
  let scoreSpread = Math.min(20, (spreadRatio / 0.15) * 20);
  let scoreFollower = Math.min(15, (engagementRateFollowers / 10.0) * 15);

  // 初速ボーナス: 投稿から3時間以内で時速100いいね以上なら初速ボーナス加算
  if (hoursElapsed <= 3 && velocityHourly >= 100) {
    scoreVelocity = Math.min(40, scoreVelocity * 1.25);
  }

  const rawScore = scoreVelocity + scoreViews + scoreSpread + scoreFollower;
  const buzzScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // 8. グレード判定 & バズ可能性テキスト
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
    engagementTotal,
    engagementRateFollowers,
    engagementRateViews,
    velocityHourly,
    spreadRatio,
    buzzScore,
    buzzGrade,
    buzzProbability,
  };
}
