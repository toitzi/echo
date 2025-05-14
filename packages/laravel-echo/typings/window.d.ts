import type Pusher from "pusher-js";
import type { io } from "socket.io-client";

declare global {
    interface Window {
        Laravel?: {
            csrfToken?: string;
        };

        io?: typeof io;

        Pusher?: typeof Pusher;
    }
}
