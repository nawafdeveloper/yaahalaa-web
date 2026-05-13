declare namespace Cloudflare {
	interface Env {
		VAPID_PRIVATE_KEY: string
		BETTER_AUTH_SECRET: string
		DATABASE_URL: string
		PROFILE_IMAGE_MASTER_KEY: string
		FIREBASE_PROJECT_ID: string
		FIREBASE_SERVICE_ACCOUNT_JSON: string
		AUTHENTICA_API_KEY: string
		AUTHENTICA_TEMPLATE_ID: string
		AUTHENTICA_BASE_URL: string
		PROFILE_IMAGES_BUCKET: R2Bucket
	}
}

interface CloudflareEnv extends Cloudflare.Env {}

declare namespace NodeJS {
	interface ProcessEnv {
		VAPID_PRIVATE_KEY?: string
		BETTER_AUTH_SECRET?: string
		DATABASE_URL?: string
		PROFILE_IMAGE_MASTER_KEY?: string
		FIREBASE_PROJECT_ID?: string
		FIREBASE_SERVICE_ACCOUNT_JSON?: string
	}
}
