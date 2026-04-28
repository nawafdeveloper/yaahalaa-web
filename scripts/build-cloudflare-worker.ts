import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

export default openNextWorker;

export {
    BucketCachePurge,
    ChatRoomDO,
    DOQueueHandler,
    DOShardedTagCache,
    UserPresenceDO,
};
`;

writeFileSync(wrapperPath, wrapperSource, "utf8");
