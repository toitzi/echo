import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureEcho, echo } from "../src/config";

describe("echo helper", async () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("throws error when Echo is not configured", async () => {
        expect(() => echo()).toThrow("Echo has not been configured");
    });

    it("creates Echo instance with proper configuration", async () => {
        configureEcho({
            broadcaster: "null",
        });

        expect(echo()).toBeDefined();
    });
});
