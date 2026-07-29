import { NextRequest } from 'next/server';
import { listUnreadMessages, getMessage, parseEmailBody, markAsRead } from '../gmail';
import { getKV } from '../kv';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const unreadMessages = await listUnreadMessages();
    const kv = getKV();
    const tasksAdded: any[] = [];

    for (const msg of unreadMessages) {
      const fullMsg = await getMessage(msg.id);
      
      // Parse email headers to find sender and subject
      const headers = fullMsg.payload.headers as { name: string; value: string }[];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
      const messageIdHeader = headers.find(h => h.name.toLowerCase() === 'message-id')?.value || '';

      const bodyText = parseEmailBody(fullMsg);
      
      let parsedPayload: any = null;
      try {
        // Try parsing JSON out of the body
        parsedPayload = JSON.parse(bodyText.trim());
      } catch {
        // Fallback: If not JSON, treat the entire body as a terminal command block
        parsedPayload = {
          tool: 'terminal/run',
          arguments: {
            command: bodyText.trim()
          }
        };
      }

      if (parsedPayload && parsedPayload.tool) {
        const taskId = `task:${Math.random().toString(36).substring(2)}-${Date.now()}`;
        const taskData = {
          id: taskId,
          gmailMessageId: msg.id,
          gmailThreadId: msg.threadId,
          gmailMessageIdHeader: messageIdHeader,
          sender: from,
          subject: subject,
          tool: parsedPayload.tool,
          arguments: parsedPayload.arguments || {},
          status: 'pending',
          createdAt: Date.now()
        };

        // Write task to KV
        await kv.put(taskId, JSON.stringify(taskData));

        // Mark the email as read in Gmail so we do not process it again
        await markAsRead(msg.id);

        tasksAdded.push(taskData);
      }
    }

    return Response.json({
      success: true,
      processedCount: tasksAdded.length,
      tasks: tasksAdded
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
