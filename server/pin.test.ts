import { describe, it, expect } from "vitest";

describe("Upload PIN", () => {
  it("should have VITE_UPLOAD_PIN environment variable set", () => {
    const pin = process.env.VITE_UPLOAD_PIN;
    expect(pin).toBeDefined();
    expect(pin).not.toBe("");
    expect(typeof pin).toBe("string");
  });

  it("should be a valid numeric PIN", () => {
    const pin = process.env.VITE_UPLOAD_PIN;
    expect(pin).toMatch(/^\d+$/);
  });
});
