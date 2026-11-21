export type JobStage =
  | "queued"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

export type LogLine = {
  time: string;
  stage: JobStage | "info";
  message: string;
};

export type WorkerProgress = {
  stage: JobStage;
  progress: number;
  message: string;
  duration?: number;
  clips?: {
    title: string;
    startTime: number;
    endTime: number;
    score: number;
    reason?: string;
    type?: string;
    file: string;
    thumb?: string;
    look?: string;
    transcript?: string;
  }[];
};

export const STAGES: { key: JobStage; label: string; description: string }[] = [
  { key: "downloading", label: "Ingest source", description: "Preparing the video and audio streams" },
  { key: "transcribing", label: "Transcribe speech", description: "Local Whisper speech-to-text with word timings" },
  { key: "analyzing", label: "Find highlights", description: "Energy, speech density and scene-change analysis" },
  { key: "rendering", label: "Render vertical clips", description: "9:16 reframing, facecam, captions and audio cleanup" },
  { key: "finalizing", label: "Finalize", description: "Thumbnails and project indexing" },
];
