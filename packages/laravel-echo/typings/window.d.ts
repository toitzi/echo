import type { JQueryStatic } from "@types/jquery";
import type { AxiosStatic } from "axios";
import type Pusher from "pusher-js";
import type { io } from "socket.io-client";
import type { VueElementConstructor } from "vue";

declare global {
    interface Window {
        Laravel?: {
            csrfToken?: string;
        };

        io?: typeof io;
        Pusher?: typeof Pusher;

        Vue?: VueElementConstructor;
        axios?: AxiosStatic;
        jQuery?: JQueryStatic;
        Turbo?: object;
    }

    const Vue: VueElementConstructor | undefined;
    const axios: AxiosStatic | undefined;
    const jQuery: JQueryStatic | undefined;
    const Turbo: object | undefined;
}
