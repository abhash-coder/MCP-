import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '../../kv';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const kv = getKV();
  const searchParams = req.nextUrl.searchParams;
  const clientId = searchParams.get('clientId') || process.env.GOOGLE_CLIENT_ID || await kv.get('google_client_id');
  const clientSecret = searchParams.get('clientSecret') || process.env.GOOGLE_CLIENT_SECRET || await kv.get('google_client_secret');

  if (!clientId || !clientSecret) {
    return new Response(
      'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Pass them as query parameters (e.g. ?clientId=xxx&clientSecret=yyy) or configure environment variables.',
      { status: 400 }
    );
  }

  // Persist client details to KV for callback use
  await kv.put('google_client_id', clientId);
  await kv.put('google_client_secret', clientSecret);

  // Generate OAuth redirect URI (dynamic based on current request host)
  const redirectUri = `${req.nextUrl.protocol}//${req.nextUrl.host}/api/auth/callback`;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

  return NextResponse.redirect(authUrl);
}
