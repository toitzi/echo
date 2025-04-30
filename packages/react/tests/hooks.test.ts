import { renderHook } from "@testing-library/react";
import Echo from "laravel-echo";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEchoModule = async () => import("../src/hook/use-echo");

vi.mock("laravel-echo", () => {
    const Echo = vi.fn();
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

    Echo.prototype.private = vi.fn(() => mockPrivateChannel);
    Echo.prototype.channel = vi.fn(() => mockPublicChannel);
    Echo.prototype.encryptedPrivate = vi.fn();
    Echo.prototype.presence = vi.fn();
    Echo.prototype.listen = vi.fn();
    Echo.prototype.leave = vi.fn();
    Echo.prototype.leaveChannel = vi.fn();
    Echo.prototype.leaveAllChannels = vi.fn();

    return { default: Echo };
});

describe("echo helper", async () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("throws error when Echo is not configured", async () => {
        const echoModule = await getEchoModule();

        expect(() => echoModule.echo()).toThrow("Echo has not been configured");
    });

    it("creates Echo instance with proper configuration", async () => {
        const echoModule = await getEchoModule();

        echoModule.configureEcho({
            broadcaster: "null",
        });

        expect(echoModule.echo()).toBeDefined();
    });
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
    let echoModule: typeof import("../src/hook/use-echo");
    let echoInstance: Echo<"null">;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });

        echoModule = await getEchoModule();

        echoModule.configureEcho({
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

        expect(echoInstance.private(channelName).listen).toHaveBeenCalledWith(
            events[0],
            mockCallback,
        );

        expect(echoInstance.private(channelName).listen).toHaveBeenCalledWith(
            events[1],
            mockCallback,
        );

        expect(() => unmount()).not.toThrow();

        expect(
            echoInstance.private(channelName).stopListening,
        ).toHaveBeenCalledWith(events[0], mockCallback);
        expect(
            echoInstance.private(channelName).stopListening,
        ).toHaveBeenCalledWith(events[1], mockCallback);
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

        expect(echoInstance.private(channelName).listen).toHaveBeenCalledWith(
            event,
            mockCallback,
        );
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
});
