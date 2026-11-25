import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; kind: string } }
) {
  const { id, kind } = params;
  const backendUrl = `http://127.0.0.1:18080/api/calls/${id}/audio/${kind}`;

  const forwardHeaders: HeadersInit = {};
  const range = request.headers.get('range');
  const ifRange = request.headers.get('if-range');

  if (range) forwardHeaders['range'] = range;
  if (ifRange) forwardHeaders['if-range'] = ifRange;

  try {
    const backendRes = await fetch(backendUrl, {
      method: 'GET',
      headers: forwardHeaders,
      // @ts-ignore
      cache: 'no-store',
    });

    if (!backendRes.ok && backendRes.status !== 206) {
      const errText = await backendRes.text();
      return new NextResponse(errText, {
        status: backendRes.status,
        headers: {
          'Content-Type': backendRes.headers.get('Content-Type') || 'application/json',
        },
      });
    }

    const responseHeaders = new Headers();
    const contentType = backendRes.headers.get('Content-Type') || 'audio/wav';
    responseHeaders.set('Content-Type', contentType);

    const acceptRanges = backendRes.headers.get('Accept-Ranges');
    if (acceptRanges) responseHeaders.set('Accept-Ranges', acceptRanges);

    const contentRange = backendRes.headers.get('Content-Range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    const contentLength = backendRes.headers.get('Content-Length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      { detail: 'Не удалось связаться с сервером телефонии (127.0.0.1:18080)' },
      { status: 502 }
    );
  }
}
