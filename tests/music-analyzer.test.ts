import { describe, expect, it } from "vitest";
import { MusicFeatureAnalyzer } from "../src/music-analyzer";

describe("MusicFeatureAnalyzer", () => {
  it.each([90, 120, 160])("estimates a %i BPM click track", bpm => {
    const analyzer = new MusicFeatureAnalyzer();
    const sampleRate = 48_000;
    const samples = clickTrack(bpm, 14, sampleRate);
    const chunkSize = 512;
    for (let offset = 0; offset < samples.length; offset += chunkSize) {
      analyzer.analyzeMono(samples.subarray(offset, offset + chunkSize), sampleRate);
    }
    expect(analyzer.snapshot.beatConfidence01).toBeGreaterThanOrEqual(0.55);
    expect(Math.abs(analyzer.snapshot.bpm - bpm)).toBeLessThanOrEqual(4);
  });

  it("keeps silence inactive", () => {
    const analyzer = new MusicFeatureAnalyzer();
    analyzer.analyzeMono(new Float32Array(48_000 * 8), 48_000);
    expect(analyzer.snapshot.energy01).toBe(0);
    expect(analyzer.snapshot.beatConfidence01).toBe(0);
    expect(analyzer.snapshot.bpm).toBe(0);
  });

  it("does not lock strongly to speech-like noise", () => {
    const analyzer = new MusicFeatureAnalyzer();
    const samples = speechLikeNoise(12, 48_000);
    for (let offset = 0; offset < samples.length; offset += 512) {
      analyzer.analyzeMono(samples.subarray(offset, offset + 512), 48_000);
    }
    expect(analyzer.snapshot.beatConfidence01).toBeLessThan(0.55);
  });

  it("does not lock strongly to irregular impulses", () => {
    const analyzer = new MusicFeatureAnalyzer();
    const samples = irregularImpulses(12, 48_000);
    for (let offset = 0; offset < samples.length; offset += 512) {
      analyzer.analyzeMono(samples.subarray(offset, offset + 512), 48_000);
    }
    expect(analyzer.snapshot.beatConfidence01).toBeLessThan(0.55);
  });

  it("resets all accumulated rhythm state", () => {
    const analyzer = new MusicFeatureAnalyzer();
    analyzer.analyzeMono(clickTrack(120, 8, 48_000), 48_000);
    analyzer.reset();
    expect(analyzer.snapshot).toMatchObject({ bpm: 0, beatConfidence01: 0, energy01: 0 });
  });
});

function clickTrack(bpm: number, seconds: number, sampleRate: number): Float32Array {
  const samples = new Float32Array(seconds * sampleRate);
  const beatSamples = Math.round(sampleRate * 60 / bpm);
  for (let start = 0; start < samples.length; start += beatSamples) {
    for (let index = 0; index < 1_400 && start + index < samples.length; index += 1) {
      const envelope = Math.exp(-index / 180);
      samples[start + index] = Math.sin(index * 0.45) * envelope * 0.9;
    }
  }
  return samples;
}

function speechLikeNoise(seconds: number, sampleRate: number): Float32Array {
  const samples = new Float32Array(seconds * sampleRate);
  let seed = 0x12345678;
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 0xffffffff * 2 - 1;
    const syllableEnvelope = 0.12 + 0.1 * Math.max(0, Math.sin(index / sampleRate * 2.3));
    samples[index] = noise * syllableEnvelope;
  }
  return samples;
}

function irregularImpulses(seconds: number, sampleRate: number): Float32Array {
  const samples = new Float32Array(seconds * sampleRate);
  const intervals = [0.31, 0.83, 0.47, 1.19, 0.38, 0.72, 1.41, 0.52, 0.94];
  let time = 0;
  let intervalIndex = 0;
  while (time < seconds) {
    const start = Math.round(time * sampleRate);
    for (let index = 0; index < 500 && start + index < samples.length; index += 1) {
      samples[start + index] = Math.exp(-index / 90) * 0.8;
    }
    time += intervals[intervalIndex % intervals.length] ?? 0.67;
    intervalIndex += 1;
  }
  return samples;
}
