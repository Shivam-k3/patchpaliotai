import { FormEvent, useState } from "react";
import { annualPrice, BillingCycle, displayPrice } from "./lib/pricing";
import { validateSignup } from "./lib/validation";

type Plan = {
  name: string;
  description: string;
  monthlyPrice: number;
  features: string[];
  featured?: boolean;
};

const plans: Plan[] = [
  { name: "Starter", description: "For focused teams finding their first signal.", monthlyPrice: 0, features: ["Up to 3 collaborators", "Core workspace", "Community support"] },
  { name: "Growth", description: "For teams turning momentum into a system.", monthlyPrice: 29, features: ["Unlimited collaborators", "Automations and reports", "Priority support"], featured: true },
  { name: "Scale", description: "For organizations building a durable advantage.", monthlyPrice: 79, features: ["Advanced permissions", "Custom workflows", "Dedicated success partner"] },
];

function DashboardIllustration() {
  return (
    <div className="dashboard" aria-label="Northstar product dashboard preview">
      <div className="dashboard-top"><span className="window-dots">● ● ●</span><span>northstar / growth overview</span><span>•••</span></div>
      <div className="dashboard-body">
        <aside className="dashboard-sidebar"><strong>N</strong><span className="active">Overview</span><span>Signals</span><span>Reports</span><span>Team</span><span>Settings</span></aside>
        <div className="dashboard-content">
          <div className="dashboard-heading"><div><small>MONDAY, OCTOBER 14</small><h3>Good morning, Maya</h3></div><button type="button">+ Add signal</button></div>
          <div className="metric-grid"><div><small>Focus score</small><strong>86.4</strong><em>↑ 12.8%</em></div><div><small>Active initiatives</small><strong>24</strong><em>↑ 4.2%</em></div><div><small>Hours saved</small><strong>128</strong><em>↑ 18.1%</em></div></div>
          <div className="chart-card"><div className="card-heading"><strong>Momentum over time</strong><span>Last 30 days⌄</span></div><div className="chart"><span className="chart-line" /><i /><i /><i /><i /></div></div>
          <div className="activity-card"><strong>Recent signals</strong><span><b className="green-dot" />Launch plan is on track <small>2m ago</small></span><span><b className="purple-dot" />Design review needs input <small>18m ago</small></span></div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateSignup(email);
    if (!result.valid) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    setFeedback({ kind: "success", text: "You’re on the list for the Northstar demo. This is a local preview signup." });
    setEmail("");
  }

  return (
    <div className="site-shell">
      <header className="nav-wrap">
        <nav className="nav container" aria-label="Main navigation">
          <a className="brand" href="#top" aria-label="Northstar home"><span className="brand-mark">✦</span> northstar</a>
          <button className="menu-button" type="button" aria-expanded={menuOpen} aria-controls="main-links" onClick={() => setMenuOpen(!menuOpen)}><span className="sr-only">Toggle menu</span>☰</button>
          <div id="main-links" className={`nav-links ${menuOpen ? "open" : ""}`}>
            <a href="#product" onClick={() => setMenuOpen(false)}>Product</a><a href="#benefits" onClick={() => setMenuOpen(false)}>Benefits</a><a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a><a href="#stories" onClick={() => setMenuOpen(false)}>Stories</a>
            <a className="nav-login" href="#signup" onClick={() => setMenuOpen(false)}>Sign in <span>↗</span></a>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="hero container">
          <div className="hero-copy"><p className="eyebrow"><span>✦</span> The operating system for momentum</p><h1>Find your north.<br /><em>Move with confidence.</em></h1><p className="hero-text">Northstar gives ambitious teams the clarity to turn complex work into meaningful progress — all in one calm, connected workspace.</p><div className="hero-actions"><a className="button button-primary" href="#signup">Start for free <span>→</span></a><a className="text-link" href="#product"><span className="play">▶</span> See how it works</a></div><div className="social-proof"><div className="avatars"><span>AM</span><span>JR</span><span>SK</span><span>+</span></div><p><strong>Loved by 2,000+ teams</strong><br /><span>Built for people who make things happen.</span></p></div></div>
          <div className="hero-art"><div className="glow" /><DashboardIllustration /><div className="floating-card floating-one"><span>✦</span><strong>12.8%</strong><small>Focus score ↑</small></div><div className="floating-card floating-two"><span className="green-dot" /><strong>On track</strong><small>Launch initiative</small></div></div>
        </section>

        <section className="logo-strip"><div className="container logo-row"><span>Trusted by thoughtful teams at</span><strong>arc<span>°</span></strong><strong>LOOM</strong><strong>Woven</strong><strong>atlas</strong><strong>vercel<span>▲</span></strong></div></section>

        <section id="product" className="section container"><div className="section-intro centered"><p className="eyebrow">Everything in one view</p><h2>Clarity is a competitive advantage.</h2><p>Bring your goals, signals, and next steps together so your team can spend less time searching and more time moving.</p></div><div className="features"><article className="feature-card"><div className="feature-icon orange">◌</div><h3>See the whole picture</h3><p>Connect the dots between daily work and the outcomes that matter most.</p><a href="#benefits">Explore visibility <span>→</span></a></article><article className="feature-card feature-highlight"><div className="feature-icon purple">⌁</div><h3>Move in sync</h3><p>Give every collaborator the context they need to make a confident next move.</p><a href="#benefits">Explore alignment <span>→</span></a></article><article className="feature-card"><div className="feature-icon green">↗</div><h3>Make progress visible</h3><p>Turn momentum into a habit with simple, honest signals your team can trust.</p><a href="#benefits">Explore momentum <span>→</span></a></article></div></section>

        <section id="benefits" className="benefits-section"><div className="container benefits-grid"><div><p className="eyebrow">Built for better work</p><h2>Less noise.<br /><em>More north stars.</em></h2><p className="section-copy">When the path is clear, great work gets easier. Northstar helps teams protect their focus and make progress they can feel.</p><a className="button button-dark" href="#pricing">Explore the platform <span>→</span></a></div><div className="benefit-metrics"><div><strong>32<span>%</span></strong><p>less time spent in status meetings</p></div><div><strong>2.4<span>×</span></strong><p>faster decision-making cycles</p></div><div><strong>91<span>%</span></strong><p>of teams report better alignment</p></div></div></div></section>

        <section id="pricing" className="section container pricing-section"><div className="section-intro centered"><p className="eyebrow">Simple, human pricing</p><h2>Choose your pace.</h2><p>Start free, grow when you’re ready, and keep the clarity at every stage.</p><div className="billing-toggle" role="group" aria-label="Billing cycle"><button type="button" className={billing === "monthly" ? "selected" : ""} onClick={() => setBilling("monthly")}>Monthly</button><button type="button" className={billing === "annual" ? "selected" : ""} onClick={() => setBilling("annual")}>Annual <b>Save 20%</b></button></div></div><div className="pricing-grid">{plans.map((plan) => <article className={`price-card ${plan.featured ? "featured" : ""}`} key={plan.name}>{plan.featured && <span className="popular">Most popular</span>}<h3>{plan.name}</h3><p>{plan.description}</p><div className="price">{plan.monthlyPrice === 0 ? "$0" : `$${displayPrice(plan.monthlyPrice, billing)}`}<small>{plan.monthlyPrice === 0 ? " forever" : "/ month"}</small></div>{billing === "annual" && plan.monthlyPrice > 0 && <small className="annual-note">${annualPrice(plan.monthlyPrice)} billed annually</small>}<a href="#signup" className={`button ${plan.featured ? "button-primary" : "button-outline"}`}>Get started <span>→</span></a><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul></article>)}</div></section>

        <section id="signup" className="signup-section"><div className="container signup-card"><div><p className="eyebrow">A clearer way forward</p><h2>Ready to find your north?</h2><p>Join the early access list and get a first look at what’s next.</p></div><form onSubmit={handleSignup} noValidate><label htmlFor="email">Work email</label><div className="signup-input"><input id="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFeedback(null); }} placeholder="you@company.com" aria-describedby={feedback ? "signup-feedback" : undefined} /><button type="submit">Join the waitlist <span>→</span></button></div>{feedback && <p id="signup-feedback" className={`feedback ${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}</p>}</form></div></section>
      </main>
      <footer id="stories" className="footer"><div className="container footer-inner"><div><a className="brand" href="#top"><span className="brand-mark">✦</span> northstar</a><p>Make meaningful progress,<br />one clear step at a time.</p></div><div className="footer-links"><div><strong>Explore</strong><a href="#product">Product</a><a href="#benefits">Benefits</a><a href="#pricing">Pricing</a></div><div><strong>Company</strong><a href="#stories">About us</a><a href="#stories">Careers</a><a href="#stories">Journal</a></div><div><strong>Connect</strong><a href="#signup">Contact</a><a href="#signup">Newsletter</a><a href="#signup">Demo</a></div></div></div><div className="container footer-bottom"><span>© 2025 Northstar, Inc.</span><span>Built with intention.</span></div></footer>
    </div>
  );
}

export default App;
