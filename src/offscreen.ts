import { MusicFeatureAnalyzer } from "./music-analyzer";
import type { CaptureStopReason } from "./protocol";

interface CaptureSession {
  id: string;
  stream?: MediaStream;
  context?: AudioContext;
  timer?: ReturnType<typeof setInterval>;
  analyzer: MusicFeatureAnalyzer;
  pendingBeatPulse: boolean;
}

let current: CaptureSession | undefined;

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== "object" || sender.id !== chrome.runtime.id || sender.tab ||
    (sender.url !== undefined && sender.url !== chrome.runtime.getURL("assets/background.js"))) return false;
  const candidate = message as Record<string, unknown>;
  if (typeof candidate.captureId !== "string" || !candidate.captureId) return false;
  if (candidate.type === "offscreen_start_capture" && typeof candidate.streamId === "string" && candidate.streamId) {
    void startCapture(candidate.streamId, candidate.captureId).then(sendResponse);
    return true;
  }
  if (candidate.type === "offscreen_stop_capture" && current?.id === candidate.captureId) {
    stopCapture(current, "user", false);
    sendResponse({ ok: true });
  }
  return false;
});

async function startCapture(streamId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  if (current) stopCapture(current, "replaced", false);
  const session: CaptureSession = { id, analyzer: new MusicFeatureAnalyzer(), pendingBeatPulse: false };
  current = session;
  try {
    const constraints = {
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
      video: false
    } as unknown as MediaStreamConstraints;
    session.stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (current !== session) {
      stopCapture(session, "replaced", false);
      return { ok: false, error: "capture_cancelled" };
    }
    session.context = new AudioContext();
    await session.context.audioWorklet.addModule(chrome.runtime.getURL("assets/audio-worklet.js"));
    if (current !== session) {
      stopCapture(session, "replaced", false);
      return { ok: false, error: "capture_cancelled" };
    }
    const source = session.context.createMediaStreamSource(session.stream);
    const worklet = new AudioWorkletNode(session.context, "phasepal-pcm", { numberOfInputs: 1, numberOfOutputs: 0 });
    worklet.port.onmessage = event => {
      if (current !== session || event.data?.type !== "pcm") return;
      const snapshot = session.analyzer.analyzeMono(event.data.samples as Float32Array, Number(event.data.sampleRate));
      session.pendingBeatPulse ||= snapshot.beatPulse;
    };
    source.connect(worklet);
    source.connect(session.context.destination);
    for (const track of session.stream.getTracks()) {
      track.addEventListener("ended", () => stopCapture(session, "stream_ended", true), { once: true });
    }
    session.timer = setInterval(() => publish(session), 100);
    return { ok: true };
  } catch {
    stopCapture(session, "capture_error", true);
    return { ok: false, error: "capture_error" };
  }
}

function publish(session: CaptureSession): void {
  if (current !== session) return;
  const snapshot = session.analyzer.snapshot;
  snapshot.beatPulse ||= session.pendingBeatPulse;
  session.pendingBeatPulse = false;
  void chrome.runtime.sendMessage({ type: "offscreen_features", captureId: session.id, features: snapshot }).catch(() => undefined);
}

function stopCapture(session: CaptureSession, reason: CaptureStopReason, notify: boolean): void {
  const owned = current === session;
  if (owned) current = undefined;
  if (session.timer) clearInterval(session.timer);
  session.timer = undefined;
  for (const track of session.stream?.getTracks() ?? []) track.stop();
  session.stream = undefined;
  const context = session.context;
  session.context = undefined;
  if (context && context.state !== "closed") void context.close().catch(() => undefined);
  session.analyzer.reset();
  session.pendingBeatPulse = false;
  if (notify && owned) void chrome.runtime.sendMessage({ type: "offscreen_capture_stopped", captureId: session.id, reason }).catch(() => undefined);
}
