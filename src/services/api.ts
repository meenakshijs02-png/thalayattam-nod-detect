export const WEBSOCKET_URL =
  (import.meta.env["VITE_WS_URL"] as string | undefined) ??
  "ws://127.0.0.1:8000/ws/predict";

export const gestures: Record<string, { emoji: string; message: string }> = {
  ATHE: { emoji: "👍", message: "Athe, manassilaayi." },
  SHERI: { emoji: "😌", message: "Sheri, set!" },
  VENDA: { emoji: "❌", message: "Venda alle? 😭" },
  NOKKAM: { emoji: "👀", message: "Nokkam..." },
  ARIYILLA: { emoji: "🤷", message: "Enikkum ariyilla." },
};

export type Pose = {
  yaw: number;
  pitch: number;
  roll: number;
};

export type Prediction = {
  gesture: string;
  confidence: number;
  confidencePercent: number;
  calibrated: boolean;
  faceDetected: boolean;
  frames: number;
  sequenceLength: number;
  pose: Pose;
};

export type BackendMessage = {
  type: "status" | "calibration" | "prediction" | "error";
  message?: string;
  status?: string;
  gesture?: string;
  confidence?: number;
  confidence_percent?: number;
  calibrated?: boolean;
  face_detected?: boolean;
  frames?: number;
  sequence_length?: number;
  pose?: Partial<Pose>;
};

export function parseBackendMessage(value: string): BackendMessage {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    throw new Error("INVALID_RESPONSE");
  }

  const message = parsed as BackendMessage;
  if (!["status", "calibration", "prediction", "error"].includes(message.type)) {
    throw new Error("INVALID_RESPONSE");
  }
  return message;
}

export function toPrediction(message: BackendMessage): Prediction {
  if (message.type !== "prediction" || typeof message.gesture !== "string") {
    throw new Error("INVALID_PREDICTION");
  }

  const confidence = Number(message.confidence ?? 0);
  return {
    gesture: message.gesture.toUpperCase(),
    confidence,
    confidencePercent: Number(message.confidence_percent ?? confidence * 100),
    calibrated: Boolean(message.calibrated),
    faceDetected: Boolean(message.face_detected),
    frames: Number(message.frames ?? 0),
    sequenceLength: Number(message.sequence_length ?? 0),
    pose: {
      yaw: Number(message.pose?.yaw ?? 0),
      pitch: Number(message.pose?.pitch ?? 0),
      roll: Number(message.pose?.roll ?? 0),
    },
  };
}