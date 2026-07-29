import { NextRequest } from 'next/server';
import { getKV } from '../kv';
import { sendReply } from '../gmail';

export const runtime = 'edge';

// GET: Retrieve pending tasks for local agent
export async function GET(req: NextRequest) {
  try {
    const kv = getKV();
    const listResult = await kv.list({ prefix: 'task:' });
    const tasks: any[] = [];

    for (const key of listResult.keys) {
      const task = await kv.get(key.name, 'json');
      if (task && task.status === 'pending') {
        tasks.push(task);
      }
    }

    return Response.json({ success: true, tasks });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Submit execution result for a task, reply via Gmail, and update status
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, output, exitCode, error } = body;

    if (!taskId) {
      return Response.json({ success: false, error: 'Missing taskId' }, { status: 400 });
    }

    const kv = getKV();
    const task = await kv.get(taskId, 'json');

    if (!task) {
      return Response.json({ success: false, error: `Task not found or expired: ${taskId}` }, { status: 404 });
    }

    if (task.status === 'completed') {
      return Response.json({ success: false, error: 'Task already completed' }, { status: 400 });
    }

    // Build the email response body
    let replyText = '';
    if (error) {
      replyText = `Tool call failed with error:\n\n${error}`;
    } else {
      replyText = `Tool call output (exit code ${exitCode}):\n\n${output}`;
    }

    // Send the reply email back to Gemini
    await sendReply(
      task.sender,
      task.subject,
      task.gmailThreadId,
      task.gmailMessageIdHeader,
      replyText
    );

    // Update status to completed (or delete it to save space in KV)
    await kv.delete(taskId);

    return Response.json({ success: true, message: 'Result submitted and email sent successfully.' });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
