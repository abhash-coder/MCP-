import { getKV } from './kv';

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

async function getGmailConfig(): Promise<GmailConfig | null> {
  const kv = getKV();
  const clientId = process.env.GOOGLE_CLIENT_ID || await kv.get('google_client_id');
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || await kv.get('google_client_secret');
  const refreshToken = await kv.get('google_refresh_token');

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken };
}

// Exchanges refresh token for an access token
export async function getAccessToken(): Promise<string> {
  const config = await getGmailConfig();
  if (!config) {
    throw new Error('Gmail configuration is missing. Please authenticate first via /api/auth/google');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Google access token: ${errorText}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

// Fetch unread messages matching a query
export async function listUnreadMessages(query: string = 'subject:"[MCP-Command]" is:unread') {
  const accessToken = await getAccessToken();
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to list messages: ${await response.text()}`);
  }

  const data = await response.json() as { messages?: { id: string; threadId: string }[] };
  return data.messages || [];
}

// Fetch a single message details by ID
export async function getMessage(messageId: string) {
  const accessToken = await getAccessToken();
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get message details: ${await response.text()}`);
  }

  return response.json() as Promise<any>;
}

// Remove UNREAD label from a message (mark as read)
export async function markAsRead(messageId: string) {
  const accessToken = await getAccessToken();
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      removeLabelIds: ['UNREAD'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to mark message as read: ${await response.text()}`);
  }

  return response.json();
}

// Parse body content from a Gmail message payload
export function parseEmailBody(message: any): string {
  let body = '';
  
  if (!message.payload) return '';

  const decodeBase64 = (str: string) => {
    // Gmail returns url-safe base64
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return atob(base64);
  };

  const getParts = (part: any) => {
    if (part.body && part.body.data) {
      body += decodeBase64(part.body.data);
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        getParts(subPart);
      }
    }
  };

  getParts(message.payload);

  if (!body && message.payload.body && message.payload.body.data) {
    body = decodeBase64(message.payload.body.data);
  }

  return body;
}

// Send an email response (in reply to a thread)
export async function sendReply(to: string, subject: string, threadId: string, messageId: string, replyText: string) {
  const accessToken = await getAccessToken();
  
  // Format reply headers properly to stay in the same thread
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject.startsWith('Re:') ? subject : 'Re: ' + subject}`,
    `In-Reply-To: ${messageId}`,
    `References: ${messageId}`,
    `Thread-Topic: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    replyText,
  ];

  const rawEmail = btoa(unescape(encodeURIComponent(emailLines.join('\r\n'))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: rawEmail,
      threadId: threadId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send reply email: ${await response.text()}`);
  }

  return response.json();
}
