
import React, { useEffect, useState } from "react";
import {
  Activity, HeartPulse, LayoutDashboard, ClipboardList, FileUp,
  BookOpen, LogOut, ShieldCheck, Menu, X, AlertTriangle,
  RefreshCw, Upload, CheckCircle, User, Lock, ChevronRight,
  Thermometer, Droplets, ArrowRight, FileText, Brain,
  Users, Eye, EyeOff, Mail, Stethoscope, Sparkles
} from "lucide-react";
import "./App.css";

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8001").replace(/\/$/, "");

const VITALS = [
  ["HR", "Heart rate", "bpm", 20, 250],
  ["O2Sat", "Oxygen saturation", "%", 50, 100],
  ["Temp", "Temperature", "°C", 30, 43],
  ["SBP", "Systolic blood pressure", "mmHg", 40, 300],
  ["MAP", "Mean arterial pressure", "mmHg", 20, 250],
  ["DBP", "Diastolic blood pressure", "mmHg", 20, 200],
  ["Resp", "Respiratory rate", "/min", 1, 80],
  ["EtCO2", "End-tidal CO₂", "mmHg", 1, 100],
];

const NAV = [
  ["Dashboard", LayoutDashboard],
  ["Vital Signs", Activity],
  ["History", ClipboardList],
  ["Report Upload", FileUp],
  ["Prevention", BookOpen],
];

const emptyReading = () => Object.fromEntries(VITALS.map(([key]) => [key, ""]));

function getToken() {
  return sessionStorage.getItem("sepsiscare_token") || "";
}

function getUser() {
  try {
    return JSON.parse(sessionStorage.getItem("sepsiscare_user") || "null");
  } catch {
    return null;
  }
}

async function api(path, options = {}, token = getToken()) {
  const headers = { ...(options.headers || {}) };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  let data = {};

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = { detail: await response.text() };
  }

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Request failed (${response.status})`);
  }
  return data;
}

function Button({ children, onClick, type = "button", variant = "primary", disabled = false }) {
  return (
    <button type={type} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Brand({ light = false }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <div className="brand-symbol">
        <span className="brand-cross-v" />
        <span className="brand-cross-h" />
      </div>
      <div className="brand-copy">
        <strong>Sepsis<span>Care</span></strong>
        <small>EARLY DETECTION · BETTER OUTCOMES</small>
      </div>
    </div>
  );
}

/* Login and register screen */
function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { username: email, email, password }
        : { name, username: email, email, password };

      const data = await api(path, {
        method: "POST",
        body: JSON.stringify(body),
      }, "");

      const token = data.access_token || data.token || data.accessToken;
      if (!token) {
        throw new Error("Login response-la token kidaikkala. Backend authentication check pannu.");
      }

      const user = data.user || {
        name: data.name || name || email.split("@")[0],
        email,
      };

      sessionStorage.setItem("sepsiscare_token", token);
      sessionStorage.setItem("sepsiscare_user", JSON.stringify(user));
      onLogin(token, user);
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-background" />
      <div className="auth-shade" />
      <div className="auth-green-wave wave-back" />
      <div className="auth-green-wave wave-front" />

      <div className="auth-heart-decoration">
        <HeartPulse size={45} strokeWidth={1.2} />
      </div>

      <div className="auth-layout">
        <section className="auth-hero">
          <Brand light />

          <div className="auth-hero-copy">
            <span className="hero-kicker">INTELLIGENT CLINICAL SUPPORT</span>
            <h1>
              Vital signs.
              <br />
              Earlier <span>insights.</span>
            </h1>
            <p>
              AI-powered sepsis prediction based on
              <br className="desktop-break" />
              vital signs. Supporting faster decisions
              <br className="desktop-break" />
              and better patient outcomes.
            </p>
          </div>

          <div className="auth-feature-row">
            <div className="auth-feature">
              <div className="auth-feature-icon"><Activity size={26} /></div>
              <strong>Track</strong>
              <span>vital signs</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><Brain size={26} /></div>
              <strong>Analyze</strong>
              <span>with ML models</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><ShieldCheck size={26} /></div>
              <strong>Support</strong>
              <span>clinical decisions</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><Users size={26} /></div>
              <strong>Improve</strong>
              <span>patient outcomes</span>
            </div>
          </div>

          <div className="auth-ecg">
            <svg viewBox="0 0 520 75" role="img" aria-label="Decorative heartbeat waveform">
              <path d="M0 38 H95 L112 38 L126 26 L141 51 L157 7 L176 63 L194 38 H274 L288 38 L304 26 L319 50 L334 8 L352 63 L371 38 H430"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M450 39 C430 18 402 34 450 66 C498 34 470 18 450 39Z"
                fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="auth-research-note">
            <ShieldCheck size={24} />
            <div>
              <strong>Academic research prototype</strong>
              <span>Not for clinical diagnosis</span>
            </div>
          </div>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-card-brand">
              <Brand light />
              <p>Vital signs. Earlier insights.</p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={mode === "login" ? "auth-tab active" : "auth-tab"}
                onClick={() => { setMode("login"); setError(""); }}
              >
                Login
              </button>
              <button
                type="button"
                className={mode === "register" ? "auth-tab active" : "auth-tab"}
                onClick={() => { setMode("register"); setError(""); }}
              >
                Register
              </button>
            </div>

            <div className="auth-heading">
              <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p>
                {mode === "login"
                  ? "Sign in to continue to your workspace."
                  : "Register to access your SepsisCare workspace."}
              </p>
            </div>

            <form onSubmit={submit} className="auth-form">
              {mode === "register" && (
                <label className="auth-field">
                  <span>Full name</span>
                  <div className="auth-input">
                    <User size={17} />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>
              )}

              <label className="auth-field">
                <span>Email address / username</span>
                <div className="auth-input">
                  <Mail size={17} />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="username"
                    required
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>Password</span>
                <div className="auth-input">
                  <Lock size={17} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              {error && <div className="error-banner"><AlertTriangle size={17} />{error}</div>}

              <button className="auth-submit" type="submit" disabled={busy}>
                {busy
                  ? "Please wait..."
                  : mode === "login" ? "Sign in" : "Create account"}
                {!busy && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="auth-or"><span>OR</span></div>

            <p className="auth-switch">
              {mode === "login" ? "New to SepsisCare?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                }}
              >
                {mode === "login" ? "Register" : "Sign in"}
              </button>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Stat({ icon: Icon, label, value, detail }) {
  return (
    <article className="stat-card">
      <div className="stat-icon"><Icon size={21} /></div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </article>
  );
}

function Empty({ title, description, icon: Icon = ClipboardList }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={28} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function getResultValues(result) {
  const raw = result?.score_percent ?? result?.probability_percent ??
    result?.model_score ?? result?.score ?? result?.probability;

  let score = Number(raw);
  if (!Number.isFinite(score)) score = 0;

  if (result?.score_percent == null && result?.probability_percent == null && score >= 0 && score <= 1) {
    score *= 100;
  }
  score = Math.max(0, Math.min(100, score));

  const prediction = String(
    result?.prediction ?? result?.result ?? result?.label ?? result?.predicted_label ?? ""
  ).trim().toUpperCase();

  const isPositive = ["YES", "SEPSIS", "1", "POSITIVE", "TRUE", "HIGH"].includes(prediction);
  const isNegative = ["NO", "0", "NEGATIVE", "FALSE", "SEPSIS NOT FLAGGED", "NOT FLAGGED"].includes(prediction);

  return { score, isPositive, isNegative, prediction };
}

function ResultCard({ result }) {
  if (!result) return null;
  const { score, isPositive, isNegative } = getResultValues(result);

  return (
    <article className={`result-card result-card-prominent ${isPositive ? "result-positive" : "result-negative"}`}>
      <div className="result-card-top">
        <div className="result-model-icon">
          {isPositive ? <AlertTriangle size={24} /> : <HeartPulse size={24} />}
        </div>
        <h2 className="result-title">Prediction Result</h2>
      </div>

      <div className={`decision-banner ${isPositive ? "decision-yes" : "decision-no"}`}>
        <strong className="decision-word">
          {isPositive ? "YES — SEPSIS PREDICTED" : isNegative ? "NO — SEPSIS NOT PREDICTED" : "PREDICTION UNAVAILABLE"}
        </strong>
      </div>

      {isPositive && (
        <>
          <div className="result-score-row result-score-row-large">
            <div>
              <span className="stat-label">Prediction probability</span>
              <h2 className="result-probability">{score.toFixed(1)}%</h2>
            </div>
            <div className="score-ring score-ring-large ring-warning"><span>{Math.round(score)}%</span></div>
          </div>
          <div className="progress-track progress-track-large">
            <div className="progress-fill progress-warning" style={{ width: `${score}%` }} />
          </div>
          <p className="result-description">
            The model predicted YES for this observation. Seek prompt clinical assessment; this result is not a confirmed diagnosis.
          </p>
        </>
      )}

      {isNegative && (
        <p className="result-description">
          The model predicted NO for this observation. A NO result does not rule out sepsis or replace clinical assessment.
        </p>
      )}

      {!isPositive && !isNegative && (
        <p className="result-description">
          The server response did not contain a recognizable YES or NO result. Please check the prediction API response.
        </p>
      )}

      <p className="result-disclaimer">
        Academic research prototype only. This prediction is not clinically validated and must not be used alone for medical decisions.
      </p>
    </article>
  );
}

function PredictionResults({ data }) {
  const candidates = [data?.logistic_regression, data?.random_forest]
    .filter((value) => value && typeof value === "object");

  if (candidates.length) {
    return <div className="results-grid results-grid-prominent">
      {candidates.map((value, index) => <ResultCard key={index} result={value} />)}
    </div>;
  }

  if (data?.results && typeof data.results === "object") {
    const nested = [data.results.logistic_regression, data.results.random_forest]
      .filter((value) => value && typeof value === "object");
    if (nested.length) {
      return <div className="results-grid results-grid-prominent">
        {nested.map((value, index) => <ResultCard key={index} result={value} />)}
      </div>;
    }
  }

  return <div className="results-grid results-grid-prominent"><ResultCard result={data} /></div>;
}

function HistoryTable({ items }) {
  function getPrediction(item) {
    return String(item.prediction ?? item.result ?? item.label ?? item.predicted_label ?? "—").toUpperCase();
  }

  function getScore(item) {
    const prediction = getPrediction(item);
    if (!["YES", "SEPSIS", "1", "POSITIVE", "TRUE", "HIGH"].includes(prediction)) return "—";

    const raw = item.score_percent ?? item.probability_percent ?? item.score ?? item.probability;
    if (raw === null || raw === undefined || raw === "") return "—";

    let value = Number(raw);
    if (!Number.isFinite(value)) return "—";

    if (item.score_percent == null && item.probability_percent == null && value >= 0 && value <= 1) value *= 100;
    return `${value.toFixed(1)}%`;
  }

  function getDate(item) {
    const raw = item.created_at ?? item.timestamp ?? item.date;
    if (!raw) return "—";
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString();
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Prediction</th><th>Probability</th><th>Date</th></tr></thead>
        <tbody>
          {items.map((item, index) => {
            const prediction = getPrediction(item);
            const positive = ["YES", "SEPSIS", "1", "POSITIVE", "TRUE", "HIGH"].includes(prediction);
            return (
              <tr key={item.id ?? index}>
                <td><span className={`table-status ${positive ? "status-warning" : "status-safe"}`}>{prediction}</span></td>
                <td>{getScore(item)}</td>
                <td>{getDate(item)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(getUser);
  const [page, setPage] = useState("Dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({});
  const [readings, setReadings] = useState([emptyReading()]);
  const [model, setModel] = useState("both");
  const [result, setResult] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedReading, setSelectedReading] = useState(0);
  const [uploadedFilename, setUploadedFilename] = useState("");
  const [reviewReady, setReviewReady] = useState(false);

  async function loadData() {
    try {
      const [historyData, summaryData] = await Promise.all([
        api("/api/history"),
        api("/api/dashboard/summary"),
      ]);
      setHistory(Array.isArray(historyData) ? historyData : historyData.items || []);
      setSummary(summaryData || {});
    } catch (err) {
      setError(err.message || "Could not load dashboard data.");
    }
  }

  useEffect(() => {
    let active = true;

    async function verifySession() {
      if (!token) {
        setAuthChecked(true);
        return;
      }

      try {
        const data = await api("/api/auth/me", {}, token);
        if (!active) return;
        const verifiedUser = data.user || data;
        setUser(verifiedUser);
        sessionStorage.setItem("sepsiscare_user", JSON.stringify(verifiedUser));
        await loadData();
      } catch {
        if (!active) return;
        sessionStorage.removeItem("sepsiscare_token");
        sessionStorage.removeItem("sepsiscare_user");
        setToken("");
        setUser(null);
      } finally {
        if (active) setAuthChecked(true);
      }
    }

    verifySession();
    return () => { active = false; };
  }, [token]);

  function handleLogin(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
    setPage("Dashboard");
    setError("");
  }

  function logout() {
    sessionStorage.removeItem("sepsiscare_token");
    sessionStorage.removeItem("sepsiscare_user");
    setToken("");
    setUser(null);
    setHistory([]);
    setSummary({});
    setResult(null);
    setPage("Dashboard");
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setMobileMenu(false);
    setError("");
  }

  function updateReading(index, key, value) {
    setReadings((previous) => previous.map((reading, i) =>
      i === index ? { ...reading, [key]: value } : reading
    ));
  }

  function validateReading(reading) {
    const cleaned = {};

    for (const [key, label, unit, min, max] of VITALS) {
      const raw = reading[key];
      if (raw === "" || raw === null || raw === undefined) {
        cleaned[key] = null;
        continue;
      }

      const number = Number(raw);
      if (!Number.isFinite(number)) throw new Error(`${label}: valid number enter pannu.`);
      if (number < min || number > max) throw new Error(`${label} value ${min}–${max} ${unit} range-kulla irukkanum.`);
      cleaned[key] = number;
    }

    if (!Object.values(cleaned).some((value) => value !== null)) {
      throw new Error("Vital signs kidaikkala. Report values review pannunga.");
    }
    return cleaned;
  }

  async function runPrediction(reading, source = "manual") {
    const cleaned = validateReading(reading);
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const data = await api("/api/predict", {
        method: "POST",
        body: JSON.stringify({ readings: [cleaned], model }),
      });
      setResult(data);
      setUploadMessage(source === "report" ? "Report prediction completed." : "");
      await loadData();
      setPage(source === "report" ? "Report Upload" : "Vital Signs");
    } catch (err) {
      setError(err.message || "Prediction failed. Check the backend and model files.");
    } finally {
      setBusy(false);
    }
  }

  async function predict(event) {
    event.preventDefault();
    try {
      await runPrediction(readings[0], "manual");
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadReport(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("report");
    const file = fileInput?.files?.[0];

    if (!file) {
      setError("First PDF, CSV, or TXT report select pannu.");
      return;
    }

    const extension = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "csv", "txt"].includes(extension)) {
      setError("PDF, CSV, TXT files mattum upload pannalaam.");
      return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError("File empty-ah irukka koodadhu; 5 MB-kku keela irukkanum.");
      return;
    }

    setBusy(true);
    setError("");
    setUploadMessage("");
    setReviewReady(false);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await api("/api/reports/extract", { method: "POST", body: formData });
      const extracted = Array.isArray(data.readings) ? data.readings : [];

      if (!extracted.length) throw new Error("Report-la vital signs extract aagala. File format check pannunga.");

      const normalized = extracted.map((item) => {
        const reading = emptyReading();
        for (const [key] of VITALS) {
          if (item[key] !== null && item[key] !== undefined && item[key] !== "") reading[key] = String(item[key]);
        }
        return reading;
      });

      setReadings(normalized);
      setSelectedReading(0);
      setUploadedFilename(data.filename || file.name);
      setUploadMessage(`${normalized.length} reading(s) extracted. Values review pannitu analyze pannunga.`);
      setReviewReady(true);
    } catch (err) {
      setError(err.message || "Report extraction failed.");
    } finally {
      setBusy(false);
      if (fileInput) fileInput.value = "";
    }
  }

  async function analyzeUploadedReading() {
    try {
      await runPrediction(readings[selectedReading], "report");
    } catch (err) {
      setError(err.message || "Please review the extracted values.");
    }
  }

  if (!authChecked) {
    return <main className="loading-screen"><div className="loading-mark"><HeartPulse size={32} /></div><p>Loading SepsisCare...</p></main>;
  }

  if (!token) return <Auth onLogin={handleLogin} />;

  const totalPredictions = summary.total_predictions ?? summary.total ?? history.length;
  const highRiskCount = history.filter((item) =>
    ["YES", "SEPSIS", "1", "POSITIVE", "TRUE", "HIGH"].includes(
      String(item.label ?? item.prediction ?? item.result ?? "").toUpperCase()
    )
  ).length;
  const activeReading = readings[selectedReading] || emptyReading();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={20} /></button>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="side-nav">
          {NAV.map(([label, Icon]) => (
            <button key={label} className={`nav-item ${page === label ? "nav-active" : ""}`} onClick={() => navigate(label)}>
              <Icon size={19} /><span>{label}</span>{page === label && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar"><User size={18} /></div>
            <div className="user-details"><strong>{user?.name || user?.username || "User"}</strong><span>{user?.email || "Signed in"}</span></div>
          </div>
          <button className="nav-item logout-button" onClick={logout}><LogOut size={19} /><span>Sign out</span></button>
          <div className="sidebar-disclaimer"><ShieldCheck size={17} /><span>Research prototype only</span></div>
        </div>
      </aside>

      {mobileMenu && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="breadcrumb"><span>SepsisCare</span><ChevronRight size={15} /><strong>{page}</strong></div>
          <div className="topbar-right"><span className="system-status"><span className="status-dot" />ML workspace</span><div className="topbar-avatar">{(user?.name || user?.username || "U").charAt(0).toUpperCase()}</div></div>
        </header>

        <div className="page-content">
          {error && <div className="error-banner page-alert"><AlertTriangle size={18} /><span>{error}</span><button className="icon-button" onClick={() => setError("")} aria-label="Dismiss error"><X size={17} /></button></div>}

          {page === "Dashboard" && (
            <>
              <PageHeading eyebrow="OVERVIEW" title={`Welcome${user?.name ? `, ${user.name}` : ""}`} description="Review prediction activity and analyze patient vital signs." action={<Button onClick={() => navigate("Report Upload")}><Upload size={17} />Upload report</Button>} />
              <section className="stats-grid">
                <Stat icon={Activity} label="Total predictions" value={totalPredictions} detail="Recorded analyses" />
                <Stat icon={AlertTriangle} label="Model-positive records" value={highRiskCount} detail="Requires clinical review" />
                <Stat icon={FileText} label="History records" value={history.length} detail="Saved prediction outputs" />
              </section>

              <section className="panel dashboard-hero">
                <div className="hero-copy">
                  <span className="eyebrow">REPORT-BASED WORKFLOW</span>
                  <h2>One report. Review. Predict.</h2>
                  <p>Upload a PDF, CSV, or TXT report. Review the extracted vital signs, then run the model.</p>
                  <Button onClick={() => navigate("Report Upload")}>Start analysis <ArrowRight size={17} /></Button>
                </div>
                <div className="hero-visual">
                  <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
                  <div className="hero-heart"><HeartPulse size={54} /></div>
                  <span className="floating-chip chip-one"><Activity size={15} />Vital signs</span>
                  <span className="floating-chip chip-two"><ShieldCheck size={15} />ML support</span>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading"><div><h2>Recent predictions</h2><p>Your latest saved prediction records</p></div><Button variant="secondary" onClick={() => navigate("History")}>View history <ArrowRight size={16} /></Button></div>
                {history.length === 0 ? <Empty title="No predictions yet" description="Upload a report to start an analysis." /> : <HistoryTable items={history.slice(0, 5)} />}
              </section>
            </>
          )}

          {page === "Vital Signs" && (
            <>
              <PageHeading eyebrow="MODEL ANALYSIS" title="Vital signs" description="Enter one observation or use the report upload workflow." action={<Button variant="secondary" onClick={() => navigate("Report Upload")}><Upload size={17} />Upload report instead</Button>} />
              <section className="panel">
                <div className="panel-heading"><div><h2>Observation details</h2><p>Enter available values. Missing values may be imputed by the model pipeline.</p></div></div>
                <form onSubmit={predict}>
                  <div className="vitals-grid">
                    {VITALS.map(([key, label, unit, min, max]) => (
                      <label className="vital-field" key={key}>
                        <span>{label}</span>
                        <div className="vital-input-wrap">
                          <input type="number" step="any" min={min} max={max} value={readings[0]?.[key] ?? ""} onChange={(e) => updateReading(0, key, e.target.value)} placeholder="Not available" />
                          <span>{unit}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="form-actions">
                    <Button type="submit" disabled={busy}>{busy ? "Analyzing..." : "Run prediction"}<ArrowRight size={17} /></Button>
                    <Button variant="secondary" onClick={() => { setReadings([emptyReading()]); setResult(null); setError(""); }}>Clear values</Button>
                  </div>
                </form>
              </section>
              {result && page === "Vital Signs" && <section className="results-section"><PageHeading eyebrow="ANALYSIS OUTPUT" title="Prediction result" description="Result for the submitted observation." /><PredictionResults data={result} /></section>}
            </>
          )}

          {page === "Report Upload" && (
            <>
              <PageHeading eyebrow="AUTOMATED EXTRACTION" title="Upload patient report" description="Upload one report, review extracted vital signs, and run the prediction." />
              <section className="panel upload-panel">
                <div className="upload-intro"><div className="upload-icon-large"><FileUp size={30} /></div><div><h2>Import a report</h2><p>Supported formats: PDF, CSV, and TXT. Maximum 5 MB.</p></div></div>
                <form onSubmit={uploadReport} className="upload-form">
                  <label className="upload-dropzone">
                    <input type="file" name="report" accept=".pdf,.csv,.txt" disabled={busy} />
                    <div className="upload-dropzone-icon"><Upload size={26} /></div>
                    <strong>Choose a report from your computer</strong><span>PDF, CSV, or TXT · Up to 5 MB</span>
                  </label>
                  <div className="form-actions"><Button type="submit" disabled={busy}>{busy ? <><RefreshCw size={17} className="spin" />Extracting...</> : <>Extract vital signs<ArrowRight size={17} /></>}</Button></div>
                </form>
                {uploadMessage && <div className="success-banner"><CheckCircle size={18} /><span>{uploadMessage}</span></div>}
                {uploadedFilename && reviewReady && <div className="uploaded-file"><FileText size={19} /><div><strong>{uploadedFilename}</strong><span>Extraction complete · Review required</span></div></div>}
              </section>

              {reviewReady && (
                <section className="panel review-panel">
                  <div className="panel-heading"><div><span className="eyebrow">STEP 2</span><h2>Review extracted vital signs</h2><p>Verify the values and units against the original report.</p></div><span className="review-count">{readings.length} reading(s)</span></div>
                  {readings.length > 1 && <label className="model-select-label">Select a reading<select value={selectedReading} onChange={(e) => setSelectedReading(Number(e.target.value))}>{readings.map((_, index) => <option key={index} value={index}>Reading {index + 1}</option>)}</select></label>}
                  <div className="review-notice"><AlertTriangle size={18} /><span>Blank fields mean a value was not extracted. Verify the original report before continuing.</span></div>
                  <div className="vitals-grid">
                    {VITALS.map(([key, label, unit, min, max]) => (
                      <label className="vital-field" key={key}>
                        <span>{label}</span>
                        <div className="vital-input-wrap"><input type="number" step="any" min={min} max={max} value={activeReading[key] ?? ""} onChange={(e) => updateReading(selectedReading, key, e.target.value)} placeholder="Not found in report" /><span>{unit}</span></div>
                      </label>
                    ))}
                  </div>
                  <div className="form-actions">
                    <Button onClick={analyzeUploadedReading} disabled={busy}>{busy ? "Analyzing..." : "Analyze report"}<ArrowRight size={17} /></Button>
                    <Button variant="secondary" onClick={() => { setReviewReady(false); setUploadedFilename(""); setUploadMessage(""); setResult(null); setReadings([emptyReading()]); }}>Clear report</Button>
                  </div>
                </section>
              )}
              {result && page === "Report Upload" && <section className="results-section"><PageHeading eyebrow="ANALYSIS OUTPUT" title="Report prediction" description="Result for the reviewed observation." /><PredictionResults data={result} /></section>}
            </>
          )}

          {page === "History" && (
            <>
              <PageHeading eyebrow="RECORDS" title="Prediction history" description="Review saved prediction outputs." action={<Button variant="secondary" onClick={loadData}><RefreshCw size={16} />Refresh</Button>} />
              <section className="panel"><div className="panel-heading"><div><h2>All predictions</h2><p>{history.length} record(s)</p></div></div>{history.length === 0 ? <Empty title="Your history is empty" description="Saved prediction records will appear here." /> : <HistoryTable items={history} />}</section>
            </>
          )}

          {page === "Prevention" && (
            <>
              <PageHeading eyebrow="HEALTH EDUCATION" title="Sepsis awareness and prevention" description="General infection-prevention guidance. This page cannot assess an individual's condition." />
              <section className="prevention-grid">
                {[
                  { icon: ShieldCheck, title: "Prevent infections", text: "Follow recommended vaccination guidance, practice good hygiene, and care for wounds properly." },
                  { icon: Droplets, title: "Clean your hands", text: "Wash hands regularly, particularly before eating, after using the toilet, and when caring for someone ill." },
                  { icon: Activity, title: "Care for wounds", text: "Keep cuts clean, monitor for infection, and seek professional advice when needed." },
                  { icon: HeartPulse, title: "Seek timely care", text: "Get medical advice for suspected infection, especially when symptoms worsen." },
                  { icon: Thermometer, title: "Watch warning signs", text: "Confusion, difficulty breathing, clammy skin, severe discomfort, or rapid deterioration can require emergency care." },
                  { icon: BookOpen, title: "Follow medical advice", text: "Use prescribed medicines as directed and follow your healthcare professional's instructions." },
                ].map(({ icon: Icon, title, text }) => <article className="prevention-card" key={title}><div className="prevention-icon"><Icon size={23} /></div><h3>{title}</h3><p>{text}</p></article>)}
              </section>
              <div className="warning-panel"><AlertTriangle size={22} /><div><strong>When to seek emergency care</strong><p>Suspected infection with confusion, severe breathing difficulty, collapse, or rapid deterioration needs urgent medical evaluation. Do not wait for this application's prediction.</p></div></div>
            </>
          )}

          <footer className="app-footer"><span>SepsisCare · Academic ML prototype</span><span><ShieldCheck size={14} /> Not for standalone clinical decisions</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
