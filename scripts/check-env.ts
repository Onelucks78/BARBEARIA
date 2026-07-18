import { config } from 'dotenv';
config({ path: '.env.local' });
console.log('URL:', process.env.SUPABASE_URL || 'UNDEFINED');
console.log('ANON:', process.env.SUPABASE_ANON_KEY?.slice(0, 30) || 'UNDEFINED');
console.log('SVC:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 30) || 'UNDEFINED');
console.log('PROJECT:', process.env.SUPABASE_PROJECT_REF || 'UNDEFINED');
