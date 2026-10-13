export interface TweetMedia {
  type: 'photo' | 'video' | 'animated_gif';
  url: string;
  previewUrl: string;
  width?: number;
  height?: number;
  skinRatio?: number; // 0.0 - 1.0 (画像全体に対する肌色比率)
  bodySkinRatio?: number; // 0.0 - 1.0 (人物領域に対する純粋衣装露出度)
  personRatio?: number; // 0.0 - 1.0 (画面に占める人物の割合)
  framingTag?: '引き・全身' | 'ミドル・半身' | 'アップ・接写';
  isPeakSkin?: boolean; // 複数枚中最も露出が高いカット
  sensitiveEstimated?: boolean;
}

export type AuthorTier = 'ナノ (<5K)' | 'マイクロ (5K-20K)' | 'ミドル (20K-100K)' | 'メガ (>100K)';

export interface TweetAnalysisData {
  tweetId: string;
  tweetUrl: string;
  createdAt: string;
  postTiming: string; // 例: "金曜 21:30"
  hoursElapsed: number;
  
  // Author metrics
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  authorFollowers: number;
  authorTier: AuthorTier;
  
  // Tweet metrics
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  impressions: number;
  
  // Sensitive tag
  possiblySensitive: boolean;
  
  // Media items
  media: TweetMedia[];
  averageSkinRatio: number;     // 画像全体の平均肌色比率
  averageBodySkinRatio: number; // 人物領域に対する平均純粋衣装露出度 (Stage 1 AI)
  peakSkinRatio: number;        // 最も露出が高い写真の肌色比率
  framingTag: string;           // '引き・全身' | 'ミドル・半身' | 'アップ・接写'
  
  // Calculated Buzz Metrics
  engagementTotal: number;
  engagementRateFollowers: number; // (Likes+RP+Bookmarks) / Followers * 100
  engagementRateViews: number;     // (Likes+RP+Bookmarks) / Impressions * 100
  velocityHourly: number;          // Likes / HoursElapsed
  spreadRatio: number;             // RP / Likes (拡散意欲比率)
  bookmarkRatio: number;           // Bookmarks / Likes (保存・鑑賞価値比率)
  
  // Buzz Score & Grade
  buzzScore: number;               // 0 - 100
  buzzGrade: 'SSS' | 'S' | 'A' | 'B' | 'C';
  buzzProbability: string;         // '超高確率でバズ中' | 'バズ発生' | '高初速・伸長見込み' | '通常推移'
  
  // Timestamp
  analyzedAt: string;
}

export interface SheetRecord {
  timestamp: string;
  tweetUrl: string;
  author: string;
  followers: number;
  likes: number;
  retweets: number;
  impressions: number;
  hoursElapsed: number;
  skinRatio: number;
  buzzScore: number;
  buzzGrade: string;
  imageUrl: string;
  bodySkinRatio?: number; // 純粋衣装露出度 (AI人物分離)
  framingTag?: string;    // 構図タグ ('引き・全身' | 'ミドル・半身' | 'アップ・接写')
  createdAt?: string;     // Xメタデータの投稿日時 (UTC)
  postTiming?: string;    // JST投稿曜日・時間 (例: "金曜 21:30")
}
