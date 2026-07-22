import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const backendRes = await fetch('http://localhost:8000/ai/analyze-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const contentType = backendRes.headers.get('content-type') || '';
    const status = backendRes.status;

    if (contentType.includes('application/json')) {
      const data = await backendRes.json();
      return NextResponse.json(data, { status });
    }

    const text = await backendRes.text();
    return new Response(text, { status, headers: { 'content-type': contentType || 'text/plain' } });
  } catch (err) {
    console.error('Proxy to AI analyze failed', err);
    return NextResponse.json({ error: 'Failed to contact AI backend' }, { status: 502 });
  }
}
