import { NextRequest } from 'next/server';
import { getKV } from '../../kv';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const kv = getKV();
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return new Response(`Google OAuth Error: ${error}`, { status: 400 });
  }

  if (!code) {
    return new Response('No code parameter found in callback', { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || await kv.get('google_client_id');
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || await kv.get('google_client_secret');

  if (!clientId || !clientSecret) {
    return new Response('Missing client ID or client secret inside KV configuration', { status: 500 });
  }

  const redirectUri = `${req.nextUrl.protocol}//${req.nextUrl.host}/api/auth/callback`;

  // Exchange authorization code for refresh token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(`Failed to exchange code for tokens: ${errorText}`, { status: 500 });
  }

  const tokenData = await response.json() as { refresh_token?: string; access_token: string };

  if (!tokenData.refresh_token) {
    return new Response(
      'Authentication succeeded, but no refresh_token was returned. If you are re-authenticating, please go to Google Account Security page, remove this app connection, and try again so Google prompt consent screens display offline access approval.',
      { status: 200 }
    );
  }

  // Store refresh token in KV
  await kv.put('google_refresh_token', tokenData.refresh_token);

  return new Response('Authentication successful! Refresh token saved in KV. You can close this tab and start using the MCP bridge.', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
