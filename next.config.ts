import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ['mui-one-time-password-input'],
	serverExternalPackages: [
		"better-auth",
		"@better-auth/core",
		"@better-auth/kysely-adapter",
		"kysely",
		"@better-auth/electron",
		"@better-auth/expo",
	],
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
