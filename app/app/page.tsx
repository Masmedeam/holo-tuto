"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";

type ProgressEvent = {
  type: "progress" | "complete" | "error";
  stage?: string;
  message?: string;
  progress?: number;
  videoUrl?: string;
  downloadUrl?: string;
  expiresAt?: string;
  jobId?: string;
  title?: string;
  duration?: number;
};

type HistoryVideo = ProgressEvent & {
  type: "complete";
  videoUrl: string;
  createdAt: string;
  sourceUrl?: string;
};

const stages = ["Preparing", "Navigating", "Curating", "Narrating", "Rendering", "Finishing"];
const historyKey = "holo:tutorial-history:v1";
const maxHistoryItems = 20;
const narratorOptions = [
  { name: "Orla", tone: "polished" },
  { name: "Niamh", tone: "approachable" },
  { name: "Quinn", tone: "contemporary" },
  { name: "Harper", tone: "confident" },
  { name: "Toby", tone: "concise" }
];

export default function VoodooApp() {
  const [url, setUrl] = useState("");
  const [feature, setFeature] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [voice, setVoice] = useState("Orla");
  const [delivery, setDelivery] = useState("professional");
  const [introduction, setIntroduction] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [targetDuration, setTargetDuration] = useState(45);
  const [status, setStatus] = useState<ProgressEvent | null>(null);
  const [running, setRunning] = useState(false);
  const [video, setVideo] = useState<ProgressEvent | null>(null);
  const [history, setHistory] = useState<HistoryVideo[]>([]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(historyKey) || "[]") as HistoryVideo[];
      if (Array.isArray(stored)) setHistory(stored.filter((item) => item?.type === "complete" && typeof item.videoUrl === "string" && typeof item.createdAt === "string").slice(0, maxHistoryItems));
    } catch {
      localStorage.removeItem(historyKey);
    }
    return () => previewAudio.current?.pause();
  }, []);

  const activeStage = useMemo(() => {
    if (!status?.stage) return -1;
    return stages.findIndex((stage) => stage.toLowerCase() === status.stage?.toLowerCase());
  }, [status]);

  function rememberVideo(update: ProgressEvent) {
    if (!update.videoUrl) return;
    const item: HistoryVideo = {
      ...update,
      type: "complete",
      videoUrl: update.videoUrl,
      createdAt: new Date().toISOString(),
      sourceUrl: url
    };
    setHistory((current) => {
      const next = [item, ...current.filter((previous) => previous.jobId !== item.jobId)].slice(0, maxHistoryItems);
      try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { /* Browser storage may be unavailable. */ }
      return next;
    });
  }

  function removeHistoryItem(identifier: string) {
    setHistory((current) => {
      const next = current.filter((item) => (item.jobId || item.createdAt) !== identifier);
      try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { /* Browser storage may be unavailable. */ }
      return next;
    });
  }

  function hearVoice(name: string) {
    previewAudio.current?.pause();
    if (playingVoice === name) {
      previewAudio.current = null;
      setPlayingVoice(null);
      return;
    }
    const audio = new Audio(`/voice-previews/${name}.wav`);
    previewAudio.current = audio;
    setPlayingVoice(name);
    audio.onended = () => setPlayingVoice(null);
    audio.onerror = () => setPlayingVoice(null);
    audio.play().catch(() => setPlayingVoice(null));
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    setRunning(true);
    setVideo(null);
    setStatus({ type: "progress", stage: "Preparing", message: "Starting your tutorial…", progress: 3 });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, feature, accessCode, voice, delivery, introduction, targetDuration, loginUsername, loginPassword })
      });
      setLoginPassword("");

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Could not start tutorial generation.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const update = JSON.parse(line) as ProgressEvent;
          if (update.type === "error") throw new Error(update.message || "Generation failed.");
          setStatus(update);
          if (update.type === "complete") {
            setVideo(update);
            rememberVideo(update);
          }
        }
        if (done) break;
      }
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <main>
      <nav>
        <Logo />
      </nav>

      <section className="hero">
        <h1>Turn software into<br /><em>a clear tutorial.</em></h1>
        <p className="intro">Paste a web app link. Voodoo explores the workflow, captures each important moment, and returns a polished narrated video.</p>
      </section>

      <section className="workspace">
        <form onSubmit={generate} className="generator-card">
          <div className="card-heading">
            <h2>What should we explain?</h2>
          </div>

          <label>
            Application URL
            <div className="input-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></svg>
              <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com" disabled={running} />
            </div>
          </label>

          <label>
            Feature or workflow <span className="optional">Optional</span>
            <textarea value={feature} onChange={(e) => setFeature(e.target.value)} placeholder="e.g. How to create a monthly sales report" maxLength={300} disabled={running} />
            <span className="hint">Leave blank and Voodoo will choose a useful feature to demonstrate.</span>
          </label>

          <label>
            Private beta access
            <input className="access-input" type="password" required value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Enter your access code" autoComplete="current-password" disabled={running} />
          </label>

          <details className="more-options">
            <summary>
              <span><strong>More options</strong><small>Voice, delivery, and video length</small></span>
              <i aria-hidden="true">+</i>
            </summary>
            <div className="options-content">
              <div className="narration-options">
                <div className="narrator-field">
                  <span className="field-label">Narrator</span>
                  <div className="voice-picker">
                    {narratorOptions.map((option) => (
                      <div className={`voice-option ${voice === option.name ? "selected" : ""}`} key={option.name}>
                        <button type="button" className="voice-select" aria-pressed={voice === option.name} onClick={() => setVoice(option.name)} disabled={running}>
                          <strong>{option.name}</strong><span>{option.tone}</span>
                        </button>
                        <button type="button" className="voice-hear" onClick={() => hearVoice(option.name)} aria-label={`${playingVoice === option.name ? "Stop" : "Hear"} ${option.name}`}>
                          {playingVoice === option.name ? "■ Stop" : "▶ Hear"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <label>
                  Delivery
                  <select value={delivery} onChange={(e) => setDelivery(e.target.value)} disabled={running}>
                    <option value="professional">Professional</option>
                    <option value="warm">Warm &amp; friendly</option>
                    <option value="energetic">Energetic</option>
                    <option value="calm">Calm &amp; measured</option>
                  </select>
                </label>
              </div>

              <label>
                Opening line <span className="optional">Optional</span>
                <textarea className="intro-input" value={introduction} onChange={(e) => setIntroduction(e.target.value)} placeholder="e.g. Welcome to LedgerPro. In this guide, we’ll create a sales register by period." maxLength={240} disabled={running} />
                <span className="hint">Use the exact words you want the narrator to open with. Delivery controls pace and expressiveness.</span>
              </label>

              <fieldset className="auth-options">
                <legend>Application sign-in <span className="optional">Optional</span></legend>
                <div className="option-grid">
                  <label>
                    Username or email
                    <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="name@example.com" autoComplete="username" maxLength={320} required={Boolean(loginPassword)} disabled={running} />
                  </label>
                  <label>
                    Password
                    <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Application password" autoComplete="current-password" maxLength={512} required={Boolean(loginUsername)} disabled={running} />
                  </label>
                </div>
                <p className="auth-note">Used only if the application asks Voodoo to sign in. These credentials are used for this run and are never saved in your tutorial history or application logs.</p>
              </fieldset>

              <fieldset>
                <legend>Target length</legend>
                <div className="duration-options">
                  {[15, 30, 45, 60, 90].map((seconds) => (
                    <label key={seconds} className={targetDuration === seconds ? "selected" : ""}>
                      <input type="radio" name="duration" value={seconds} checked={targetDuration === seconds} onChange={() => setTargetDuration(seconds)} disabled={running} />
                      <strong>{seconds}s</strong>
                      <span>{seconds === 15 ? "Snapshot" : seconds === 30 ? "Quick" : seconds === 45 ? "Standard" : seconds === 60 ? "Detailed" : "Walkthrough"}</span>
                    </label>
                  ))}
                </div>
                <p className="duration-note">Voodoo targets this length; the workflow may make the final video slightly shorter or longer.</p>
              </fieldset>
            </div>
          </details>

          <button className="generate-button" disabled={running || !url || !accessCode}>
            {running ? <span className="spinner" /> : <span>✦</span>}
            {running ? "Creating your tutorial" : "Generate tutorial"}
            {!running && <span className="arrow">→</span>}
          </button>
        </form>

        <aside className={`progress-card ${status ? "visible" : ""}`}>
          {!status ? (
            <div className="empty-state">
              <div className="preview-icon"><span>▶</span></div>
              <h3>Your video will appear here</h3>
              <p>Most tutorials take 1–3 minutes.</p>
            </div>
          ) : video?.videoUrl ? (
            <div className="result">
              <div className="result-top"><span className="success-dot">✓</span><span>Ready to watch</span></div>
              <video src={video.videoUrl} controls playsInline preload="metadata" />
              <h3>{video.title || "Your Voodoo tutorial"}</h3>
              <div className="result-actions">
                <a href={video.videoUrl} target="_blank" rel="noreferrer">Open video</a>
                <a className="secondary-action" href={video.downloadUrl || video.videoUrl}>Download</a>
                <button type="button" onClick={() => { setStatus(null); setVideo(null); }}>Create another</button>
              </div>
            </div>
          ) : status.type === "error" ? (
            <div className="error-state"><span>!</span><h3>We couldn’t finish this tutorial</h3><p>{status.message}</p>{status.jobId && <small>Reference: {status.jobId}</small>}<button type="button" onClick={() => setStatus(null)}>Try again</button></div>
          ) : (
            <div className="progress-state">
              <div className="orb"><div /><span>✦</span></div>
              <span className="making">CREATING YOUR VIDEO</span>
              <h3>{status.message}</h3>
              <div className="progress-bar"><i style={{ width: `${status.progress || 5}%` }} /></div>
              <div className="stage-list">
                {stages.map((stage, index) => <span key={stage} className={index <= activeStage ? "active" : ""}>{index < activeStage ? "✓" : index + 1} {stage}</span>)}
              </div>
              <p>Keep this tab open while Voodoo works.</p>
            </div>
          )}
        </aside>
      </section>

      {history.length > 0 && (
        <section className="history-section">
          <div className="history-heading">
            <h2>Previous tutorials</h2>
            <p>Saved in this browser. Private video links remain available for seven days.</p>
          </div>
          <div className="history-grid">
            {history.map((item) => {
              const expired = item.expiresAt ? Date.parse(item.expiresAt) <= Date.now() : false;
              return (
                <article className="history-card" key={item.jobId || item.createdAt}>
                  <button className="history-preview" type="button" disabled={expired} onClick={() => { setStatus(item); setVideo(item); window.scrollTo({ top: 430, behavior: "smooth" }); }}>
                    <span>{expired ? "Expired" : "▶"}</span>
                  </button>
                  <div className="history-copy">
                    <h3>{item.title || "Untitled tutorial"}</h3>
                    <p>{new Date(item.createdAt).toLocaleString()}{item.duration ? ` · ${Math.round(item.duration)}s` : ""}</p>
                    <div className="history-actions">
                      {!expired && <a href={item.videoUrl} target="_blank" rel="noreferrer">Watch</a>}
                      {!expired && <a href={item.downloadUrl || item.videoUrl}>Download</a>}
                      <button type="button" onClick={() => removeHistoryItem(item.jobId || item.createdAt)}>Remove</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

    </main>
  );
}
