import { mount } from "@vue/test-utils";
import Echo from "laravel-echo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { configureEcho, useEcho } from "../src/composable/useEcho";

const getEchoModule = async () => import("../src/composable/useEcho");

const getUnConfiguredTestComponent = (
    channelName: string,
    event: string | string[],
    callback: (data: any) => void,
    visibility: "private" | "public" = "private",
) => {
    const TestComponent = defineComponent({
        setup() {
            return {
                ...useEcho(channelName, event, callback, [], visibility),
            };
        },
        template: "<div></div>",
    });

    return mount(TestComponent);
};

const getTestComponent = (
    channelName: string,
    event: string | string[],
    callback: (data: any) => void,
    dependencies: any[] = [],
    visibility: "private" | "public" = "private",
) => {
    const TestComponent = defineComponent({
        setup() {
            configureEcho({
                broadcaster: "null",
            });

            return {
                ...useEcho(
                    channelName,
                    event,
                    callback,
                    dependencies,
                    visibility,
                ),
            };
        },
        template: "<div></div>",
    });

    return mount(TestComponent);
};

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

    const Echo = vi.fn();

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

    afterEach(() => {
        vi.clearAllMocks();
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

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("throws error when Echo is not configured", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        expect(() =>
            getUnConfiguredTestComponent(
                channelName,
                event,
                mockCallback,
                "private",
            ),
        ).toThrow("Echo has not been configured");
    });
});

describe("useEcho hook", async () => {
    let echoInstance: Echo<"null">;
    let wrapper: ReturnType<typeof getTestComponent>;

    beforeEach(async () => {
        vi.resetModules();

        echoInstance = new Echo({
            broadcaster: "null",
        });
    });

    afterEach(() => {
        wrapper.unmount();
        vi.clearAllMocks();
    });

    it("subscribes to a channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(channelName, event, mockCallback);

        expect(wrapper.vm).toHaveProperty("leaveChannel");
        expect(typeof wrapper.vm.leaveChannel).toBe("function");

        expect(wrapper.vm).toHaveProperty("leave");
        expect(typeof wrapper.vm.leave).toBe("function");
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        wrapper = getTestComponent(channelName, events, mockCallback);

        expect(wrapper.vm).toHaveProperty("leaveChannel");
        expect(typeof wrapper.vm.leaveChannel).toBe("function");

        expect(echoInstance.private).toHaveBeenCalledWith(channelName);

        const channel = echoInstance.private(channelName);

        expect(channel.listen).toHaveBeenCalledWith(events[0], mockCallback);
        expect(channel.listen).toHaveBeenCalledWith(events[1], mockCallback);

        wrapper.unmount();

        expect(channel.stopListening).toHaveBeenCalledWith(
            events[0],
            mockCallback,
        );
        expect(channel.stopListening).toHaveBeenCalledWith(
            events[1],
            mockCallback,
        );
    });

    it("cleans up subscriptions on unmount", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(channelName, event, mockCallback);

        expect(echoInstance.private).toHaveBeenCalled();

        wrapper.unmount();

        expect(echoInstance.leaveChannel).toHaveBeenCalled();
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(channelName, event, mockCallback);

        const wrapper2 = getTestComponent(channelName, event, mockCallback);

        expect(echoInstance.private).toHaveBeenCalledTimes(1);

        wrapper.unmount();

        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        wrapper2.unmount();

        expect(echoInstance.leaveChannel).toHaveBeenCalled();
    });

    it("will register callbacks for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(channelName, event, mockCallback);

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

        wrapper = getTestComponent(channelName, event, mockCallback);

        wrapper.vm.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            "private-" + channelName,
        );
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(channelName, event, mockCallback);

        wrapper.vm.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });

    it("can connect to a public channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(
            channelName,
            event,
            mockCallback,
            [],
            "public",
        );

        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        wrapper.vm.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });
});
