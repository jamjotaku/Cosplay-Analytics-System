/**
 * ステージ1: AI人物セグメンテーション (MediaPipe) ＆ 色空間肌色判定ハイブリッドエンジン
 * - MediaPipe Selfie Segmentation により人物領域（服＋肌＋髪）と背景を自動分離
 * - 「純粋衣装露出度（体の面積に対する肌色の比率）」を算出
 * - 構図（引き・全身 / ミドル・半身 / アップ・接写）を自動判定
 * - クライアント側（端末GPU/WASM）で完全実行するためサーバー代は永久に0円
 */

export interface SkinAnalysisResult {
  skinRatio: number;          // 0.0 ~ 1.0 (画像全体に対する肌色比率)
  bodySkinRatio: number;      // 0.0 ~ 1.0 (人物領域に対する純粋衣装露出度)
  personRatio: number;        // 0.0 ~ 1.0 (画像全体に占める人物の面積割合)
  framingTag: '引き・全身' | 'ミドル・半身' | 'アップ・接写';
  totalPixels: number;
  personPixels: number;
  skinPixels: number;
  canvasMaskDataUrl?: string; // 肌色部分をハイライトしたプレビュー画像
  resizedBase64?: string;     // 軽量リサイズ済みBase64 (Gemini視覚AI転送用)
}

let selfieSegmentationPromise: Promise<any> | null = null;

// MediaPipe SelfieSegmentation の遅延初期化（初回のみCDNからロード、最大4秒でタイムアウトしてフォールバック）
function getMediaPipeSegmenter(): Promise<any> {
  if (selfieSegmentationPromise) return selfieSegmentationPromise;
  if (typeof window === 'undefined') return Promise.resolve(null);

  selfieSegmentationPromise = new Promise(async (resolve) => {
    try {
      const loadScript = () =>
        new Promise<void>((res, rej) => {
          if ((window as any).SelfieSegmentation) return res();
          const timer = setTimeout(() => rej(new Error('CDN script load timeout')), 4000);
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
          s.crossOrigin = 'anonymous';
          s.onload = () => {
            clearTimeout(timer);
            res();
          };
          s.onerror = () => {
            clearTimeout(timer);
            rej(new Error('CDN script load failed'));
          };
          document.head.appendChild(s);
        });

      await loadScript();

      if ((window as any).SelfieSegmentation) {
        const segmenter = new (window as any).SelfieSegmentation({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });
        segmenter.setOptions({
          modelSelection: 1, // 1: Landscape (より高精度な全身・境界モデル)
        });

        // 初期化も最大3.5秒でタイムアウト
        const initPromise = segmenter.initialize();
        const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('Init timeout')), 3500));
        await Promise.race([initPromise, timeoutPromise]);

        resolve(segmenter);
      } else {
        resolve(null);
      }
    } catch (err) {
      console.warn('MediaPipe initialization fallback (using pure skin tone):', err);
      resolve(null);
    }
  });

  return selfieSegmentationPromise;
}

export async function analyzeImageSkinTone(
  imageUrl: string,
  generateMaskPreview: boolean = true
): Promise<SkinAnalysisResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // CORS回避のためのプロキシURL
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    img.src = proxyUrl;

    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(getFallbackResult(0, 0, 0));
          return;
        }

        // 高速化のため最大幅600px程度にリサイズして解析
        const maxDimension = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const totalPixels = width * height;

        // --- ステージ1: AI 人物セグメンテーションの取得 ---
        let personMaskData: Uint8ClampedArray | null = null;
        try {
          const segmenter = await getMediaPipeSegmenter();
          if (segmenter) {
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = width;
            maskCanvas.height = height;
            const maskCtx = maskCanvas.getContext('2d');

            await new Promise<void>((segResolve) => {
              const segTimer = setTimeout(() => {
                console.warn('MediaPipe inference timed out, proceeding with skin tone');
                segResolve();
              }, 3000);

              const onResults = (results: any) => {
                clearTimeout(segTimer);
                if (results?.segmentationMask && maskCtx) {
                  maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);
                  const maskImg = maskCtx.getImageData(0, 0, width, height);
                  personMaskData = maskImg.data;
                }
                segResolve();
              };

              segmenter.onResults(onResults);
              segmenter.send({ image: canvas }).catch((e: any) => {
                clearTimeout(segTimer);
                console.warn('Segmenter send failed:', e);
                segResolve();
              });
            });
          }
        } catch (segErr) {
          console.warn('AI segmentation skipped, using fallback:', segErr);
        }

        // --- ピクセル走査 ＆ 色空間判定 ---
        let skinPixels = 0;
        let personPixels = 0;
        let skinInPersonPixels = 0;

        const maskCanvas = generateMaskPreview ? document.createElement('canvas') : null;
        let maskCtx: CanvasRenderingContext2D | null = null;
        let maskImgData: ImageData | null = null;

        if (maskCanvas) {
          maskCanvas.width = width;
          maskCanvas.height = height;
          maskCtx = maskCanvas.getContext('2d');
          if (maskCtx) {
            maskImgData = maskCtx.createImageData(width, height);
          }
        }

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // 人物判定 (MediaPipe マスクがある場合は赤チャネル値 > 60 を人物と判定)
          const isPerson = personMaskData ? personMaskData[i] > 60 : true;
          if (isPerson) {
            personPixels++;
          }

          // RGBからHSV（色相・彩度・明度）を計算
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          const delta = maxVal - minVal;

          let hue = 0;
          if (delta !== 0) {
            if (maxVal === r) {
              hue = ((g - b) / delta) % 6;
            } else if (maxVal === g) {
              hue = (b - r) / delta + 2;
            } else {
              hue = (r - g) / delta + 4;
            }
            hue = Math.round(hue * 60);
            if (hue < 0) hue += 360;
          }

          const saturation = maxVal === 0 ? 0 : delta / maxVal;
          const value = maxVal / 255;

          // --- 多次元・高精度肌色判定エンジン ---
          // 無彩色（白壁、白布、白ソファー）の除外条件: 明るく彩度差が極小 (R≈G≈B)
          const isAchromaticWhite = delta < 14 && minVal >= 160;

          // 1. 通常肌・ピーチ肌・アイボリーベージュ (自然光・暖色系)
          const isNormalSkinHue = (hue >= 0 && hue <= 52) || (hue >= 325 && hue <= 360);
          const isNormalSkin = !isAchromaticWhite && isNormalSkinHue && saturation >= 0.08 && saturation <= 0.80 && value >= 0.25 && value <= 0.99 && (r >= g);

          // 2. 美白肌・陶器肌・クールトーン照明・スタジオ白飛び直前肌 (コスプレ美白加工・青白照明対応)
          const isFairSkin = !isAchromaticWhite && value >= 0.40 && value <= 0.99 && saturation >= 0.04 && saturation < 0.25 &&
                             minVal >= 70 && (r >= b - 15) && (r >= g - 15) &&
                             !(saturation > 0.12 && hue >= 180 && hue <= 250);

          // 3. YCrCb色空間判定 (照明や露出変化に頑健)
          const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
          const cr = (r - yVal) * 0.713 + 128;
          const cb = (b - yVal) * 0.564 + 128;
          const isYCrCbSkin = !isAchromaticWhite && cr >= 126 && cr <= 175 && cb >= 80 && cb <= 135 && value >= 0.25 && value <= 0.99;

          // 総合肌色判定
          const isSkin = !isAchromaticWhite && (isNormalSkin || isFairSkin || (isYCrCbSkin && (isNormalSkinHue || saturation < 0.15)));

          if (isSkin) {
            skinPixels++;
            if (isPerson) {
              skinInPersonPixels++;
            }
          }

          // マスク描画用 (肌色はネオンピンク、背景は暗転)
          if (maskImgData) {
            if (isSkin) {
              maskImgData.data[i] = 255;
              maskImgData.data[i + 1] = 60;
              maskImgData.data[i + 2] = 130;
              maskImgData.data[i + 3] = 230; // 明瞭なネオンピンク
            } else if (isPerson) {
              // 人物の服・髪（半透明薄暗いブルー）
              maskImgData.data[i] = 30;
              maskImgData.data[i + 1] = 40;
              maskImgData.data[i + 2] = 60;
              maskImgData.data[i + 3] = 90;
            } else {
              // 背景（暗転）
              maskImgData.data[i] = 10;
              maskImgData.data[i + 1] = 10;
              maskImgData.data[i + 2] = 15;
              maskImgData.data[i + 3] = 180;
            }
          }
        }

        const skinRatio = totalPixels > 0 ? Number((skinPixels / totalPixels).toFixed(4)) : 0;
        
        // 人物領域が検出された場合は純粋衣装露出度を算出、なければ全体比率でフォールバック
        const effectivePersonPixels = personPixels > (totalPixels * 0.05) ? personPixels : totalPixels;
        const bodySkinRatio = Number(((personMaskData ? skinInPersonPixels : skinPixels) / effectivePersonPixels).toFixed(4));
        const personRatio = Number((personPixels / totalPixels).toFixed(4));

        // 構図タグ判定 (人物の面積割合から自動分類)
        let framingTag: '引き・全身' | 'ミドル・半身' | 'アップ・接写' = 'ミドル・半身';
        if (personRatio < 0.28) {
          framingTag = '引き・全身';
        } else if (personRatio >= 0.58) {
          framingTag = 'アップ・接写';
        }

        let canvasMaskDataUrl: string | undefined;
        if (maskCanvas && maskCtx && maskImgData) {
          maskCtx.putImageData(maskImgData, 0, 0);
          canvasMaskDataUrl = maskCanvas.toDataURL('image/png');
        }

        // Gemini Vision AI 転送用の軽量 Base64 (JPEG, quality 0.85)
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85);

        resolve({
          skinRatio,
          bodySkinRatio,
          personRatio,
          framingTag,
          totalPixels,
          personPixels: effectivePersonPixels,
          skinPixels,
          canvasMaskDataUrl,
          resizedBase64,
        });
      } catch (err) {
        console.warn('Canvas skin analysis error:', err);
        resolve(getFallbackResult(0, 0, 0));
      }
    };

    img.onerror = () => {
      console.warn('Image load failed for skin analysis:', imageUrl);
      resolve(getFallbackResult(0, 0, 0));
    };
  });
}

function getFallbackResult(skinRatio: number, totalPixels: number, skinPixels: number): SkinAnalysisResult {
  return {
    skinRatio,
    bodySkinRatio: skinRatio,
    personRatio: 1.0,
    framingTag: 'ミドル・半身',
    totalPixels,
    personPixels: totalPixels,
    skinPixels,
  };
}
