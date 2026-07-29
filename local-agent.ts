#!/usr/bin/env tsx
/**
 * Gmail MCP Bridge - Local TS Agent
 * 
 * Runs on your local machine. Polls the Cloudflare Next.js server for pending tasks,
 * executes them in your terminal, and posts the results back.
 * 
 * Minimal footprint: <20MB RAM, zero non-standard runtime dependencies.
 * Run with: bun local-agent.ts OR npx tsx local-agent.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// CONFIGURE THIS: Your deployed Cloudflare Next.js URL
const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';
// Polling interval in milliseconds
const POLL_INTERVAL = 3000;

console.log('=============================================');
console.log('  Gmail MCP Bridge - Local Agent Starting   ');
console.log(`  Server: ${SERVER_URL}`);
console.log(`  Polling: every ${POLL_INTERVAL / 1000}s`);
console.log('=============================================\n');

async function executeTask(task: { id: string; tool: string; arguments: any }) {
  const { id: taskId, tool, arguments: args } = task;
  console.log(`[${new Date().toLocaleTimeString()}] Running task ${taskId}: ${tool}`);

  if (tool !== 'terminal/run') {
    return {
      taskId,
      error: `Unsupported tool: ${tool}. This agent only supports terminal/run.`
    };
  }

  const command = args.command;
  if (!command) {
    return {
      taskId,
      error: 'Missing "command" argument'
    };
  }

  console.log(`Executing command: ${command}`);
  try {
    // Run the shell command
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
    });

    const combinedOutput = stdout + (stderr ? `\n--- stderr ---\n${stderr}` : '');
    console.log(`Command finished. Output length: ${combinedOutput.length} chars`);

    return {
      taskId,
      output: combinedOutput,
      exitCode: 0
    };
  } catch (error: any) {
    console.error(`Command failed: ${error.message}`);
    return {
      taskId,
      output: error.stdout || '',
      exitCode: error.code || 1,
      error: error.stderr || error.message
    };
  }
}

async function pollTasks() {
  try {
    const res = await fetch(`${SERVER_URL}/api/tasks`);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as { success: boolean; tasks?: any[]; error?: string };
    if (!data.success) {
      throw new Error(data.error || 'Unknown server error');
    }

    const tasks = data.tasks || [];
    for (const task of tasks) {
      const result = await executeTask(task);
      
      // Submit result back to server
      const postRes = await fetch(`${SERVER_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });

      if (!postRes.ok) {
        console.error(`Failed to submit task result for ${task.id}: HTTP ${postRes.status}`);
      } else {
        console.log(`Task ${task.id} result successfully submitted.`);
      }
    }
  } catch (err: any) {
    console.error(`[Poll Error]: ${err.message}`);
  }
}

// Start polling
pollTasks();
setInterval(pollTasks, POLL_INTERVAL);
