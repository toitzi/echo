import { type BroadcastDriver, type Broadcaster } from "laravel-echo";

export type Connection<T extends BroadcastDriver> =
    | Broadcaster[T]["public"]
    | Broadcaster[T]["private"]
    | Broadcaster[T]["presence"];

export type ChannelData<T extends BroadcastDriver> = {
    count: number;
    connection: Connection<T>;
};

export type Channel = {
    name: string;
    id: string;
    visibility: "private" | "public" | "presence";
};

export type ConfigDefaults<O extends BroadcastDriver> = Record<
    O,
    Broadcaster[O]["options"]
>;

export type ModelPayload<T> = {
    model: T;
    connection: string | null;
    queue: string | null;
    afterCommit: boolean;
};

export type ChannelReturnType<
    T extends BroadcastDriver,
    V extends Channel["visibility"],
> = V extends "presence"
    ? Broadcaster[T]["presence"]
    : V extends "private"
      ? Broadcaster[T]["private"]
      : Broadcaster[T]["public"];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ModelName<T extends string> = T extends `${infer _}.${infer U}`
    ? ModelName<U>
    : T;

export type ModelEvents<T extends string> =
    | `.${ModelName<T>}Retrieved`
    | `.${ModelName<T>}Creating`
    | `.${ModelName<T>}Created`
    | `.${ModelName<T>}Updating`
    | `.${ModelName<T>}Updated`
    | `.${ModelName<T>}Saving`
    | `.${ModelName<T>}Saved`
    | `.${ModelName<T>}Deleting`
    | `.${ModelName<T>}Deleted`
    | `.${ModelName<T>}Trashed`
    | `.${ModelName<T>}ForceDeleting`
    | `.${ModelName<T>}ForceDeleted`
    | `.${ModelName<T>}Restoring`
    | `.${ModelName<T>}Restored`
    | `.${ModelName<T>}Replicating`;
