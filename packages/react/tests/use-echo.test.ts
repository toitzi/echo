import { renderHook } from "@testing-library/react";
import Echo from "laravel-echo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getEchoModule = async () => import("../src/hooks/use-echo");
const getConfigModule = async () => import("../src/config/index");

vi.mock("laravel-echo", () => {
    const mockPrivateChannel = {
        leaveChannel: vi.fn(),
        listen: vi.fn(),
        stopListening: vi.fn(),
    };

    const mockPublicChannel = {
        leaveChannel: vi.fn(),
        listen: vi.fn(),
        stopListening: vi.fn(),
    };

    const mockPresenceChannel = {
        leaveChannel: vi.fn(),
        listen: vi.fn(),
        stopListening: vi.fn(),
        here: vi.fn(),
        joining: vi.fn(),
        leaving: vi.fn(),
        whisper: vi.fn(),
    };

    const Echo = vi.fn();

    Echo.prototype.private = vi.fn(() => mockPrivateChannel);
    Echo.prototype.channel = vi.fn(() => mockPublicChannel);
    Echo.prototype.encryptedPrivate = vi.fn();
    Echo.prototype.listen = vi.fn();
    Echo.prototype.leave = vi.fn();
    Echo.prototype.leaveChannel = vi.fn();
    Echo.prototype.leaveAllChannels = vi.fn();
    Echo.prototype.join = vi.fn(() => mockPresenceChannel);

    return { default: Echo };
});

describe("without echo configured", async () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("throws error when Echo is not configured", async () => {
        const echoModule = await getEchoModule();
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        expect(() =>
            renderHook(() =>
                echoModule.useEcho(
                    channelName,
                    event,
                    mockCallback,
                    [],
                    "private",
                ),
            ),
        ).toThrow("Echo has not been configured");
    });
});

describe("useEcho hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leave).toBe("function");

        expect(result.current).toHaveProperty("leave");
        expect(typeof result.current.leaveChannel).toBe("function");
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        const { result, unmount } = renderHook(() =>
            echoModule.useEcho(channelName, events, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");

        expect(echoInstance.private).toHaveBeenCalledWith(channelName);

        const channel = echoInstance.private(channelName);

        const firstCallback = (
            channel.listen as unknown as ReturnType<typeof vi.fn>
        ).mock.calls[0][1];
        const secondCallback = (
            channel.listen as unknown as ReturnType<typeof vi.fn>
        ).mock.calls[1][1];

        expect(channel.listen).toHaveBeenCalledWith(
            events[0],
            expect.any(Function),
        );
        expect(channel.listen).toHaveBeenCalledWith(
            events[1],
            expect.any(Function),
        );

        firstCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, events[0]);

        secondCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, events[1]);

        expect(() => unmount()).not.toThrow();

        expect(channel.stopListening).toHaveBeenCalledWith(
            events[0],
            firstCallback,
        );
        expect(channel.stopListening).toHaveBeenCalledWith(
            events[1],
            secondCallback,
        );
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        expect(echoInstance.private).toHaveBeenCalled();

        expect(() => unmount()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalled();
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount: unmount1 } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        const { unmount: unmount2 } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        expect(echoInstance.private).toHaveBeenCalledTimes(1);

        expect(() => unmount1()).not.toThrow();

        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        expect(() => unmount2()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalled();
    });

    it("will register callbacks for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        expect(echoInstance.private).toHaveBeenCalledWith(channelName);

        const channel = echoInstance.private(channelName);
        const callback = (channel.listen as any).mock.calls[0][1];

        expect(channel.listen).toHaveBeenCalledWith(
            event,
            expect.any(Function),
        );

        callback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, event);
    });

    it("can leave a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        result.current.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            "private-" + channelName,
        );
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        result.current.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });

    it("can connect to a public channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback, [], "public"),
        );

        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        result.current.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("can manually start listening to events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        const channel = echoInstance.private(channelName);
        const callback = (channel.listen as any).mock.calls[0][1];

        expect(channel.listen).toHaveBeenCalledWith(
            event,
            expect.any(Function),
        );

        result.current.stopListening();

        expect(channel.stopListening).toHaveBeenCalledWith(event, callback);

        result.current.listen();

        const newCallback = (channel.listen as any).mock.calls[1][1];
        expect(channel.listen).toHaveBeenCalledWith(
            event,
            expect.any(Function),
        );

        newCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, event);
    });

    it("can manually stop listening to events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        const channel = echoInstance.private(channelName);
        const callback = (channel.listen as any).mock.calls[0][1];

        result.current.stopListening();

        expect(channel.stopListening).toHaveBeenCalledWith(event, callback);
    });

    it("stopListening is a no-op when not listening", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        result.current.stopListening();
        result.current.stopListening();

        const channel = echoInstance.private(channelName);
        expect(channel.stopListening).toHaveBeenCalledTimes(1);
    });

    it("listen is a no-op when already listening", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback),
        );

        result.current.listen();

        const channel = echoInstance.private(channelName);
        expect(channel.listen).toHaveBeenCalledTimes(1);
    });
});

describe("useEchoModel hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to model channel and listens for model events", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { result } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leave).toBe("function");
        expect(result.current).toHaveProperty("leave");
        expect(typeof result.current.leaveChannel).toBe("function");
    });

    it("handles multiple model events", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const events = ["UserCreated", "UserUpdated"];

        const { result, unmount } = renderHook(() =>
            echoModule.useEchoModel<any, "App.Models.User">(
                model,
                identifier,
                events,
                mockCallback,
            ),
        );

        expect(result.current).toHaveProperty("leaveChannel");

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.private).toHaveBeenCalledWith(expectedChannelName);

        const channel = echoInstance.private(expectedChannelName);
        const firstCallback = (channel.listen as any).mock.calls[0][1];
        const secondCallback = (channel.listen as any).mock.calls[1][1];

        expect(channel.listen).toHaveBeenCalledWith(
            `.${events[0]}`,
            expect.any(Function),
        );
        expect(channel.listen).toHaveBeenCalledWith(
            `.${events[1]}`,
            expect.any(Function),
        );

        firstCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith(
            { data: "test" },
            `.${events[0]}`,
        );

        secondCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith(
            { data: "test" },
            `.${events[1]}`,
        );

        expect(() => unmount()).not.toThrow();

        expect(channel.stopListening).toHaveBeenCalledWith(
            `.${events[0]}`,
            firstCallback,
        );
        expect(channel.stopListening).toHaveBeenCalledWith(
            `.${events[1]}`,
            secondCallback,
        );
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { unmount } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.private).toHaveBeenCalledWith(expectedChannelName);

        expect(() => unmount()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `private-${expectedChannelName}`,
        );
    });

    it("won't subscribe multiple times to the same model channel", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { unmount: unmount1 } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        const { unmount: unmount2 } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.private).toHaveBeenCalledTimes(1);
        expect(echoInstance.private).toHaveBeenCalledWith(expectedChannelName);

        expect(() => unmount1()).not.toThrow();
        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        expect(() => unmount2()).not.toThrow();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `private-${expectedChannelName}`,
        );
    });

    it("can leave a model channel", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { result } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        result.current.leaveChannel();

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `private-${expectedChannelName}`,
        );
    });

    it("can leave all model channel variations", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User";
        const identifier = "123";
        const event = "UserCreated";

        const { result } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        result.current.leave();

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.leave).toHaveBeenCalledWith(expectedChannelName);
    });

    it("handles model events with dots in the name", async () => {
        const mockCallback = vi.fn();
        const model = "App.Models.User.Profile";
        const identifier = "123";
        const event = "ProfileCreated";

        const { result } = renderHook(() =>
            echoModule.useEchoModel<any, typeof model>(
                model,
                identifier,
                event,
                mockCallback,
            ),
        );

        const expectedChannelName = `${model}.${identifier}`;
        expect(echoInstance.private).toHaveBeenCalledWith(expectedChannelName);

        const channel = echoInstance.private(expectedChannelName);
        const callback = (channel.listen as any).mock.calls[0][1];

        expect(channel.listen).toHaveBeenCalledWith(
            `.${event}`,
            expect.any(Function),
        );

        callback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith(
            { data: "test" },
            `.${event}`,
        );
    });
});

describe("useEchoPublic hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a public channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leave).toBe("function");
        expect(result.current).toHaveProperty("leave");
        expect(typeof result.current.leaveChannel).toBe("function");
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        const { result, unmount } = renderHook(() =>
            echoModule.useEchoPublic(channelName, events, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");

        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        const channel = echoInstance.channel(channelName);
        const firstCallback = (channel.listen as any).mock.calls[0][1];
        const secondCallback = (channel.listen as any).mock.calls[1][1];

        expect(channel.listen).toHaveBeenCalledWith(
            events[0],
            expect.any(Function),
        );
        expect(channel.listen).toHaveBeenCalledWith(
            events[1],
            expect.any(Function),
        );

        firstCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, events[0]);

        secondCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, events[1]);

        expect(() => unmount()).not.toThrow();

        expect(channel.stopListening).toHaveBeenCalledWith(
            events[0],
            firstCallback,
        );
        expect(channel.stopListening).toHaveBeenCalledWith(
            events[1],
            secondCallback,
        );
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        expect(() => unmount()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount: unmount1 } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        const { unmount: unmount2 } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        expect(echoInstance.channel).toHaveBeenCalledTimes(1);
        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        expect(() => unmount1()).not.toThrow();
        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        expect(() => unmount2()).not.toThrow();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("can leave a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        result.current.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPublic(channelName, event, mockCallback),
        );

        result.current.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });
});

describe("useEchoPresence hook", async () => {
    let echoModule: typeof import("../src/hooks/use-echo");
    let configModule: typeof import("../src/config/index");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();
        configModule = await getConfigModule();

        configModule.configureEcho({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("subscribes to a presence channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leave).toBe("function");
        expect(result.current).toHaveProperty("leave");
        expect(typeof result.current.leaveChannel).toBe("function");
        expect(result.current).toHaveProperty("channel");
        expect(result.current.channel).not.toBeNull();
        expect(typeof result.current.channel().here).toBe("function");
        expect(typeof result.current.channel().joining).toBe("function");
        expect(typeof result.current.channel().leaving).toBe("function");
        expect(typeof result.current.channel().whisper).toBe("function");
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        expect(echoInstance.join).toHaveBeenCalledWith(channelName);

        expect(() => unmount()).not.toThrow();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `presence-${channelName}`,
        );
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount: unmount1 } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        const { unmount: unmount2 } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        expect(echoInstance.join).toHaveBeenCalledTimes(1);
        expect(echoInstance.join).toHaveBeenCalledWith(channelName);

        expect(() => unmount1()).not.toThrow();
        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        expect(() => unmount2()).not.toThrow();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `presence-${channelName}`,
        );
    });

    it("can leave a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        result.current.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `presence-${channelName}`,
        );
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEchoPresence(channelName, event, mockCallback),
        );

        result.current.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        const { result, unmount } = renderHook(() =>
            echoModule.useEchoPresence(channelName, events, mockCallback),
        );

        expect(result.current).toHaveProperty("leaveChannel");

        expect(echoInstance.join).toHaveBeenCalledWith(channelName);

        const channel = echoInstance.join(channelName);
        const firstCallback = (channel.listen as any).mock.calls[0][1];
        const secondCallback = (channel.listen as any).mock.calls[1][1];

        expect(channel.listen).toHaveBeenCalledWith(
            events[0],
            expect.any(Function),
        );
        expect(channel.listen).toHaveBeenCalledWith(
            events[1],
            expect.any(Function),
        );

        firstCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, events[0]);

        secondCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, events[1]);

        expect(() => unmount()).not.toThrow();

        expect(channel.stopListening).toHaveBeenCalledWith(
            events[0],
            firstCallback,
        );
        expect(channel.stopListening).toHaveBeenCalledWith(
            events[1],
            secondCallback,
        );
    });
});
