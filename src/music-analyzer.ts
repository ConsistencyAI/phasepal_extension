import { clamp01, type FeatureSnapshot, type SectionIntensity } from "./protocol";

export interface MusicAnalyzerSettings {
  envelopeFrameSize: number;
  historySeconds: number;
  minBpm: number;
  maxBpm: number;
  energyScale: number;
  energyFloor: number;
  onsetSensitivity: number;
  minimumOnsetEnergy: number;
}

const DEFAULT_SETTINGS: MusicAnalyzerSettings = {
  envelopeFrameSize: 1024,
  historySeconds: 12,
  minBpm: 70,
  maxBpm: 180,
  energyScale: 4,
  energyFloor: 0.004,
  onsetSensitivity: 1.25,
  minimumOnsetEnergy: 0.018
};

interface EnergyFrame { time: number; energy: number }
interface OnsetFrame { time: number; strength: number }

export class MusicFeatureAnalyzer {
  private readonly settings: MusicAnalyzerSettings;
  private readonly energyFrames: EnergyFrame[] = [];
  private readonly onsets: OnsetFrame[] = [];
  private sampleRate = 0;
  private samplesInFrame = 0;
  private sumSquares = 0;
  private processedSeconds = 0;
  private current: FeatureSnapshot = inactiveFeatures();

  constructor(settings: Partial<MusicAnalyzerSettings> = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  get snapshot(): FeatureSnapshot {
    return { ...this.current };
  }

  analyzeMono(samples: Float32Array, sampleRate: number): FeatureSnapshot {
    if (samples.length === 0 || sampleRate <= 0) return this.snapshot;
    if (this.sampleRate !== sampleRate) {
      this.reset();
      this.sampleRate = sampleRate;
    }
    for (const sample of samples) {
      this.sumSquares += sample * sample;
      this.samplesInFrame += 1;
      if (this.samplesInFrame >= this.settings.envelopeFrameSize) this.commitFrame();
    }
    return this.snapshot;
  }

  reset(): void {
    this.energyFrames.length = 0;
    this.onsets.length = 0;
    this.sampleRate = 0;
    this.samplesInFrame = 0;
    this.sumSquares = 0;
    this.processedSeconds = 0;
    this.current = inactiveFeatures();
  }

  private commitFrame(): void {
    const rms = Math.sqrt(this.sumSquares / Math.max(1, this.samplesInFrame));
    this.processedSeconds += this.samplesInFrame / this.sampleRate;
    const now = this.processedSeconds;
    const baseline = this.averageRecentEnergy(10);
    const previousEnergy = this.energyFrames.at(-1)?.energy ?? 0;
    const dynamicBaseline = Math.max(this.settings.energyFloor, baseline);
    const rise = Math.max(rms - dynamicBaseline, rms - previousEnergy);
    const onsetStrength = rise > 0 && rms >= this.settings.minimumOnsetEnergy
      // Sensitivity is an energy ratio (1.25 means 25% above the recent bed).
      // Comparing the rise itself required 125% above the bed and missed music
      // with sustained instruments even when its drum pattern was regular.
      ? rms / dynamicBaseline
      : 0;
    const beatPulse = this.tryAddOnset(now, onsetStrength);
    this.energyFrames.push({ time: now, energy: rms });
    this.trim(now);
    const tempo = this.estimateTempo(now);
    const energy01 = clamp01(rms * this.settings.energyScale);
    const onsetDensity01 = this.onsetDensity(now);
    this.current = {
      energy01,
      beatConfidence01: tempo.confidence,
      bpm: tempo.bpm,
      beatPhase01: this.beatPhase(now, tempo.bpm),
      beatPulse,
      onsetDensity01,
      sectionIntensity: classifySection(energy01, tempo.confidence, onsetDensity01)
    };
    this.sumSquares = 0;
    this.samplesInFrame = 0;
  }

  private averageRecentEnergy(count: number): number {
    const rows = this.energyFrames.slice(-count);
    return rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.energy, 0) / rows.length;
  }

  private tryAddOnset(now: number, strength: number): boolean {
    if (strength < this.settings.onsetSensitivity) return false;
    const minSpacing = Math.max(0.08, 30 / this.settings.maxBpm);
    const last = this.onsets.at(-1);
    if (last && now - last.time < minSpacing) {
      if (strength > last.strength) this.onsets[this.onsets.length - 1] = { time: now, strength };
      return false;
    }
    this.onsets.push({ time: now, strength });
    return true;
  }

  private estimateTempo(now: number): { bpm: number; confidence: number } {
    if (this.onsets.length < 4) return { bpm: 0, confidence: 0 };
    const binCount = Math.ceil(this.settings.maxBpm - this.settings.minBpm) + 1;
    const votes = new Array<number>(binCount).fill(0);
    let totalVote = 0;
    for (let i = 0; i < this.onsets.length - 1; i += 1) {
      for (let j = i + 1; j < this.onsets.length; j += 1) {
        const first = this.onsets[i];
        const second = this.onsets[j];
        if (!first || !second) continue;
        const interval = second.time - first.time;
        if (interval <= 0 || interval > 4) continue;
        const bpm = this.normalizeBpm(60 / interval);
        if (bpm < this.settings.minBpm || bpm > this.settings.maxBpm) continue;
        const bin = Math.max(0, Math.min(binCount - 1, Math.round(bpm - this.settings.minBpm)));
        const recency = 1 - Math.min(1, Math.max(0, now - second.time) / this.settings.historySeconds);
        // Adjacent onsets are the best tempo evidence. Without this distance
        // weight, pairs two beats apart can make a 160 BPM track look like 80 BPM.
        const onsetDistance = Math.max(1, j - i);
        const distanceWeight = 1 / (onsetDistance * onsetDistance);
        const vote = Math.max(0.1, recency)
          * Math.max(0.1, Math.min(first.strength, second.strength))
          * distanceWeight;
        votes[bin] = (votes[bin] ?? 0) + vote;
        totalVote += vote;
      }
    }
    if (totalVote <= 0) return { bpm: 0, confidence: 0 };
    let bestBin = 0;
    let bestVote = 0;
    for (let i = 0; i < votes.length; i += 1) {
      const neighborhood = (votes[i] ?? 0) + (votes[i - 1] ?? 0) * 0.5 + (votes[i + 1] ?? 0) * 0.5;
      if (neighborhood > bestVote) { bestVote = neighborhood; bestBin = i; }
    }
    let weightedBpm = 0;
    let weightedVote = 0;
    for (let i = Math.max(0, bestBin - 1); i <= Math.min(votes.length - 1, bestBin + 1); i += 1) {
      const vote = votes[i] ?? 0;
      weightedBpm += (this.settings.minBpm + i) * vote;
      weightedVote += vote;
    }
    const bpm = weightedVote > 0 ? weightedBpm / weightedVote : this.settings.minBpm + bestBin;
    let matchingAdjacentIntervals = 0;
    let adjacentIntervalCount = 0;
    for (let index = 1; index < this.onsets.length; index += 1) {
      const previous = this.onsets[index - 1];
      const current = this.onsets[index];
      if (!previous || !current) continue;
      const interval = current.time - previous.time;
      if (interval <= 0 || interval > 4) continue;
      adjacentIntervalCount += 1;
      if (Math.abs(this.normalizeBpm(60 / interval) - bpm) <= 8) matchingAdjacentIntervals += 1;
    }
    const histogramConfidence = clamp01(bestVote / totalVote);
    const intervalConsistency = adjacentIntervalCount > 0
      ? matchingAdjacentIntervals / adjacentIntervalCount
      : 0;
    const onsetCoverage = clamp01(this.onsets.length / 8);
    const confidence = clamp01(Math.max(histogramConfidence, intervalConsistency) * onsetCoverage);
    return confidence > 0 ? { bpm, confidence } : { bpm: 0, confidence: 0 };
  }

  private normalizeBpm(raw: number): number {
    let bpm = raw;
    while (bpm < this.settings.minBpm) bpm *= 2;
    while (bpm > this.settings.maxBpm) bpm *= 0.5;
    return bpm;
  }

  private beatPhase(now: number, bpm: number): number {
    const last = this.onsets.at(-1);
    if (!last || bpm <= 0) return 0;
    const period = 60 / bpm;
    const elapsed = now - last.time;
    if (elapsed <= 0) return 0;
    return elapsed / period - Math.floor(elapsed / period);
  }

  private onsetDensity(now: number): number {
    const count = this.onsets.filter(onset => now - onset.time <= 4).length;
    return clamp01((count / 4) / 4);
  }

  private trim(now: number): void {
    const cutoff = now - this.settings.historySeconds;
    while (this.energyFrames[0] && this.energyFrames[0].time < cutoff) this.energyFrames.shift();
    while (this.onsets[0] && this.onsets[0].time < cutoff) this.onsets.shift();
  }
}

export function inactiveFeatures(): FeatureSnapshot {
  return {
    energy01: 0,
    beatConfidence01: 0,
    bpm: 0,
    beatPhase01: 0,
    beatPulse: false,
    onsetDensity01: 0,
    sectionIntensity: "unknown"
  };
}

function classifySection(energy: number, confidence: number, density: number): SectionIntensity {
  if (energy >= 0.65 && confidence >= 0.65 && density >= 0.1) return "high";
  if (energy >= 0.35 || confidence >= 0.45) return "medium";
  return energy > 0.05 ? "low" : "unknown";
}
