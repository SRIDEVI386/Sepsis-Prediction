
import { useState } from "react";
import "./ReportUpload.css";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8001"
).replace(/\/$/, "");

const EXTRACT_URL = `${API_BASE}/api/reports/extract`;
const PREDICT_URL = `${API_BASE}/api/predict`;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const VITALS = [
  { key: "HR", name: "Heart rate", unit: "bpm" },
  { key: "O2Sat", name: "Oxygen saturation", unit: "%" },
  { key: "Temp", name: "Temperature", unit: "°C" },
  { key: "SBP", name: "Systolic blood pressure", unit: "mmHg" },
  { key: "MAP", name: "Mean arterial pressure", unit: "mmHg" },
  { key: "DBP", name: "Diastolic blood pressure", unit: "mmHg" },
  { key: "Resp", name: "Respiratory rate", unit: "/min" },
  { key: "EtCO2", name: "End-tidal CO₂", unit: "mmHg" },
];

const ALLOWED_EXTENSIONS = [".pdf", ".csv", ".txt"];

const EMPTY_READING = () =>
  Object.fromEntries(VITALS.map(({ key }) => [key, ""]));

function getToken() {
  return (
    sessionStorage.getItem("sepsiscare_token") ||
    localStorage.getItem("sepsiscare_token") ||
    ""
  );
}

async function apiRequest(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Login session expired. Sign in again and upload the report."
      );
    }

    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "The request failed. Check the backend terminal."
    );
  }

  return data;
}

function normalizeReading(raw) {
  const result = EMPTY_READING();

  for (const { key } of VITALS) {
    const value = raw?.[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      Number.isFinite(Number(value))
    ) {
      result[key] = String(value);
    }
  }

  return result;
}

function validateReading(reading) {
  const limits = {
    HR: [0, 300],
    O2Sat: [0, 100],
    Temp: [25, 45],
    SBP: [0, 350],
    MAP: [0, 250],
    DBP: [0, 250],
    Resp: [0, 100],
    EtCO2: [0, 150],
  };

  const output = {};

  for (const { key, name } of VITALS) {
    const raw = reading[key];

    if (raw === "" || raw === null || raw === undefined) {
      output[key] = null;
      continue;
    }

    const value = Number(raw);
    const [minimum, maximum] = limits[key];

    if (!Number.isFinite(value) || value <= minimum || value > maximum) {
      throw new Error(
        `${name}: enter a valid value greater than ${minimum} and at most ${maximum}.`
      );
    }

    output[key] = value;
  }

  if (Object.values(output).every((value) => value === null)) {
    throw new Error(
      "No vital-sign values are available. Upload a readable report or enter verified values."
    );
  }

  return output;
}

export default function ReportUpload() {
  const [file, setFile] = useState(null);
  const [reading, setReading] = useState(EMPTY_READING);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState(null);

  function handleFileChange(event) {
    const selected = event.target.files?.[0] || null;

    setFile(null);
    setReading(EMPTY_READING());
    setHasExtracted(false);
    setResult(null);
    setMessage("");
    setError("");

    if (!selected) return;

    const filename = selected.name.toLowerCase();
    const validExtension = ALLOWED_EXTENSIONS.some((extension) =>
      filename.endsWith(extension)
    );

    if (!validExtension) {
      setError("Upload a PDF, CSV, or TXT file.");
      event.target.value = "";
      return;
    }

    if (selected.size === 0 || selected.size > MAX_FILE_SIZE) {
      setError("Choose a non-empty file that is 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setFile(selected);
  }

  async function handleExtract(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setResult(null);

    if (!file) {
      setError("Choose a PDF, CSV, or TXT report first.");
      return;
    }

    setExtracting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await apiRequest(EXTRACT_URL, {
        method: "POST",
        body: formData,
      });

      const extracted = Array.isArray(data.readings)
        ? data.readings[0]
        : null;

      if (!extracted || Object.keys(extracted).length === 0) {
        throw new Error(
          "No vital signs were extracted. Check the report format and try again."
        );
      }

      setReading(normalizeReading(extracted));
      setHasExtracted(true);

      const foundCount = VITALS.filter(
        ({ key }) =>
          extracted[key] !== null &&
          extracted[key] !== undefined &&
          extracted[key] !== ""
      ).length;

      setMessage(
        `${data.filename || file.name}: ${foundCount} vital-sign value(s) extracted. Review the values below before analysis.`
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not extract the report. Confirm that the backend is running on port 8001."
      );
    } finally {
      setExtracting(false);
    }
  }

  function updateVital(key, value) {
    setReading((current) => ({
      ...current,
      [key]: value,
    }));

    setResult(null);
    setError("");
  }

  async function handleAnalyse() {
    setError("");
    setMessage("");
    setResult(null);

    let verifiedReading;

    try {
      verifiedReading = validateReading(reading);
    } catch (err) {
      setError(err.message);
      return;
    }

    setAnalysing(true);

    try {
      const data = await apiRequest(PREDICT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          readings: [verifiedReading],
        }),
      });

      if (!["YES", "NO"].includes(data.prediction)) {
        throw new Error(
          "The backend returned an unexpected result. Check the API response."
        );
      }

      const score = Number(data.risk_score ?? data.score_percent);

      if (!Number.isFinite(score) || score < 0 || score > 100) {
        throw new Error(
          "The model did not return a valid risk score."
        );
      }

      setResult({
        prediction: data.prediction,
        score,
        modelsUsed: data.models_used ?? 1,
        notice:
          data.notice ||
          "Research prototype only. This is not a clinical diagnosis.",
      });

      setMessage("Analysis completed and the result was saved to history.");
    } catch (err) {
      setError(
        err.message ||
          "Prediction failed. Check the backend terminal and trained models."
      );
    } finally {
      setAnalysing(false);
    }
  }

  function clearReport() {
    setFile(null);
    setReading(EMPTY_READING());
    setHasExtracted(false);
    setResult(null);
    setMessage("");
    setError("");

    const input = document.getElementById("clinical-report");

    if (input) input.value = "";
  }

  return (
    <section className="report-page">
      <div className="report-heading">
        <p className="report-eyebrow">SEPSISCARE · DOCUMENT ANALYSIS</p>
        <h1>Report Upload</h1>
        <p>
          Upload a report, review the extracted vital signs, and run one
          combined research-model prediction.
        </p>
      </div>

      <div className="report-panel">
        <h2>1. Upload a clinical report</h2>

        <p className="report-muted">
          Supported formats: PDF, CSV and TXT. Maximum file size: 5 MB.
          Scanned PDFs may not be readable.
        </p>

        <form onSubmit={handleExtract}>
          <label className="report-file-label" htmlFor="clinical-report">
            Choose report
          </label>

          <input
            id="clinical-report"
            className="report-file-input"
            type="file"
            accept=".pdf,.csv,.txt,application/pdf,text/plain,text/csv"
            onChange={handleFileChange}
            disabled={extracting || analysing}
          />

          {file && (
            <p className="report-muted">
              Selected: {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          )}

          <button
            className="report-primary"
            disabled={extracting || analysing || !file}
            type="submit"
          >
            {extracting ? "Extracting report..." : "Extract vital signs"}
          </button>
        </form>

        {error && (
          <p className="report-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="report-message" role="status">
            {message}
          </p>
        )}
      </div>

      {hasExtracted && (
        <div className="report-panel">
          <h2>2. Review vital signs</h2>

          <p className="report-warning">
            Verify every value against the original report. Blank fields
            remain missing; they are not treated as normal values.
          </p>

          <div className="report-vitals-grid">
            {VITALS.map(({ key, name, unit }) => (
              <label className="report-vital-field" key={key}>
                <span>{name}</span>

                <div className="report-vital-input-wrap">
                  <input
                    className="report-value-input"
                    type="number"
                    step="any"
                    value={reading[key]}
                    onChange={(event) =>
                      updateVital(key, event.target.value)
                    }
                    placeholder="Not found"
                    disabled={analysing}
                  />

                  <small>{unit}</small>
                </div>
              </label>
            ))}
          </div>

          <div className="report-actions">
            <button
              className="report-primary"
              type="button"
              onClick={handleAnalyse}
              disabled={analysing || extracting}
            >
              {analysing ? "Analysing..." : "Analyze Report"}
            </button>

            <button
              className="report-secondary"
              type="button"
              onClick={clearReport}
              disabled={analysing || extracting}
            >
              Clear report
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="report-panel report-result" aria-live="polite">
          <p className="report-eyebrow">MODEL OUTPUT</p>
          <h2>Sepsis Risk Assessment</h2>

          <div className="report-result-card">
            <span className="report-muted">Prediction</span>

            <h3
              className={
                result.prediction === "YES"
                  ? "report-prediction-yes"
                  : "report-prediction-no"
              }
            >
              {result.prediction}
            </h3>

            <span className="report-muted">Estimated model risk score</span>

            <div className="report-score">
              {result.score.toFixed(2)}%
            </div>

            <div
              className="report-score-track"
              role="progressbar"
              aria-label="Estimated model risk score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={result.score}
            >
              <div
                className="report-score-fill"
                style={{ width: `${result.score}%` }}
              />
            </div>

            <p className="report-muted">
              Combined result from {result.modelsUsed} available model(s).
            </p>
          </div>

          <p className="report-warning">{result.notice}</p>
        </div>
      )}

      <p className="report-disclaimer">
        Academic research prototype only. This estimated model score is
        not a validated clinical risk or severity percentage. Do not use
        it to diagnose sepsis or make treatment decisions.
      </p>
    </section>
  );
}
