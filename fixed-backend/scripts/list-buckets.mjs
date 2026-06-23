// Diagnostic: list buckets in the configured Supabase project.
// Run with `node scripts/list-buckets.mjs` from fixed-backend/.
// This is intentionally NOT committed — only used locally to confirm
// the bucket name in .env matches a real bucket on the project.
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  process.exit(1);
}
const c = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await c.storage.listBuckets();
if (error) {
  console.error('listBuckets failed:', error.message);
  process.exit(1);
}
console.log(JSON.stringify(data, null, 2));
