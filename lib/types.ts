export type ProgressUpdate = {
  type: "progress" | "complete" | "error";
  stage?: "Preparing" | "Navigating" | "Curating" | "Narrating" | "Rendering" | "Finishing";
  message: string;
  progress?: number;
  jobId?: string;
  videoUrl?: string;
  downloadUrl?: string;
  expiresAt?: string;
  title?: string;
  duration?: number;
};

export type HEvent = {
  type: string;
  timestamp?: string;
  data: Record<string, unknown> & {
    kind?: string;
    image?: { type?: string; source?: string; media_type?: string };
    metadata?: Record<string, unknown>;
    tool_reqs?: Array<{ tool_name?: string; args?: Record<string, unknown>; id?: string }>;
  };
};

export type TutorialScene = {
  screenshot: Buffer;
  afterScreenshot?: Buffer;
  heading: string;
  caption: string;
  narration: string;
  action?: "click" | "type" | "scroll" | "select" | "wait" | "review";
  highlight?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
};

export type HWorkflowFinding = {
  action?: string;
  purpose?: string;
  result?: string;
  narration?: string;
};

export type HWorkflowReport = {
  title?: string;
  summary?: string;
  completion?: string;
  steps: HWorkflowFinding[];
};

export type VoiceName = "Orla" | "Niamh" | "Quinn" | "Harper" | "Toby";
export type DeliveryStyle = "professional" | "warm" | "energetic" | "calm";
export type TargetDuration = 15 | 30 | 45 | 60 | 90;

export type GenerationOptions = {
  voice: VoiceName;
  delivery: DeliveryStyle;
  introduction: string;
  targetDuration: TargetDuration;
};
