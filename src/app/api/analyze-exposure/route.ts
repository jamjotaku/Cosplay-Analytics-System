import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30; // Vercel function timeout (最大30秒)

interface GeminiExposureResponse {
  bodySkinRatio: number;
  skinRatio: number;
  framingTag: '引き・全身' | 'ミドル・半身' | 'アップ・接写';
  reasoning: string;
}

// 安定して動作する高速・別枠クォータモデル順
const CANDIDATE_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PROMPT = `あなたはコスプレ画像・ポートレート画像の衣装露出度と構図を客観的に判定する専門アナリストAIです。
画像内の人物と衣装を視覚的に細部まで観察し、以下のJSON形式で回答してください。

重要判定ルール:
1. "白い服"、"白いドレス"、"白いタートルネック"、"白いソファー"、"白い背景壁" を「肌」と誤認しては絶対にいけません。布地と本人の露出肌（顔、首、デコルテ、肩、腹部、脚、腕等）を厳密に区別してください。
2. bodySkinRatio: 人物の体全体（服を着ている部分＋露出している肌）のうち、露出している肌の面積割合 (0.00 〜 1.00 の小数値)。
   - 水着・ビキニ・下着・胸元や腹部が大きく開いた衣装: 0.60 〜 0.95
   - ショート丈Tシャツ＋短パン（お腹・脚・腕が露出）: 0.30 〜 0.55
   - 長袖・タートルネック・ロングドレス（顔や一部の脚のみ露出）: 0.10 〜 0.30
3. skinRatio: 画像全体に対する露出肌の面積割合 (0.00 〜 1.00 の小数値)。
4. framingTag: 構図 ('引き・全身' | 'ミドル・半身' | 'アップ・接写')。
5. reasoning: 判定の根拠を日本語で明確に述べてください（例: "長袖タートルネック衣装のため上半身の露出はなく、露出は顔と座りポーズで見える太もものみです。白い衣装やソファーは肌と明確に区別しています。"）。

以下のJSONフォーマットのみを出力してください:
{
  "bodySkinRatio": number,
  "skinRatio": number,
  "framingTag": "引き・全身" | "ミドル・半身" | "アップ・接写",
  "reasoning": string
}`;

export async function POST(req: NextRequest) {
  try {
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not configured. Falling back to local engine.');
      return NextResponse.json({ success: false, fallback: true, error: 'GEMINI_API_KEY not set' });
    }

    // 環境変数に引用符（" または '）や余分な空白が混ざっているケースを自動サニタイズ
    apiKey = apiKey.replace(/["'\s]/g, '').trim();

    const body = await req.json();
    let base64Data: string | null = null;
    let mimeType = 'image/jpeg';

    if (body.imageBase64) {
      base64Data = body.imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      if (body.mimeType) mimeType = body.mimeType;
    } else if (body.imageUrl) {
      try {
        const imageRes = await fetch(body.imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Referer: 'https://x.com/',
          },
        });
        if (!imageRes.ok) {
          throw new Error(`Failed to fetch image: ${imageRes.statusText}`);
        }
        const contentType = imageRes.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          mimeType = contentType;
        }
        const arrayBuf = await imageRes.arrayBuffer();
        base64Data = Buffer.from(arrayBuf).toString('base64');
      } catch (fetchErr: any) {
        console.warn('Error fetching imageUrl for Gemini analysis:', fetchErr.message);
        return NextResponse.json({ success: false, fallback: true, error: fetchErr.message });
      }
    }

    if (!base64Data) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    const payload = {
      contents: [
        {
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.2,
      },
    };

    const attemptErrors: Record<string, string> = {};

    // 内部自動待機キュー＆モデルフォールバックループ（最大2ラウンド実行）
    for (let round = 1; round <= 2; round++) {
      for (const model of CANDIDATE_MODELS) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 7500); // 7.5秒タイムアウト

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!res.ok) {
            const errText = await res.text();
            attemptErrors[`${model}_r${round}`] = `Status ${res.status}: ${errText.slice(0, 80)}`;
            // 429/503 は混雑中なので次のモデルへ即座にスイッチ
            continue;
          }

          const data = await res.json();
          const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawJsonText) {
            attemptErrors[`${model}_r${round}`] = 'Empty candidate text';
            continue;
          }

          const parsed: GeminiExposureResponse = JSON.parse(rawJsonText);
          
          // 戻り値の正規化 (パーセント表記 30 の場合は 0.30 に補正)
          let rawBody = Number(parsed.bodySkinRatio) || 0;
          if (rawBody > 1) rawBody = rawBody / 100;
          const bodySkinRatio = Math.max(0, Math.min(1, Number(rawBody.toFixed(4))));

          let rawSkin = Number(parsed.skinRatio) || 0;
          if (rawSkin > 1) rawSkin = rawSkin / 100;
          const skinRatio = Math.max(0, Math.min(1, Number(rawSkin.toFixed(4))));

          let framingTag: '引き・全身' | 'ミドル・半身' | 'アップ・接写' = 'ミドル・半身';
          if (parsed.framingTag === '引き・全身' || parsed.framingTag === 'アップ・接写') {
            framingTag = parsed.framingTag;
          }

          return NextResponse.json({
            success: true,
            model,
            round,
            bodySkinRatio,
            skinRatio,
            framingTag,
            reasoning: parsed.reasoning || 'AIによる構図と衣装の自動判定',
          });
        } catch (err: any) {
          attemptErrors[`${model}_r${round}`] = err.message || 'Unknown error';
        }
      }

      // ラウンド1で全モデルが制限/混雑だった場合、1.5秒待機してクォータ回復を待ってからラウンド2を実行
      if (round === 1) {
        await sleep(1500);
      }
    }

    // すべてのモデル・全ラウンドで失敗した場合はローカル色彩判定へ安全フォールバック
    return NextResponse.json({
      success: false,
      fallback: true,
      error: 'All Gemini models temporarily unavailable after auto-retries',
      details: attemptErrors,
    });
  } catch (globalErr: any) {
    console.error('API /api/analyze-exposure error:', globalErr);
    return NextResponse.json({
      success: false,
      fallback: true,
      error: globalErr.message,
    });
  }
}
