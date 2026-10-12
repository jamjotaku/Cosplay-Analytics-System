import { NextRequest, NextResponse } from 'next/server';

/**
 * 分析結果を Google Apps Script (GAS) Webhook 経由でスプレッドシートへ自動追記
 */
export async function POST(request: NextRequest) {
  try {
    const record = await request.json();
    const gasWebhookUrl = process.env.GAS_WEBHOOK_URL;

    if (!gasWebhookUrl) {
      return NextResponse.json({ message: 'GAS_WEBHOOK_URL not configured' }, { status: 200 });
    }

    const res = await fetch(gasWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      console.warn('GAS webhook responded with status:', res.status);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('GAS sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
