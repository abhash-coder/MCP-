// Cloudflare KV Helper with local fallback for development
// In Cloudflare runtime, the KV namespace is bound to process.env.MCP_TASKS.

interface KVNamespace {
  get(key: string, type?: 'text' | 'json'): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

// In-memory fallback for local dev
const localKVStore = new Map<string, string>();

export const getKV = (): KVNamespace => {
  // If running on Cloudflare Pages/Workers, process.env.MCP_TASKS will be defined
  const binding = (process.env as any).MCP_TASKS;
  if (binding && typeof binding.get === 'function') {
    return binding as KVNamespace;
  }

  // Fallback for local development
  return {
    async get(key: string, type?: 'text' | 'json') {
      const val = localKVStore.get(key);
      if (!val) return null;
      if (type === 'json') {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return val;
    },
    async put(key: string, value: string) {
      localKVStore.set(key, value);
    },
    async delete(key: string) {
      localKVStore.delete(key);
    },
    async list(options?: { prefix?: string }) {
      const prefix = options?.prefix || '';
      const keys = Array.from(localKVStore.keys())
        .filter(k => k.startsWith(prefix))
        .map(name => ({ name }));
      return { keys };
    }
  };
};
