import Pusher from "pusher-js";
import { useEffect, useRef } from "react";
import Echo, { type Broadcaster, type EchoOptions } from "../echo";

type AvailableBroadcasters = keyof Broadcaster;

// Create a singleton Echo instance
let echoInstance: Echo<AvailableBroadcasters> | null = null;
let echoConfig: EchoOptions<AvailableBroadcasters> | null = null;

// Configure Echo with custom options
export const configureEcho = <T extends AvailableBroadcasters>(
    config: EchoOptions<T>
): void => {
    echoConfig = config;
    // Reset the instance if it was already created
    if (echoInstance) {
        echoInstance = null;
    }
};

// Initialize Echo only once
const getEchoInstance = <T extends AvailableBroadcasters>(): Echo<T> => {
    if (echoInstance) {
        return echoInstance as Echo<T>;
    }

    if (!echoConfig) {
        throw new Error(
            "Echo has not been configured. Please call `configureEcho()` with your configuration options before using Echo."
        );
    }

    echoConfig.Pusher ??= Pusher;

    // Configure Echo with provided config
    echoInstance = new Echo(echoConfig);

    return echoInstance as Echo<T>;
};

type Channel<T extends AvailableBroadcasters> =
    | Broadcaster[T]["public"]
    | Broadcaster[T]["private"];

type ChannelData<T extends AvailableBroadcasters> = {
    count: number;
    channel: Channel<T>;
};

// Keep track of all active channels
const channels: Record<string, ChannelData<AvailableBroadcasters>> = {};

// Export Echo instance for direct access if needed
export const echo = <T extends AvailableBroadcasters>(): Echo<T> =>
    getEchoInstance<T>();

// Helper functions to interact with Echo
export const subscribeToChannel = <T extends AvailableBroadcasters>(
    channelName: string,
    isPrivate = false
): Channel<T> => {
    const instance = getEchoInstance<T>();

    return isPrivate
        ? instance.private(channelName)
        : instance.channel(channelName);
};

export const leaveChannel = (channelName: string): void => {
    getEchoInstance().leaveChannel(channelName);
};

// Define the interface for useEcho hook parameters
interface UseEchoParams<T> {
    channel: string;
    event: string | string[];
    callback: (payload: T) => void;
    dependencies?: any[];
    visibility?: "private" | "public";
}

useEcho<{
    id: number;
    name: string;
    email: string;
    created_at: string;
    updated_at: string;
}>({
    channel: "",
    callback: (payload) => {},
});

// The main hook for using Echo in React components
export const useEcho = <T>(params: UseEchoParams<T>) => {
    const {
        channel,
        event,
        callback,
        dependencies = [],
        visibility = "private",
    } = params;

    const eventRef = useRef(callback);

    useEffect(() => {
        // Always use the latest callback
        eventRef.current = callback;

        const isPrivate = visibility === "private";
        const channelName = isPrivate ? `${visibility}-${channel}` : channel;

        // Reuse existing channel subscription or create a new one
        if (!channels[channelName]) {
            const channelSubscription = subscribeToChannel(channel, isPrivate);
            if (!channelSubscription) return;

            channels[channelName] = {
                count: 1,
                channel: channelSubscription,
            };
        } else {
            channels[channelName].count += 1;
        }

        const subscription = channels[channelName].channel;

        const listener = (payload: T) => {
            eventRef.current(payload);
        };

        const events = Array.isArray(event) ? event : [event];

        // Subscribe to all events
        events.forEach((e) => {
            subscription.listen(e, listener);
        });

        // Cleanup function
        return () => {
            events.forEach((e) => {
                subscription.stopListening(e, listener);
            });

            if (channels[channelName]) {
                channels[channelName].count -= 1;
                if (channels[channelName].count === 0) {
                    leaveChannel(channelName);
                    delete channels[channelName];
                }
            }
        };
    }, [...dependencies]); // eslint-disable-line

    return {
        leaveChannel: () => {
            const channelName =
                visibility === "public" ? channel : `${visibility}-${channel}`;
            if (channels[channelName]) {
                channels[channelName].count -= 1;
                if (channels[channelName].count === 0) {
                    leaveChannel(channelName);
                    delete channels[channelName];
                }
            }
        },
    };
};
