import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const defaultChannels = {
    WhatsApp: "Hi {contact_name}, this is regarding {company}. We have some updates on {product_line}.",
    EmailSubject: "Updates for {company}",
    EmailBody: "Hi {contact_name},\\n\\nWe wanted to reach out regarding {company} and your interest in {product_line}.\\n\\nBest,\\nTeam",
    LinkedIn: "Hi {contact_name}, let's connect! I work with companies like {company}."
  };
  
  const { data, error } = await supabase.from('settings').upsert({
    id: 1,
    cadence_days: { "1": 7, "2": 14, "3": 30, "4": 30 },
    templates: {
      first_outreach: { ...defaultChannels },
      follow_up: { ...defaultChannels },
      campaign: { ...defaultChannels }
    }
  });
  console.log("Error:", error);
}
run();
