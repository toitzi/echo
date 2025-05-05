import { mount } from "@vue/test-utils";
import Echo from "laravel-echo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import {
    useEcho,
    useEchoPresence,
    useEchoPublic,
} from "../src/composables/useEcho";
import { configureEcho } from "../src/config/index";

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

const getPublicTestComponent = (
    channelName: string,
    event: string | string[],
    callback: (data: any) => void,
    dependencies: any[] = [],
) => {
    const TestComponent = defineComponent({
        setup() {
            configureEcho({
                broadcaster: "null",
            });

            return {
                ...useEchoPublic(channelName, event, callback, dependencies),
            };
        },
        template: "<div></div>",
    });

    return mount(TestComponent);
};

const getPresenceTestComponent = (
    channelName: string,
    event: string | string[],
    callback: (data: any) => void,
    dependencies: any[] = [],
) => {
    const TestComponent = defineComponent({
        setup() {
            configureEcho({
                broadcaster: "null",
            });

            return {
                ...useEchoPresence(channelName, event, callback, dependencies),
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

        wrapper.unmount();

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

    it("listen method adds event listeners", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(channelName, event, mockCallback);
        const mockChannel = echoInstance.private(channelName);

        const callback = (mockChannel.listen as any).mock.calls[0][1];

        expect(mockChannel.listen).toHaveBeenCalledWith(event, callback);

        wrapper.vm.stopListening();

        expect(mockChannel.stopListening).toHaveBeenCalledWith(event, callback);

        wrapper.vm.listen();

        const newCallback = (mockChannel.listen as any).mock.calls[1][1];
        expect(mockChannel.listen).toHaveBeenCalledWith(
            event,
            expect.any(Function),
        );

        newCallback({ data: "test" });
        expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, event);
    });

    it("listen method is a no-op when already listening", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(channelName, event, mockCallback);
        const mockChannel = echoInstance.private(channelName);

        wrapper.vm.listen();

        expect(mockChannel.listen).toHaveBeenCalledTimes(1);
    });

    it("stopListening method removes event listeners", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(channelName, event, mockCallback);
        const mockChannel = echoInstance.private(channelName);

        const callback = (mockChannel.listen as any).mock.calls[0][1];

        wrapper.vm.stopListening();

        expect(mockChannel.stopListening).toHaveBeenCalledWith(event, callback);
    });

    it("stopListening method is a no-op when not listening", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getTestComponent(channelName, event, mockCallback);
        const mockChannel = echoInstance.private(channelName);

        wrapper.vm.stopListening();
        wrapper.vm.stopListening();

        expect(mockChannel.stopListening).toHaveBeenCalledTimes(1);
    });

    it("listen and stopListening work with multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        wrapper = getTestComponent(channelName, events, mockCallback);
        const mockChannel = echoInstance.private(channelName);

        events.forEach((event) => {
            const callback = (mockChannel.listen as any).mock.calls[
                events.indexOf(event)
            ][1];
            expect(mockChannel.listen).toHaveBeenCalledWith(
                event,
                expect.any(Function),
            );
            callback({ data: "test" });
            expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, event);
        });

        wrapper.vm.stopListening();
        wrapper.vm.listen();

        events.forEach((event) => {
            const callback = (mockChannel.listen as any).mock.calls[
                events.indexOf(event)
            ][1];
            expect(mockChannel.listen).toHaveBeenCalledWith(
                event,
                expect.any(Function),
            );
            callback({ data: "test" });
            expect(mockCallback).toHaveBeenCalledWith({ data: "test" }, event);
        });

        wrapper.vm.stopListening();

        events.forEach((event) => {
            const callback = (mockChannel.stopListening as any).mock.calls[
                events.indexOf(event)
            ][1];
            expect(mockChannel.stopListening).toHaveBeenCalledWith(
                event,
                callback,
            );
        });
    });
});

describe("useEchoPublic hook", async () => {
    let echoInstance: Echo<"null">;
    let wrapper: ReturnType<typeof getPublicTestComponent>;

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

    it("subscribes to a public channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getPublicTestComponent(channelName, event, mockCallback);

        expect(wrapper.vm).toHaveProperty("leaveChannel");
        expect(typeof wrapper.vm.leaveChannel).toBe("function");

        expect(wrapper.vm).toHaveProperty("leave");
        expect(typeof wrapper.vm.leave).toBe("function");
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        wrapper = getPublicTestComponent(channelName, events, mockCallback);

        expect(wrapper.vm).toHaveProperty("leaveChannel");
        expect(typeof wrapper.vm.leaveChannel).toBe("function");

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

        wrapper.unmount();

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

        wrapper = getPublicTestComponent(channelName, event, mockCallback);

        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        wrapper.unmount();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getPublicTestComponent(channelName, event, mockCallback);

        const wrapper2 = getPublicTestComponent(
            channelName,
            event,
            mockCallback,
        );

        expect(echoInstance.channel).toHaveBeenCalledTimes(1);
        expect(echoInstance.channel).toHaveBeenCalledWith(channelName);

        wrapper.unmount();
        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        wrapper2.unmount();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("can leave a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getPublicTestComponent(channelName, event, mockCallback);

        wrapper.vm.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(channelName);
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getPublicTestComponent(channelName, event, mockCallback);

        wrapper.vm.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });
});

describe("useEchoPresence hook", async () => {
    let echoInstance: Echo<"null">;
    let wrapper: ReturnType<typeof getPresenceTestComponent>;

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

    it("subscribes to a presence channel and listens for events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getPresenceTestComponent(channelName, event, mockCallback);

        expect(wrapper.vm).toHaveProperty("leaveChannel");
        expect(typeof wrapper.vm.leaveChannel).toBe("function");

        expect(wrapper.vm).toHaveProperty("leave");
        expect(typeof wrapper.vm.leave).toBe("function");

        expect(wrapper.vm).toHaveProperty("channel");
        expect(wrapper.vm.channel).not.toBeNull();
        expect(typeof wrapper.vm.channel().here).toBe("function");
        expect(typeof wrapper.vm.channel().joining).toBe("function");
        expect(typeof wrapper.vm.channel().leaving).toBe("function");
        expect(typeof wrapper.vm.channel().whisper).toBe("function");
    });

    it("handles multiple events", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const events = ["event1", "event2"];

        wrapper = getPresenceTestComponent(channelName, events, mockCallback);

        expect(wrapper.vm).toHaveProperty("leaveChannel");
        expect(typeof wrapper.vm.leaveChannel).toBe("function");

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

        wrapper.unmount();

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

        wrapper = getPresenceTestComponent(channelName, event, mockCallback);

        expect(echoInstance.join).toHaveBeenCalledWith(channelName);

        wrapper.unmount();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `presence-${channelName}`,
        );
    });

    it("won't subscribe multiple times to the same channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getPresenceTestComponent(channelName, event, mockCallback);

        const wrapper2 = getPresenceTestComponent(
            channelName,
            event,
            mockCallback,
        );

        expect(echoInstance.join).toHaveBeenCalledTimes(1);
        expect(echoInstance.join).toHaveBeenCalledWith(channelName);

        wrapper.unmount();
        expect(echoInstance.leaveChannel).not.toHaveBeenCalled();

        wrapper2.unmount();
        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `presence-${channelName}`,
        );
    });

    it("can leave a channel", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getPresenceTestComponent(channelName, event, mockCallback);

        wrapper.vm.leaveChannel();

        expect(echoInstance.leaveChannel).toHaveBeenCalledWith(
            `presence-${channelName}`,
        );
    });

    it("can leave all channel variations", async () => {
        const mockCallback = vi.fn();
        const channelName = "test-channel";
        const event = "test-event";

        wrapper = getPresenceTestComponent(channelName, event, mockCallback);

        wrapper.vm.leave();

        expect(echoInstance.leave).toHaveBeenCalledWith(channelName);
    });
});
