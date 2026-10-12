/**
 * 画像から被写体に対する肌色ピクセル比率を算出するクライアントサイド解析ユーティリティ
 * YCrCb色空間およびHSV色空間を組み合わせて肌色領域を高精度に判定
 */

export interface SkinAnalysisResult {
  skinRatio: number;          // 0.0 ~ 1.0 (肌色ピクセル比率)
  totalPixels: number;
  skinPixels: number;
  canvasMaskDataUrl?: string; // 肌色部分をハイライトしたプレビュー画像
}

export async function analyzeImageSkinTone(
  imageUrl: string,
  generateMaskPreview: boolean = true
): Promise<SkinAnalysisResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // CORS回避のためのプロキシURL（直接読めない場合のフォールバック）
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    img.src = proxyUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ skinRatio: 0, totalPixels: 0, skinPixels: 0 });
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
        let skinPixels = 0;

        // マスク画像用
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

          // 肌色の色相（Hue）範囲:
          // 人間の肌（色白〜褐色・黒肌まで全て含む）のメラニン・ヘモグロビン色素の色相は
          // 概ね 0°〜25°（赤〜オレンジ〜赤みの黄）または 335°〜360° に集中します。
          // 30°〜60° は純粋な黄色・金色・黄土色・木材・金髪ウィッグ・背景照明となるため除外。
          const isSkinHue = (hue >= 0 && hue <= 25) || (hue >= 335 && hue <= 360);

          // 彩度(S) & 明度(V)の適正範囲
          // S: 0.15 〜 0.75（白飛び、グレー、過剰な蛍光色を除外）
          // V: 0.25 〜 0.98（暗すぎる影、真っ黒、真っ白を除外）
          const isHsvSkin = isSkinHue && saturation >= 0.15 && saturation <= 0.75 && value >= 0.25 && value <= 0.98;

          // YCrCb色空間判定 (Y: 輝度, Cr: 赤成分, Cb: 青成分)
          const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
          const cr = (r - yVal) * 0.713 + 128;
          const cb = (b - yVal) * 0.564 + 128;

          // 厳密なCr/Cb条件: 黄色系はCbが低くなりCrが下がるため、肌色の楕円領域をタイトに制限
          const isYCrCbSkin = cr >= 135 && cr <= 170 && cb >= 85 && cb <= 125;

          // RGB比率条件: 肌は必ず赤み(R)が主成分で、Gより明確に高く、極端な黄色(R≈G)ではない
          // 黄色・ゴールド衣装防止: r - g が 20 以上、かつ g - b が適度であること
          const isStrictRgbSkin = r > g && g > b && (r - g) >= 20 && (r - b) >= 30;

          // 最終判定: HSV条件を満たし、かつ YCrCb または 厳格RGB条件を満たすこと
          const isSkin = isHsvSkin && (isYCrCbSkin || isStrictRgbSkin);

          if (isSkin) {
            skinPixels++;
          }

          if (maskImgData) {
            if (isSkin) {
              // 肌色検知部分をネオンピンク／オレンジで強調
              maskImgData.data[i] = 255;
              maskImgData.data[i + 1] = 70;
              maskImgData.data[i + 2] = 130;
              maskImgData.data[i + 3] = 220;
            } else {
              // 背景は半透明の暗転
              maskImgData.data[i] = 20;
              maskImgData.data[i + 1] = 20;
              maskImgData.data[i + 2] = 25;
              maskImgData.data[i + 3] = 150;
            }
          }
        }

        const skinRatio = totalPixels > 0 ? Number((skinPixels / totalPixels).toFixed(4)) : 0;
        let canvasMaskDataUrl: string | undefined;

        if (maskCanvas && maskCtx && maskImgData) {
          maskCtx.putImageData(maskImgData, 0, 0);
          canvasMaskDataUrl = maskCanvas.toDataURL('image/png');
        }

        resolve({
          skinRatio,
          totalPixels,
          skinPixels,
          canvasMaskDataUrl
        });
      } catch (err) {
        console.warn('Canvas skin analysis error:', err);
        resolve({ skinRatio: 0, totalPixels: 0, skinPixels: 0 });
      }
    };

    img.onerror = () => {
      console.warn('Image load failed for skin analysis:', imageUrl);
      resolve({ skinRatio: 0, totalPixels: 0, skinPixels: 0 });
    };
  });
}
