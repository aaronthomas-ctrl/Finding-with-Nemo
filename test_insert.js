import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('interactions').insert({
    id: crypto.randomUUID(),
    channel: 'Note',
    summary: 'Test',
    timestamp: new Date().toISOString()
  }).select();
  console.log("interactions insert check:", error ? error : data);
}
run();
