import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEchoModule = async () => import("../src/hook/use-echo");

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

    beforeEach(async () => {
        vi.resetModules();

        echoModule = await getEchoModule();

        echoModule.configureEcho({
            broadcaster: "null",
        });
    });

    it("subscribes to a channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { result } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback, [], "private"),
        );

        expect(result.current).toHaveProperty("leaveChannel");
        expect(typeof result.current.leaveChannel).toBe("function");
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        const { result } = renderHook(() =>
            echoModule.useEcho(
                channelName,
                events,
                mockCallback,
                [],
                "private",
            ),
        );

        expect(result.current).toHaveProperty("leaveChannel");
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        const { unmount } = renderHook(() =>
            echoModule.useEcho(channelName, event, mockCallback, [], "private"),
        );

        expect(() => unmount()).not.toThrow();
    });
});
