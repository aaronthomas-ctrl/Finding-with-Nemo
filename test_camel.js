import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function toCamel(obj) {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const k in obj) {
      if (k === 'created_at') newObj.createdAt = new Date(obj[k]);
      else if (k === 'updated_at') newObj.updatedAt = new Date(obj[k]);
      else if (k === 'next_follow_up_date') newObj.nextFollowUpDate = obj[k] ? new Date(obj[k]) : null;
      else if (k === 'timestamp') newObj.timestamp = new Date(obj[k]);
      else if (k === 'occurred_at') newObj.timestamp = new Date(obj[k]);
      else if (k === 'date') newObj.date = new Date(obj[k]);
      else if (k === 'valid_from') newObj.validFrom = new Date(obj[k]);
      else if (k === 'valid_to') newObj.validTo = new Date(obj[k]);
      else if (k.includes('_')) {
        const camelK = k.replace(/_([a-z])/g, g => g[1].toUpperCase());
        newObj[camelK] = toCamel(obj[k]);
      } else {
        newObj[k] = toCamel(obj[k]);
      }
    }
    return newObj;
  }
  return obj;
}

async function run() {
  const { data, error } = await supabase.from('settings').select('*');
  console.log("DB:", JSON.stringify(data[0], null, 2));
  console.log("Camel:", JSON.stringify(toCamel(data[0]), null, 2));
}
run();
