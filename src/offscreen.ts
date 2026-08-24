import { MusicFeatureAnalyzer } from "./music-analyzer";
import type { CaptureStopReason } from "./protocol";

let audioContext: AudioContext | undefined;
let mediaStream: MediaStream | undefined;
let publishTimer: ReturnType<typeof setInterval> | undefined;
let analyzer = new MusicFeatureAnalyzer();
let pendingBeatPulse = false;
let stopping = false;

chrome.runtime.onMessage.addListener((message: Record<string, unknown>, _sender, sendResponse) => {
  if (message.type === "offscreen_start_capture") {
    void startCapture(String(message.streamId)).then(sendResponse);
    return true;
  }
  if (message.type === "offscreen_stop_capture") {
    stopCapture(String(message.reason) as CaptureStopReason, false);
    sendResponse({ ok: true });
  }
  return false;
});

async function startCapture(streamId: string): Promise<{ ok: boolean; error?: string }> {
  stopCapture("replaced", false);
  stopping = false;
  try {
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      },
      video: false
    } as unknown as MediaStreamConstraints;
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule(chrome.runtime.getURL("assets/audio-worklet.js"));
    const source = audioContext.createMediaStreamSource(mediaStream);
    const worklet = new AudioWorkletNode(audioContext, "phasepal-pcm", {
      numberOfInputs: 1,
      numberOfOutputs: 0
    });
    worklet.port.onmessage = event => {
      if (event.data?.type !== "pcm") return;
      const snapshot = analyzer.analyzeMono(event.data.samples as Float32Array, Number(event.data.sampleRate));
      pendingBeatPulse ||= snapshot.beatPulse;
    };
    source.connect(worklet);
    source.connect(audioContext.destination);
    for (const track of mediaStream.getTracks()) {
      track.addEventListener("ended", () => stopCapture("stream_ended", true), { once: true });
    }
    publishTimer = setInterval(publish, 100);
    return { ok: true };
  } catch (error) {
    stopCapture("capture_error", true);
    return { ok: false, error: error instanceof Error ? error.message : "capture_error" };
  }
}

function publish(): void {
  const snapshot = analyzer.snapshot;
  snapshot.beatPulse ||= pendingBeatPulse;
  pendingBeatPulse = false;
  void chrome.runtime.sendMessage({ type: "offscreen_features", features: snapshot }).catch(() => undefined);
}

function stopCapture(reason: CaptureStopReason, notify: boolean): void {
  if (stopping) return;
  stopping = true;
  if (publishTimer) clearInterval(publishTimer);
  publishTimer = undefined;
  for (const track of mediaStream?.getTracks() ?? []) track.stop();
  mediaStream = undefined;
  const context = audioContext;
  audioContext = undefined;
  if (context && context.state !== "closed") void context.close();
  analyzer.reset();
  pendingBeatPulse = false;
  if (notify) void chrome.runtime.sendMessage({ type: "offscreen_capture_stopped", reason }).catch(() => undefined);
  stopping = false;
}
