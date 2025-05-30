import { Connector } from "./connector";
import {
    SocketIoChannel,
    SocketIoPrivateChannel,
    SocketIoPresenceChannel,
} from "../channel";
import type {
    io,
    ManagerOptions,
    Socket,
    SocketOptions,
} from "socket.io-client";

type AnySocketIoChannel =
    | SocketIoChannel
    | SocketIoPrivateChannel
    | SocketIoPresenceChannel;

/**
 * This class creates a connector to a Socket.io server.
 */
export class SocketIoConnector extends Connector<
    "socket.io",
    SocketIoChannel,
    SocketIoPrivateChannel,
    SocketIoPresenceChannel
> {
    /**
     * The Socket.io connection instance.
     */
    socket: Socket;

    /**
     * All of the subscribed channel names.
     */
    channels: { [name: string]: SocketIoChannel } = {};

    /**
     * Create a fresh Socket.io connection.
     */
    connect(): void {
        let io = this.getSocketIO();

        this.socket = io(
            this.options.host ?? undefined,
            this.options as Partial<ManagerOptions & SocketOptions>,
        );

        this.socket.on("reconnect", () => {
            Object.values(this.channels).forEach((channel) => {
                channel.subscribe();
            });
        });
    }

    /**
     * Get socket.io module from global scope or options.
     */
    getSocketIO(): typeof io {
        if (typeof this.options.client !== "undefined") {
            return this.options.client as typeof io;
        }

        if (typeof window !== "undefined" && typeof window.io !== "undefined") {
            return window.io;
        }

        throw new Error(
            "Socket.io client not found. Should be globally available or passed via options.client",
        );
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(
        name: string,
        event: string,
        callback: CallableFunction,
    ): AnySocketIoChannel {
        return this.channel(name).listen(event, callback);
    }

    /**
     * Get a channel instance by name.
     */
    channel(name: string): AnySocketIoChannel {
        if (!this.channels[name]) {
            this.channels[name] = new SocketIoChannel(
                this.socket,
                name,
                this.options,
            );
        }

        return this.channels[name];
    }

    /**
     * Get a private channel instance by name.
     */
    privateChannel(name: string): SocketIoPrivateChannel {
        if (!this.channels["private-" + name]) {
            this.channels["private-" + name] = new SocketIoPrivateChannel(
                this.socket,
                "private-" + name,
                this.options,
            );
        }

        return this.channels["private-" + name] as SocketIoPrivateChannel;
    }

    /**
     * Get a presence channel instance by name.
     */
    presenceChannel(name: string): SocketIoPresenceChannel {
        if (!this.channels["presence-" + name]) {
            this.channels["presence-" + name] = new SocketIoPresenceChannel(
                this.socket,
                "presence-" + name,
                this.options,
            );
        }

        return this.channels["presence-" + name] as SocketIoPresenceChannel;
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(name: string): void {
        let channels = [name, "private-" + name, "presence-" + name];

        channels.forEach((name) => {
            this.leaveChannel(name);
        });
    }

    /**
     * Leave the given channel.
     */
    leaveChannel(name: string): void {
        if (this.channels[name]) {
            this.channels[name].unsubscribe();

            delete this.channels[name];
        }
    }

    /**
     * Get the socket ID for the connection.
     */
    socketId(): string | undefined {
        return this.socket.id;
    }

    /**
     * Disconnect Socketio connection.
     */
    disconnect(): void {
        this.socket.disconnect();
    }
}
