import { execSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const openNextOutputPath = resolve(".open-next");

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

        if (errorCode !== "EPERM" && errorCode !== "ENOTEMPTY") {
            throw error;
        }

        console.warn(
            `[build-cloudflare-worker] Skipping pre-build cleanup for ${openNextOutputPath} because it is locked on Windows. Continuing with OpenNext build.`
        );
    }
}

execSync("npx opennextjs-cloudflare build", {
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
