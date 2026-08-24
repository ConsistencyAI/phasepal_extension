declare const sampleRate: number;
declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(inputs: Float32Array[][]): boolean;
}

class PhasePalPcmProcessor extends AudioWorkletProcessor {
  private buffer = new Float32Array(1024);
  private cursor = 0;

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    const firstChannel = input?.[0];
    if (!input || !firstChannel || firstChannel.length === 0) return true;
    for (let frame = 0; frame < firstChannel.length; frame += 1) {
      let sum = 0;
      for (const channel of input) sum += channel[frame] ?? 0;
      this.buffer[this.cursor] = sum / input.length;
      this.cursor += 1;
      if (this.cursor === this.buffer.length) {
        const completed = this.buffer;
        this.buffer = new Float32Array(1024);
        this.cursor = 0;
        this.port.postMessage({ type: "pcm", sampleRate, samples: completed }, [completed.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("phasepal-pcm", PhasePalPcmProcessor);
