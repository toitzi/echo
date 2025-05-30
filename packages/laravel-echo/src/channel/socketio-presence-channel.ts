import type { PresenceChannel } from "./presence-channel";
import { SocketIoPrivateChannel } from "./socketio-private-channel";

/**
 * This class represents a Socket.io presence channel.
 */
export class SocketIoPresenceChannel
    extends SocketIoPrivateChannel
    implements PresenceChannel
{
    /**
     * Register a callback to be called anytime the member list changes.
     */
    here(callback: CallableFunction): this {
        this.on("presence:subscribed", (members: Record<string, any>[]) => {
            callback(members.map((m) => m.user_info));
        });

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    joining(callback: CallableFunction): this {
        this.on("presence:joining", (member: Record<string, any>) =>
            callback(member.user_info),
        );

        return this;
    }

    /**
     * Send a whisper event to other clients in the channel.
     */
    whisper(eventName: string, data: unknown): this {
        this.socket.emit("client event", {
            channel: this.name,
            event: `client-${eventName}`,
            data: data,
        });

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    leaving(callback: CallableFunction): this {
        this.on("presence:leaving", (member: Record<string, any>) =>
            callback(member.user_info),
        );

        return this;
    }
}
