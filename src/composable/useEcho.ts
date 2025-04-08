import Pusher from 'pusher-js';
import { ref, onMounted, onUnmounted, watch } from 'vue';
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

// Exported functions
export const configureEcho = <T extends AvailableBroadcasters>(config: EchoOptions<T>): void => {
    echoConfig = config;
    // Reset the instance if it was already created
    if (echoInstance) {
        echoInstance = null;
    }
};

export const echo = <T extends AvailableBroadcasters>(): Echo<T> => getEchoInstance<T>();

// The main composable for using Echo in Vue components
export const useEcho = <T>(params: UseEchoParams<T>) => {
    const { channel, event, callback, dependencies = [], visibility = 'private' } = params;

    // Use Vue ref to store the callback
    const eventCallback = ref(callback);

    // Update the callback ref when the callback changes
    watch(
        () => callback,
        (newCallback) => {
            eventCallback.value = newCallback;
        }
    );

    let subscription: Channel<AvailableBroadcasters> | null = null;
    let channelName = '';
    const events = Array.isArray(event) ? event : [event];

    // Setup function to subscribe to channel
    const setupSubscription = () => {
        const isPrivate = visibility === 'private';
        channelName = isPrivate ? `${visibility}-${channel}` : channel;

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

        subscription = channels[channelName].channel;

        const listener = (payload: T) => {
            eventCallback.value(payload);
        };

        // Subscribe to all events
        events.forEach((e) => {
            subscription?.listen(e, listener);
        });
    };

    // Cleanup function to unsubscribe from channel
    const cleanupSubscription = () => {
        if (!subscription) return;

        events.forEach((e) => {
            subscription?.stopListening(e);
        });

        if (channelName && channels[channelName]) {
            channels[channelName].count -= 1;
            if (channels[channelName].count === 0) {
                leaveChannel(channelName);
                delete channels[channelName];
            }
        }
    };

    // Setup on component mount
    onMounted(() => {
        setupSubscription();
    });

    // Cleanup on component unmount
    onUnmounted(() => {
        cleanupSubscription();
    });

    // Watch dependencies for changes
    if (dependencies.length > 0) {
        // Create a function that returns the dependencies array
        const getDependencies = () => dependencies;

        watch(
            getDependencies,
            () => {
                cleanupSubscription();
                setupSubscription();
            },
            { deep: true }
        );
    }

    // Return methods that can be used by the component
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
