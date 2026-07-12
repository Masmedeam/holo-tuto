import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/Logo";

// The marketing page changes independently from the generator. Keep it out of
// shared edge caches so a deployment can never leave the previous root page live.
export const dynamic = "force-dynamic";

const useCases = [
  { icon: "↗", title: "Customer onboarding", text: "Help new users reach their first win without a long call." },
  { icon: "?", title: "Support", text: "Answer repeat questions with a short, clear walkthrough." },
  { icon: "✓", title: "Team training", text: "Teach internal tools and processes in a format people will use." },
  { icon: "✦", title: "Product updates", text: "Show what changed and how to use it while the release is still fresh." }
];

const teams = ["Product", "Customer success", "Support", "Marketing", "People teams"];

export default function LandingPage() {
  return (
    <main className="landing">
      <header className="landing-header">
        <nav className="landing-nav">
          <Logo />
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#use-cases">Use cases</a>
          </div>
          <Link className="nav-cta" href="/app">Open Voodoo <span>→</span></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <h1>Show people how<br /><em>your product works.</em></h1>
        <p>Paste a web app link and name a task. Voodoo uses the product, captures the important steps, and creates a clear narrated video.</p>
        <div className="hero-actions">
          <Link className="primary-cta" href="/app">Create a tutorial <span>→</span></Link>
          <a className="text-link" href="#how-it-works">See how it works <span>↓</span></a>
        </div>
        <div className="hero-visual">
          <Image src="/landing/voodoo-hero.webp" alt="A software workflow becoming a narrated video tutorial" width={1536} height={824} priority sizes="(max-width: 900px) 94vw, 1180px" />
        </div>
        <div className="hero-note"><span>One link.</span><span>One task.</span><span>One ready-to-share video.</span></div>
      </section>

      <section className="story-section section-problem" id="why-voodoo">
        <div className="section-copy">
          <h2>Helpful videos should not take days to make.</h2>
          <p>People want to see how a product works. But recording, narrating, editing, and updating every tutorial takes too much time.</p>
          <p>So videos go out of date—or never get made at all.</p>
        </div>
        <div className="section-image">
          <Image src="/landing/problem.webp" alt="Outdated documents and repeated video recording work" width={1536} height={1024} sizes="(max-width: 800px) 94vw, 52vw" />
        </div>
      </section>

      <section className="story-section reverse section-proof">
        <div className="section-copy">
          <h2>Showing is better than telling.</h2>
          <p>A short walkthrough gives people the full picture: where to go, what to click, and what should happen next.</p>
          <ul className="simple-list">
            <li><span>✓</span> Easier to follow</li>
            <li><span>✓</span> Faster to understand</li>
            <li><span>✓</span> Simple to share</li>
          </ul>
        </div>
        <div className="section-image">
          <Image src="/landing/visual-proof.webp" alt="A clear video replacing a large pile of written instructions" width={1536} height={1024} sizes="(max-width: 800px) 94vw, 52vw" />
        </div>
      </section>

      <section className="story-section" id="how-it-works">
        <div className="section-copy">
          <h2>From app link to finished video.</h2>
          <div className="step-list">
            <div><b>1</b><p><strong>Describe the task.</strong><br />Add the app link and say what you want to explain.</p></div>
            <div><b>2</b><p><strong>Voodoo does the work.</strong><br />It follows the workflow and keeps the useful moments.</p></div>
            <div><b>3</b><p><strong>Share the result.</strong><br />Get a polished video with narration, captions, and smooth focus.</p></div>
          </div>
        </div>
        <div className="section-image">
          <Image src="/landing/how-it-works.webp" alt="Three steps from application link to narrated video" width={1536} height={768} sizes="(max-width: 800px) 94vw, 52vw" />
        </div>
      </section>

      <section className="story-section reverse section-current">
        <div className="section-copy">
          <h2>Your product changed. Your tutorial can too.</h2>
          <p>When the interface changes, skip the studio setup and editing timeline. Run the tutorial again and get a fresh version.</p>
          <div className="callout"><span>↻</span><p><strong>Regenerate, don&apos;t re-record.</strong><br />Keep help content close to the product people actually use.</p></div>
        </div>
        <div className="section-image">
          <Image src="/landing/stay-current.webp" alt="A product update becoming a refreshed video tutorial" width={1536} height={864} sizes="(max-width: 800px) 94vw, 52vw" />
        </div>
      </section>

      <section className="use-case-section" id="use-cases">
        <div className="section-heading">
          <h2>One clear video.<br />Many useful moments.</h2>
          <p>Use Voodoo anywhere someone needs to understand software quickly.</p>
        </div>
        <div className="use-case-layout">
          <div className="use-case-image"><Image src="/landing/use-cases.webp" alt="A tutorial supporting onboarding, support, training, and product updates" width={1536} height={864} sizes="(max-width: 800px) 94vw, 52vw" /></div>
          <div className="use-case-grid">
            {useCases.map((item) => <article key={item.title}><span>{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="story-section reverse section-teams">
        <div className="section-copy">
          <h2>Make product knowledge easy to find and easy to trust.</h2>
          <p>Give every team a simple way to create visual help, without waiting for a video expert.</p>
          <div className="team-pills">{teams.map((team) => <span key={team}>{team}</span>)}</div>
        </div>
        <div className="section-image">
          <Image src="/landing/teams.webp" alt="Different teams connected to one clear tutorial library" width={1536} height={1024} sizes="(max-width: 800px) 94vw, 52vw" />
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-spark">✦</div>
        <h2>Turn your next workflow<br />into a clear video.</h2>
        <p>No recording setup. No editing timeline. Just show Voodoo what to explain.</p>
        <Link className="primary-cta light" href="/app">Create a tutorial <span>→</span></Link>
      </section>

      <footer className="landing-footer">
        <Logo />
        <p>Clear software tutorials, made automatically.</p>
        <Link href="/app">Open the app →</Link>
      </footer>
    </main>
  );
}
