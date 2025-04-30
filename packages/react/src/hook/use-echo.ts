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

export const configureEcho = <T extends BroadcastDriver>(
    config: EchoOptions<T>,
): void => {
    echoConfig = config;

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

    const tearDown = useCallback((leaveAll: boolean = false) => {
        events.forEach((e) => {
            subscription.current!.stopListening(e, callbackFunc);
        });

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
        /** Leave channel */
        leaveChannel: tearDown,
        /** Leave a channel and also its associated private and presence channels */
        leave: () => tearDown(true),
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
