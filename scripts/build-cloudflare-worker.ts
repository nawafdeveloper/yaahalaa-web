import { execSync } from "node:child_process";
import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const openNextOutputPath = resolve(".open-next");
const staleOutputPaths: string[] = [];

if (existsSync(openNextOutputPath)) {
    try {
        rmSync(openNextOutputPath, {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 200,
        });
    } catch (error) {
        const errorCode =
            error instanceof Error && "code" in error
                ? (error as NodeJS.ErrnoException).code
                : undefined;

        if (errorCode !== "EPERM" && errorCode !== "ENOTEMPTY" && errorCode !== "EBUSY") {
            throw error;
        }

        const staleOutputPath = resolve(
            `.open-next-stale-${Date.now()}-${process.pid}`
        );

        try {
            renameSync(openNextOutputPath, staleOutputPath);
            staleOutputPaths.push(staleOutputPath);
            console.warn(
                `[build-cloudflare-worker] Moved locked OpenNext output to ${staleOutputPath}.`
            );
        } catch (renameError) {
            console.error(
                `[build-cloudflare-worker] Could not clean or move ${openNextOutputPath}. Close any local Next/Wrangler dev server that may be using .open-next, then retry.`
            );
            throw renameError;
        }
    }
}

execSync("npx opennextjs-cloudflare build --skipWranglerConfigCheck", {
    stdio: "inherit",
});

const wrapperPath = resolve(".open-next/worker-with-do.ts");
const wrapperSource = `import openNextWorker, {
    BucketCachePurge,
    DOQueueHandler,
    DOShardedTagCache,
} from "./worker.js";
import { ChatRoomDO } from "../src/do/chat-room.do";
import { UserPresenceDO } from "../src/do/user-presence.do";
import { handleRealtimeUpgrade } from "../src/worker/realtime-upgrade";

const worker = {
    async fetch(
        request: Request,
        env: Parameters<typeof handleRealtimeUpgrade>[1],
        ctx: ExecutionContext
    ) {
        const upgradeResponse = await handleRealtimeUpgrade(request, env);
        if (upgradeResponse) {
            return upgradeResponse;
        }

        return openNextWorker.fetch(request, env, ctx);
    },
};

export default worker;

export {
    BucketCachePurge,
    ChatRoomDO,
    DOQueueHandler,
    DOShardedTagCache,
    UserPresenceDO,
};
`;

writeFileSync(wrapperPath, wrapperSource, "utf8");

for (const staleOutputPath of staleOutputPaths) {
    try {
        rmSync(staleOutputPath, {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 200,
        });
    } catch {
        console.warn(
            `[build-cloudflare-worker] Leaving stale OpenNext output at ${staleOutputPath} because it is still locked. It is safe to delete later.`
        );
    }
}
