import { type BroadcastDriver } from "laravel-echo";
import { useCallback, useEffect, useRef } from "react";
import { echo } from "../config";
import type {
    Channel,
    ChannelData,
    ChannelReturnType,
    Connection,
    ModelEvents,
    ModelPayload,
} from "../types";
import { toArray } from "../util";

const channels: Record<string, ChannelData<BroadcastDriver>> = {};

const subscribeToChannel = <T extends BroadcastDriver>(
    channel: Channel,
): Connection<T> => {
    const instance = echo<T>();

    if (channel.visibility === "presence") {
        return instance.join(channel.name);
    }

    if (channel.visibility === "private") {
        return instance.private(channel.name);
    }

    return instance.channel(channel.name);
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
        echo().leave(channel.name);
    } else {
        echo().leaveChannel(channel.id);
    }

    delete channels[channel.id];
};

const resolveChannelSubscription = <T extends BroadcastDriver>(
    channel: Channel,
): Connection<T> => {
    if (channels[channel.id]) {
        channels[channel.id].count += 1;

        return channels[channel.id].connection;
    }

    const channelSubscription = subscribeToChannel<T>(channel);

    channels[channel.id] = {
        count: 1,
        connection: channelSubscription,
    };

    return channelSubscription;
};

export const useEcho = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
    TVisibility extends Channel["visibility"] = "private",
>(
    channelName: string,
    event: string | string[] = [],
    callback: (payload: TPayload, event: string) => void = () => {},
    dependencies: any[] = [],
    visibility: TVisibility = "private" as TVisibility,
) => {
    const channel: Channel = {
        name: channelName,
        id: ["private", "presence"].includes(visibility)
            ? `${visibility}-${channelName}`
            : channelName,
        visibility,
    };

    const callbackFunc = useCallback(callback, dependencies);
    const listening = useRef(false);
    const initialized = useRef(false);
    const subscription = useRef<Connection<TDriver>>(
        resolveChannelSubscription<TDriver>(channel),
    );

    const events = toArray(event);

    const stopListening = useCallback(() => {
        if (!listening.current) {
            return;
        }

        events.forEach((e) => {
            subscription.current.stopListening(e, (payload: TPayload) =>
                callbackFunc(payload, e),
            );
        });

        listening.current = false;
    }, dependencies);

    const listen = useCallback(() => {
        if (listening.current) {
            return;
        }

        events.forEach((e) => {
            subscription.current.listen(e, (payload: TPayload) =>
                callbackFunc(payload, e),
            );
        });

        listening.current = true;
    }, dependencies);

    const tearDown = useCallback((leaveAll: boolean = false) => {
        stopListening();

        leaveChannel(channel, leaveAll);
    }, dependencies);

    useEffect(() => {
        if (initialized.current) {
            subscription.current = resolveChannelSubscription<TDriver>(channel);
        }

        initialized.current = true;

        listen();

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
         * Stop listening for event(s) without leaving the channel
         */
        stopListening,
        /**
         * Listen for event(s)
         */
        listen,
        /**
         * Channel instance
         */
        channel: () =>
            subscription.current as ChannelReturnType<TDriver, TVisibility>,
    };
};

export const useEchoPresence = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: string,
    event: string | string[] = [],
    callback: (payload: TPayload, event: string) => void = () => {},
    dependencies: any[] = [],
) => {
    return useEcho<TPayload, TDriver, "presence">(
        channelName,
        event,
        callback,
        dependencies,
        "presence",
    );
};

export const useEchoPublic = <
    TPayload,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    channelName: string,
    event: string | string[] = [],
    callback: (payload: TPayload, event: string) => void = () => {},
    dependencies: any[] = [],
) => {
    return useEcho<TPayload, TDriver, "public">(
        channelName,
        event,
        callback,
        dependencies,
        "public",
    );
};

export const useEchoModel = <
    TPayload,
    TModel extends string,
    TDriver extends BroadcastDriver = BroadcastDriver,
>(
    model: TModel,
    identifier: string | number,
    event: ModelEvents<TModel> | ModelEvents<TModel>[] = [],
    callback: (
        payload: ModelPayload<TPayload>,
        event: string,
    ) => void = () => {},
    dependencies: any[] = [],
) => {
    return useEcho<ModelPayload<TPayload>, TDriver, "private">(
        `${model}.${identifier}`,
        toArray(event).map((e) => (e.startsWith(".") ? e : `.${e}`)),
        callback,
        dependencies,
        "private",
    );
};
