import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const backendRes = await fetch(`http://localhost:8000/logs/${id}`);

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
