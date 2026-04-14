import db from "@/db";
import { schema } from "@/db/schema";
import { authSharedOptions } from "@/lib/auth-config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getServerEnv } from "@/lib/server-env";

const { BETTER_AUTH_SECRET, BETTER_AUTH_URL } = getServerEnv();

export const auth = betterAuth({
    ...authSharedOptions,
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: schema,
    }),
});
