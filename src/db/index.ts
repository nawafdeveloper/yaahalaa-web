import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { schema } from './schema';
import { getServerEnv } from '@/lib/server-env';

const { DATABASE_URL } = getServerEnv();

const sql = neon(DATABASE_URL);
const db = drizzle({ client: sql, schema: schema });

export default db;
