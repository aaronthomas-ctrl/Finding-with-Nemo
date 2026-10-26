function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const config = {
  nebius: {
    get apiKey() { return need('NEBIUS_API_KEY'); },
    baseURL: process.env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1',
  },
  models: {
    get ultra() { return need('MODEL_ULTRA'); },
    get super() { return need('MODEL_SUPER'); },
    get nano() { return need('MODEL_NANO'); },
    get embed() { return need('MODEL_EMBED'); },
  },
  embedDimensions: Number(process.env.EMBED_DIMENSIONS || 1024),
  supabase: {
    get url() { return need('SUPABASE_URL'); },
    get anonKey() { return need('VITE_SUPABASE_ANON_KEY'); },
  },
  get tavilyKey() { return need('TAVILY_API_KEY'); },
  get googleKey() { return need('GOOGLE_MAPS_PLATFORM_KEY'); },
};
