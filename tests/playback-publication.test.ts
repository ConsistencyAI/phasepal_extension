import { describe, expect, it } from "vitest";
import { shouldPublishPlayback } from "../src/playback-publication";

describe("playback publication", () => {
  it("suppresses identical playing updates from DOM mutations", () => {
    expect(shouldPublishPlayback("true:true:true:true", "true:true:true:true", false)).toBe(false);
  });

  it("allows the fixed heartbeat to repeat an unchanged state", () => {
    expect(shouldPublishPlayback("true:true:true:true", "true:true:true:true", true)).toBe(true);
  });

  it("publishes a real playback state change", () => {
    expect(shouldPublishPlayback("true:true:true:true", "false:true:true:true", false)).toBe(true);
  });
});
