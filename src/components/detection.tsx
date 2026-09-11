import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw, ScanFace, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecorativeSticker, DoodleStar } from "./decorative";
import {
  gestures,
  parseBackendMessage,
  toPrediction,
  WEBSOCKET_URL,
  type BackendMessage,
  type Prediction,
} from "@/services/api";

type DetectionPhase = "waiting" | "detecting" | "analyzing" | "result" | "error";
type CameraProblem = "permission" | "missing" | "backend" | "no-face";

export function CameraView({ active, videoRef }: { active: boolean; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  return (
    <div className={active ? "camera-screen camera-active" : "camera-screen"}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Live webcam preview" />
      {!active && <div className="camera-placeholder"><Camera /><span>CAMERA STANDBY</span><small>your face goes here</small></div>}
      <div className="viewfinder"><i /><i /><i /><i /></div>
      {active && <div className="scan-line" />}
      <span className="camera-time">REC • 00:0{active ? "3" : "0"}</span>
    </div>
  );
}

export function DetectionStatus({ phase, backendStatus }: { phase: DetectionPhase; backendStatus: string | undefined }) {
  const content = {
    waiting: ["READY?", "Position your face inside the frame."],
    detecting: ["LOOKING FOR A NOD...", "Keep your head in the little box."],
    analyzing: ["DECODING THE NOD...", "AI is thinking... please wait..."],
    result: ["RESULT INCOMING!", "The machine has made a decision."],
    error: ["UH-OH!", "Our tiny machine needs attention."],
  }[phase];
  return <div className="detection-status" aria-live="polite"><span>{phase === "detecting" ? "● AI WATCHING" : "NOD ANALYSIS SYSTEM"}</span><h2>{content[0]}</h2><p>{backendStatus || content[1]}</p>{phase === "analyzing" && <div className="thinking-dots"><i /><i /><i /></div>}</div>;
}

export function ConfidenceMeter({ value, percentage }: { value: number; percentage: number }) {
  const safePercentage = Math.min(100, Math.max(0, percentage));
  return <div className="confidence"><div><span>CONFIDENCE</span><strong>{percentage.toFixed(1)}%</strong></div><div className="confidence-track"><i style={{ width: `${safePercentage}%` }} /></div><small>raw score: {value.toFixed(3)}</small></div>;
}

export function ResultCard({ result, onReset }: { result: Prediction; onReset: () => void }) {
  const details = gestures[result.gesture] ?? { emoji: "🧠", message: "Gesture recognized." };
  return (
    <div className="result-card">
      <span className="tape tape-center" /><DoodleStar className="result-star" />
      <span className="result-overline">YOUR NOD SAYS...</span>
      <h2>{result.gesture} <span>{details.emoji}</span></h2>
      <p>{details.message}</p><ConfidenceMeter value={result.confidence} percentage={result.confidencePercent} />
      <dl className="prediction-details">
        <div><dt>FACE</dt><dd>{result.faceDetected ? "DETECTED" : "NOT FOUND"}</dd></div>
        <div><dt>CALIBRATION</dt><dd>{result.calibrated ? "READY" : "PENDING"}</dd></div>
        <div><dt>POSE</dt><dd>Y {result.pose.yaw.toFixed(2)}° · P {result.pose.pitch.toFixed(2)}° · R {result.pose.roll.toFixed(2)}°</dd></div>
        <div><dt>FRAMES</dt><dd>{result.frames} / {result.sequenceLength}</dd></div>
      </dl>
      <p className="font-hand text-xl">“AI has spoken.”</p>
      <Button variant="hero" size="lg" onClick={onReset}><RefreshCw /> TRY AGAIN</Button>
    </div>
  );
}

export function ErrorState({ problem, onRetry }: { problem: CameraProblem; onRetry: () => void }) {
  const cameraProblem = problem === "permission" || problem === "missing";
  const copy = problem === "no-face"
    ? ["Where did you go? 👀", "Move into the camera frame."]
    : problem === "backend"
      ? ["AI is taking a tea break. ☕", "We couldn’t reach the Thalayattam engine."]
      : ["Oops. We can’t see you. 👀", problem === "missing" ? "We couldn’t find a camera on this device." : "Please allow camera access to use Thalayattam."];
  return <div className="error-note">{cameraProblem ? <CameraOff /> : <ScanFace />}<h2>{copy[0]}</h2><p>{copy[1]}</p><Button variant="scrap" size="lg" onClick={onRetry}><RefreshCw /> TRY AGAIN</Button></div>;
}

export function DetectionMachine() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const capturePendingRef = useRef(false);
  const sessionRef = useRef(0);
  const [phase, setPhase] = useState<DetectionPhase>("waiting");
  const [problem, setProblem] = useState<CameraProblem>("permission");
  const [result, setResult] = useState<Prediction | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState<string>();

  const stopCamera = useCallback(() => {
    sessionRef.current += 1;
    if (captureTimerRef.current !== null) window.clearInterval(captureTimerRef.current);
    captureTimerRef.current = null;
    capturePendingRef.current = false;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Camera stopped");
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; setCameraReady(false);
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  const begin = async () => {
    stopCamera();
    setResult(null);
    setBackendStatus("Connecting to the nod engine...");
    setPhase("detecting");
    if (!navigator.mediaDevices?.getUserMedia) { setProblem("missing"); setPhase("error"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const session = sessionRef.current;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (session !== sessionRef.current) return;

      setCameraReady(true);
      const socket = new WebSocket(WEBSOCKET_URL);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      let completed = false;

      const sendFrame = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.videoWidth === 0 || capturePendingRef.current || socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 1_000_000) return;
        capturePendingRef.current = true;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        try {
          const frame = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
          if (frame && session === sessionRef.current && socket.readyState === WebSocket.OPEN) {
            socket.send(await frame.arrayBuffer());
          }
        } finally {
          capturePendingRef.current = false;
        }
      };

      socket.onopen = () => {
        if (session !== sessionRef.current) return;
        setBackendStatus("Connected. Keep your face inside the frame.");
        void sendFrame();
        captureTimerRef.current = window.setInterval(() => void sendFrame(), 83);
      };

      socket.onmessage = (event) => {
        if (session !== sessionRef.current || typeof event.data !== "string") return;
        try {
          const message = parseBackendMessage(event.data);
          handleBackendMessage(message);
        } catch {
          setBackendStatus("The nod engine sent an unreadable response.");
        }
      };

      const handleBackendMessage = (message: BackendMessage) => {
        if (message.type === "error") {
          setBackendStatus(message.message || "The nod engine reported an error.");
          setProblem("backend");
          setPhase("error");
          stopCamera();
          return;
        }
        if (message.type === "status") {
          setPhase("detecting");
          setBackendStatus(message.message || message.status || (message.face_detected === false ? "No face detected. Move into the frame." : "Camera stream received."));
          return;
        }
        if (message.type === "calibration") {
          setPhase("analyzing");
          setBackendStatus(message.message || (message.calibrated ? "Calibration complete." : "Calibrating your head position..."));
          return;
        }

        completed = true;
        setResult(toPrediction(message));
        setPhase("result");
        stopCamera();
      };

      socket.onerror = () => {
        if (session !== sessionRef.current || completed) return;
        setBackendStatus("Couldn’t connect to the nod engine.");
        setProblem("backend");
        setPhase("error");
        stopCamera();
      };
      socket.onclose = () => {
        if (session !== sessionRef.current || completed) return;
        setBackendStatus("Connection to the nod engine was lost.");
        setProblem("backend");
        setPhase("error");
        stopCamera();
      };
    } catch (error) {
      stopCamera();
      const name = error instanceof DOMException ? error.name : "";
      setProblem(name === "NotFoundError" ? "missing" : error instanceof Error && error.message === "NO_FACE" ? "no-face" : error instanceof Error && error.message === "BACKEND_ERROR" ? "backend" : "permission");
      setPhase("error");
    }
  };
  const reset = () => { stopCamera(); setResult(null); setBackendStatus(undefined); setPhase("waiting"); };

  return (
    <main className="detect-page">
      <div className="detect-heading"><span className="kicker">WELCOME TO THE MACHINE</span><h1>SHOW US YOUR NOD</h1><p>Give us a nod... any nod.</p></div>
      <div className="detector-layout">
        <div className="webcam-rig">
          <DecorativeSticker tone="olive" className="absolute -left-4 top-8 -rotate-6 z-10">WEBCAM ONLINE</DecorativeSticker>
          <DecorativeSticker tone="pink" className="absolute -right-5 bottom-14 rotate-6 z-10">AI WATCHING 👀</DecorativeSticker>
          <div className="rig-bar"><span>NOD DETECTOR v1.0</span><span>_ □ ×</span></div>
          <CameraView active={cameraReady && (phase === "detecting" || phase === "analyzing")} videoRef={videoRef} />
          <canvas ref={canvasRef} hidden aria-hidden="true" />
          <div className="rig-footer"><span><i /> SYSTEM READY</span><span>DECODING MALAYALI</span></div>
        </div>
        <aside className="detector-panel">
          {phase === "result" && result ? <ResultCard result={result} onReset={reset} /> : phase === "error" ? <ErrorState problem={problem} onRetry={begin} /> : <>
            <DetectionStatus phase={phase} backendStatus={backendStatus} />
            {phase === "waiting" && <Button variant="hero" size="xl" onClick={begin}><Camera /> START DETECTION</Button>}
            {phase === "detecting" && <div className="activity-label"><i /> DO NOT SHAKE TOO HARD</div>}
            {phase === "analyzing" && <div className="analysis-ticket"><Sparkles /> THIS IS IMPORTANT RESEARCH</div>}
          </>}
        </aside>
      </div>
      <p className="responsible-note">PLEASE NOD RESPONSIBLY ↑</p>
    </main>
  );
}