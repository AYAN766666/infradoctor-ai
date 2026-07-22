import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const backendRes = await fetch(`${API_BASE}/logs/${id}`);

    const contentType = backendRes.headers.get('content-type') || '';
    const status = backendRes.status;

    if (contentType.includes('application/json')) {
      const data = await backendRes.json();
      return NextResponse.json(data, { status });
    }

    const text = await backendRes.text();
    return new Response(text, { status, headers: { 'content-type': contentType || 'text/plain' } });
  } catch (err) {
    console.error('Proxy to logs failed', err);
    return NextResponse.json({ error: 'Failed to contact backend logs' }, { status: 502 });
  }
}
