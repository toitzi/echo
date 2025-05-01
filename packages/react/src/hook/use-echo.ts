import Echo, {
    type BroadcastDriver,
    type Broadcaster,
    type EchoOptions,
} from "laravel-echo";
import Pusher from "pusher-js";
import { useCallback, useEffect, useRef } from "react";

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

const subscribeToChannel = <T extends BroadcastDriver>(
    channel: Channel,
): Connection<T> => {
    const instance = getEchoInstance<T>();

    return channel.private
        ? instance.private(channel.name)
        : instance.channel(channel.name);
};

const leaveChannel = (channel: Channel, leaveAll: boolean): void => {
    if (!channels[channel.id]) {
        return;
    }

    channels[channel.id].count -= 1;

    if (channels[channel.id].count > 0) {
        return;
    }

    if (leaveAll) {
        getEchoInstance().leave(channel.name);
    } else {
        getEchoInstance().leaveChannel(channel.id);
    }

    delete channels[channel.id];
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

const resolveChannelSubscription = <T extends BroadcastDriver>(
    channel: Channel,
): Connection<T> | void => {
    if (channels[channel.id]) {
        channels[channel.id].count += 1;

        return channels[channel.id].connection;
    }

    const channelSubscription = subscribeToChannel<T>(channel);

    if (!channelSubscription) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to subscribe to channel: ${channel.id}`);
        return;
    }

    channels[channel.id] = {
        count: 1,
        connection: channelSubscription,
    };

    return channelSubscription;
};

export const echo = <T extends BroadcastDriver>(): Echo<T> =>
    getEchoInstance<T>();

type ModelName<T extends string> = T extends `App.Models.${infer U}`
    ? U
    : never;

type Events<T extends string> =
    | `${ModelName<T>}Created`
    | `${ModelName<T>}Updated`
    | `${ModelName<T>}Deleted`;

const toArray = <T>(item: T | T[]): T[] =>
    Array.isArray(item) ? item : [item];

export const useEchoModel = <T, M extends string>(
    model: M,
    identifier: string | number,
    event: Events<M> | Events<M>[],
    callback: (payload: T) => void,
    dependencies: any[] = [],
) => {
    return useEcho(
        `${model}.${identifier}`,
        toArray(event).map((e) => (e.startsWith(".") ? e : `.${e}`)),
        callback,
        dependencies,
        "private",
    );
};

export const useEcho = <T, K extends BroadcastDriver = BroadcastDriver>(
    channelName: string,
    event: string | string[],
    callback: (payload: T) => void,
    dependencies: any[] = [],
    visibility: "private" | "public" = "private",
) => {
    const callbackFunc = useCallback(callback, dependencies);
    const subscription = useRef<Connection<K> | null>(null);

    const isPrivate = visibility === "private";
    const events = Array.isArray(event) ? event : [event];
    const channel: Channel = {
        name: channelName,
        id: isPrivate ? `${visibility}-${channelName}` : channelName,
        private: isPrivate,
    };

    const stopListening = () => {
        events.forEach((e) => {
            subscription.current!.stopListening(e, callbackFunc);
        });
    };

    const tearDown = useCallback((leaveAll: boolean = false) => {
        stopListening();

        leaveChannel(channel, leaveAll);
    }, dependencies);

    useEffect(() => {
        const channelSubscription = resolveChannelSubscription<K>(channel);

        if (!channelSubscription) {
            return;
        }

        subscription.current = channelSubscription;

        events.forEach((e) => {
            subscription.current!.listen(e, callbackFunc);
        });

        return tearDown;
    }, dependencies);

    return {
        /**
         * Leave the channel
         */
        leaveChannel: tearDown,
        /**
         * Leave the channel and also its associated private and presence channels
         */
        leave: () => tearDown(true),
        /**
         * Stop listening for an event without leaving the channel
         */
        stopListening,
    };
};

const getEchoInstance = <T extends BroadcastDriver>(): Echo<T> => {
    if (echoInstance) {
        return echoInstance as Echo<T>;
    }

    if (!echoConfig) {
        throw new Error(
            "Echo has not been configured. Please call `configureEcho()`.",
        );
    }

    echoConfig.Pusher ??= Pusher;

    echoInstance = new Echo(echoConfig);

    return echoInstance as Echo<T>;
};
