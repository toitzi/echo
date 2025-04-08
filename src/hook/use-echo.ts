import Pusher from 'pusher-js';
import { useEffect, useRef } from 'react';
import Echo, { type Broadcaster, type EchoOptions } from '../echo';

// Type definitions
type AvailableBroadcasters = keyof Broadcaster;

type Channel<T extends AvailableBroadcasters> = Broadcaster[T]['public'] | Broadcaster[T]['private'];

type ChannelData<T extends AvailableBroadcasters> = {
    count: number;
    channel: Channel<T>;
};

interface UseEchoParams<T> {
    channel: string;
    event: string | string[];
    callback: (payload: T) => void;
    dependencies?: any[];
    visibility?: 'private' | 'public';
}

// Singleton instance management
let echoInstance: Echo<AvailableBroadcasters> | null = null;
let echoConfig: EchoOptions<AvailableBroadcasters> | null = null;
const channels: Record<string, ChannelData<AvailableBroadcasters>> = {};

// Helper functions
const getEchoInstance = <T extends AvailableBroadcasters>(): Echo<T> => {
    if (echoInstance) {
        return echoInstance as Echo<T>;
    }

    if (!echoConfig) {
        throw new Error(
            'Echo has not been configured. Please call `configureEcho()` with your configuration options before using Echo.'
        );
    }

    echoConfig.Pusher ??= Pusher;

    // Configure Echo with provided config
    echoInstance = new Echo(echoConfig);

    return echoInstance as Echo<T>;
};

const subscribeToChannel = <T extends AvailableBroadcasters>(channelName: string, isPrivate = false): Channel<T> => {
    const instance = getEchoInstance<T>();

    return isPrivate ? instance.private(channelName) : instance.channel(channelName);
};

const leaveChannel = (channelName: string): void => {
    getEchoInstance().leaveChannel(channelName);
};

// Export Echo configuration and instance management
export const configureEcho = <T extends AvailableBroadcasters>(config: EchoOptions<T>): void => {
    echoConfig = config;
    // Reset the instance if it was already created
    if (echoInstance) {
        echoInstance = null;
    }
};

export const echo = <T extends AvailableBroadcasters>(): Echo<T> => getEchoInstance<T>();

// The main hook for using Echo in React components
export const useEcho = <T>(params: UseEchoParams<T>) => {
    const { channel, event, callback, dependencies = [], visibility = 'private' } = params;

    const eventRef = useRef(callback);

    useEffect(() => {
        // Always use the latest callback
        eventRef.current = callback;

        const isPrivate = visibility === 'private';
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
            const channelName = visibility === 'public' ? channel : `${visibility}-${channel}`;
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
