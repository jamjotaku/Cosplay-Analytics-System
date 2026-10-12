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

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // 肌色判定アルゴリズム (YCrCb色空間モデル)
          // Y = 0.299R + 0.587G + 0.114B
          // Cr = (R - Y) * 0.713 + 128
          // Cb = (B - Y) * 0.564 + 128
          const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
          const cr = (r - yVal) * 0.713 + 128;
          const cb = (b - yVal) * 0.564 + 128;

          // 肌色領域条件: Cr ∈ [133, 173] かつ Cb ∈ [77, 127]
          // RGBルール併用: R > G > B、R - G > 15
          const isYCrCbSkin = cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127;
          const isRgbSkin = r > 95 && g > 40 && b > 20 && (r - g) > 15 && (r > b) && (Math.max(r, g, b) - Math.min(r, g, b) > 15);

          const isSkin = isYCrCbSkin || isRgbSkin;

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
