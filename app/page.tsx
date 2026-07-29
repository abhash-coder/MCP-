'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectUri(`${window.location.protocol}//${window.location.host}/api/auth/callback`);
    }
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAuthorize = () => {
    if (!clientId || !clientSecret) {
      setStatusMsg('Please provide both Client ID and Client Secret.');
      return;
    }
    window.location.href = `/api/auth/google?clientId=${encodeURIComponent(clientId)}&clientSecret=${encodeURIComponent(clientSecret)}`;
  };

  const handlePollGmail = async () => {
    setPolling(true);
    try {
      const res = await fetch('/api/poll');
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Gmail polled successfully. Processed ${data.processedCount} commands.`);
        fetchTasks();
      } else {
        setStatusMsg(`Error polling Gmail: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMsg(`Connection error: ${err.message}`);
    } finally {
      setPolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
              G
            </div>
            <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-300 bg-clip-text text-transparent">
              Gmail MCP Bridge
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-zinc-400 font-medium">Edge Runtime Active</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Setup Config Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl backdrop-blur">
            <div>
              <h2 className="text-xl font-semibold text-white">Google OAuth Setup</h2>
              <p className="text-xs text-zinc-400 mt-1">Configure Gmail API credentials to authorize access.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Authorized Redirect URI
                </label>
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 select-all font-mono">
                  {redirectUri || 'Detecting...'}
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Copy this URL and add it to your Google Cloud Console OAuth 2.0 Credentials.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Client ID
                </label>
                <input
                  type="text"
                  placeholder="Paste your OAuth Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded-lg p-2.5 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Client Secret
                </label>
                <input
                  type="password"
                  placeholder="Paste your OAuth Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded-lg p-2.5 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none transition"
                />
              </div>

              <button
                onClick={handleAuthorize}
                className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-purple-600/10 cursor-pointer"
              >
                Authenticate with Google
              </button>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl backdrop-blur">
            <div>
              <h3 className="font-semibold text-white">Manual Trigger</h3>
              <p className="text-xs text-zinc-400 mt-1">Trigger a poll cycle to check Gmail for new commands manually.</p>
            </div>
            <button
              onClick={handlePollGmail}
              disabled={polling}
              className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition disabled:opacity-50 cursor-pointer"
            >
              {polling ? 'Polling Gmail...' : 'Poll Gmail Inbox Now'}
            </button>
            {statusMsg && (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-400 break-words">
                {statusMsg}
              </div>
            )}
          </div>
        </div>

        {/* Dashboard & Queue Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Quick Guide Card */}
          <div className="bg-gradient-to-r from-purple-950/20 to-indigo-950/20 border border-purple-900/30 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-purple-300">How to use Gemini with this MCP Bridge</h2>
            <ol className="list-decimal list-inside text-sm text-zinc-400 mt-3 space-y-2">
              <li>
                <strong className="text-zinc-200">Gmail Settings:</strong> Enable the <code className="bg-purple-900/20 text-purple-300 px-1 py-0.5 rounded font-mono text-xs">Google Workspace Extension</code> in your Gemini App settings.
              </li>
              <li>
                <strong className="text-zinc-200">Send Command:</strong> Prompt Gemini: <br />
                <span className="inline-block bg-zinc-950/80 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 mt-1 select-all">
                  Write an email to [YOUR_MCP_EMAIL] with subject "[MCP-Command]" and body "ls". Wait 15 seconds, check your inbox for a reply from [YOUR_MCP_EMAIL], and read me the folder list.
                </span>
              </li>
              <li>
                <strong className="text-zinc-200">Automatic Reply:</strong> The server forwards the task to your local agent, catches the result, and emails it back to Gemini thread seamlessly.
              </li>
            </ol>
          </div>

          {/* Active Tasks Queue */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Pending Task Queue</h2>
                <p className="text-xs text-zinc-400 mt-1">Commands waiting for local agent execution.</p>
              </div>
              <span className="px-2.5 py-1 bg-zinc-800 text-zinc-400 font-mono text-xs rounded-full">
                {tasks.length} pending
              </span>
            </div>

            {tasks.length === 0 ? (
              <div className="py-12 text-center text-zinc-600 flex flex-col items-center justify-center gap-2">
                <svg className="w-8 h-8 opacity-40 animate-pulse text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Queue is empty. Ready for new commands.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <div key={task.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-zinc-700 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-purple-900/20 text-purple-400 px-2 py-0.5 rounded">
                          {task.tool}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">
                          {new Date(task.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm font-mono text-zinc-200 mt-1.5 whitespace-pre bg-zinc-900/40 p-2 border border-zinc-800/60 rounded">
                        {task.arguments.command || JSON.stringify(task.arguments)}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        From: {task.sender}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs rounded-full font-medium">
                      awaiting local agent...
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 bg-zinc-950 mt-auto">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-zinc-600">
          Cloudflare Pages MCP Bridge &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
