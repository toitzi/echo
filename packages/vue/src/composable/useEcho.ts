import Echo, {
    type BroadcastDriver,
    type Broadcaster,
    type EchoOptions,
} from "laravel-echo";
import Pusher from "pusher-js";
import { onMounted, onUnmounted, ref, watch } from "vue";

type Connection<T extends BroadcastDriver> =
    | Broadcaster[T]["public"]
    | Broadcaster[T]["private"];

type ChannelData<T extends BroadcastDriver> = {
    count: number;
    connection: Connection<T>;
};

type Channel = {
    name: string;
    id: string;
    private: boolean;
};

type ConfigDefaults<O extends BroadcastDriver> = Record<
    O,
    Broadcaster[O]["options"]
>;

let echoInstance: Echo<BroadcastDriver> | null = null;
let echoConfig: EchoOptions<BroadcastDriver> | null = null;
const channels: Record<string, ChannelData<BroadcastDriver>> = {};

const getEchoInstance = <T extends BroadcastDriver>(): Echo<T> => {
    if (echoInstance) {
        return echoInstance as Echo<T>;
    }

    if (!echoConfig) {
        throw new Error(
            "Echo has not been configured. Please call `configureEcho()` with your configuration options before using Echo.",
        );
    }

    echoConfig.Pusher ??= Pusher;

    echoInstance = new Echo(echoConfig);

    return echoInstance as Echo<T>;
};

const resolveChannelSubscription = <T extends BroadcastDriver>(
    channel: Channel,
): Connection<T> | null => {
    if (channels[channel.id]) {
        channels[channel.id].count += 1;

        return channels[channel.id].connection;
    }

    const channelSubscription = subscribeToChannel<T>(channel);

    if (!channelSubscription) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to subscribe to channel: ${channel.id}`);
        return null;
    }

    channels[channel.id] = {
        count: 1,
        connection: channelSubscription,
    };

    return channelSubscription;
};

const subscribeToChannel = <T extends BroadcastDriver>(
    channel: Channel,
): Connection<T> => {
    const instance = getEchoInstance<T>();

    return channel.private
        ? instance.private(channel.name)
        : instance.channel(channel.name);
};

const leaveChannel = (channel: Channel, leaveAll: boolean = false): void => {
    if (!channels[channel.id]) {
        return;
    }

    channels[channel.id].count -= 1;

    if (channels[channel.id].count > 0) {
        return;
    }

    delete channels[channel.id];

    if (leaveAll) {
        getEchoInstance().leave(channel.name);
    } else {
        getEchoInstance().leaveChannel(channel.id);
    }
};

/**
 * Configure the Echo instance with sensible defaults.
 *
 * @link https://laravel.com/docs/broadcasting#client-side-installation
 */
export const configureEcho = <T extends BroadcastDriver>(
    config: EchoOptions<T>,
): void => {
    const defaults: ConfigDefaults<BroadcastDriver> = {
        reverb: {
            broadcaster: "reverb",
            key: import.meta.env.VITE_REVERB_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT,
            wssPort: import.meta.env.VITE_REVERB_PORT,
            forceTLS:
                (import.meta.env.VITE_REVERB_SCHEME ?? "https") === "https",
            enabledTransports: ["ws", "wss"],
        },
        pusher: {
            broadcaster: "reverb",
            key: import.meta.env.VITE_PUSHER_APP_KEY,
            cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
            forceTLS: true,
            wsHost: import.meta.env.VITE_PUSHER_HOST,
            wsPort: import.meta.env.VITE_PUSHER_PORT,
            wssPort: import.meta.env.VITE_PUSHER_PORT,
            enabledTransports: ["ws", "wss"],
        },
        "socket.io": {
            broadcaster: "socket.io",
            host: import.meta.env.VITE_SOCKET_IO_HOST,
        },
        null: {
            broadcaster: "null",
        },
        ably: {
            broadcaster: "pusher",
            key: import.meta.env.VITE_ABLY_PUBLIC_KEY,
            wsHost: "realtime-pusher.ably.io",
            wsPort: 443,
            disableStats: true,
            encrypted: true,
        },
    };

    echoConfig = {
        ...defaults[config.broadcaster],
        ...config,
    } as EchoOptions<BroadcastDriver>;

    // Reset the instance if it was already created
    if (echoInstance) {
        echoInstance = null;
    }
};

export const echo = <T extends BroadcastDriver>(): Echo<T> =>
    getEchoInstance<T>();

export const useEcho = <T>(
    channelName: string,
    event: string | string[],
    callback: (payload: T) => void,
    dependencies: any[] = [],
    visibility: "private" | "public" = "private",
) => {
    const eventCallback = ref(callback);

    watch(
        () => callback,
        (newCallback) => {
            eventCallback.value = newCallback;
        },
    );

    let subscription: Connection<BroadcastDriver> | null = null;
    const events = Array.isArray(event) ? event : [event];
    const isPrivate = visibility === "private";
    const channel: Channel = {
        name: channelName,
        id: isPrivate ? `${visibility}-${channelName}` : channelName,
        private: isPrivate,
    };

    const setupSubscription = () => {
        subscription = resolveChannelSubscription<BroadcastDriver>(channel);

        if (!subscription) {
            return;
        }

        events.forEach((e) => {
            subscription!.listen(e, eventCallback.value);
        });
    };

    const tearDown = (leaveAll: boolean = false) => {
        events.forEach((e) => {
            subscription!.stopListening(e, eventCallback.value);
        });

        leaveChannel(channel, leaveAll);
    };

    onMounted(() => {
        setupSubscription();
    });

    onUnmounted(() => {
        tearDown();
    });

    if (dependencies.length > 0) {
        watch(
            () => dependencies,
            () => {
                tearDown();
                setupSubscription();
            },
            { deep: true },
        );
    }

    return {
        /** Leave channel */
        leaveChannel: tearDown,
        /** Leave a channel and also its associated private and presence channels */
        leave: () => tearDown(true),
    };
};
