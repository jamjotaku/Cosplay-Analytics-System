import { NextRequest, NextResponse } from 'next/server';

/**
 * 画像解析時にブラウザの Canvas API が CORS エラーになるのを防ぐための画像プロキシ
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const parsed = new URL(url);
    // X (Twitter) の画像ホストに制限 (pbs.twimg.com など)
    const allowedHosts = ['pbs.twimg.com', 'video.twimg.com', 'ton.twitter.com'];
    if (!allowedHosts.some((h) => parsed.hostname.endsWith(h))) {
      return new NextResponse('Forbidden domain', { status: 403 });
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Referer: 'https://x.com/',
      },
    });

    if (!res.ok) {
      return new NextResponse('Failed to fetch image', { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return new NextResponse(message, { status: 500 });
  }
}
