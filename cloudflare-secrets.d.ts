declare namespace Cloudflare {
	interface Env {
		VAPID_PRIVATE_KEY: string
		BETTER_AUTH_SECRET: string
		DATABASE_URL: string
	}
}

interface CloudflareEnv extends Cloudflare.Env {}

declare namespace NodeJS {
	interface ProcessEnv {
		VAPID_PRIVATE_KEY?: string
		BETTER_AUTH_SECRET?: string
		DATABASE_URL?: string
	}
}
