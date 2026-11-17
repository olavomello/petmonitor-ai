import { useEffect, useState } from "react";
import { api } from "../api";

type AuthStep = "idle" | "loading" | "2fa" | "done" | "error";

export default function SettingsView() {
  const [blinkStatus, setBlinkStatus] = useState<string>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<AuthStep>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.blinkStatus()
      .then((s) => setBlinkStatus(s.status))
      .catch(() => setBlinkStatus("unknown"));
  }, []);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setStep("loading");
    setMessage("");
    try {
      const res = await api.blinkAuthStart(email, password);
      if (res.status === "authenticated") {
        setStep("done");
        setMessage("Blink authenticated successfully.");
        setBlinkStatus("configured");
        setEmail("");
        setPassword("");
      } else if (res.status === "2fa_required") {
        setStep("2fa");
        setMessage("A verification code was sent to your registered device.");
      } else {
        setStep("error");
        setMessage("Unexpected response from server.");
      }
    } catch (err) {
      setStep("error");
      setMessage(String(err));
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setStep("loading");
    setMessage("");
    try {
      const res = await api.blinkAuthVerify(code);
      if (res.status === "authenticated") {
        setStep("done");
        setMessage("Blink authenticated successfully.");
        setBlinkStatus("configured");
        setCode("");
      } else {
        setStep("error");
        setMessage("Verification failed. Try again.");
      }
    } catch (err) {
      setStep("error");
      setMessage(String(err));
    }
  }

  const isConfigured = blinkStatus === "configured";
  const isLoading = step === "loading";
  const isError = step === "error";

  return (
    <div>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Settings</h1>
      </div>

      {/* Blink Camera */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1.25rem",
        marginBottom: "1rem",
        maxWidth: 480,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="4" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 7.5l4-2.5v6L11 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Blink Camera</span>
          <span style={{
            fontSize: "0.62rem", padding: "0.12rem 0.45rem", borderRadius: 999, fontWeight: 600,
            background: isConfigured ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: isConfigured ? "#86efac" : "#fca5a5",
          }}>
            {blinkStatus === "loading" ? "…" : isConfigured ? "Configured" : "Not configured"}
          </span>
        </div>

        {step === "done" ? (
          <p style={{ color: "#86efac", fontSize: "0.86rem" }}>{message}</p>
        ) : step !== "2fa" ? (
          <form onSubmit={handleStart}>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Blink account email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "0.5rem 0.7rem",
                  color: "var(--text-primary)", fontSize: "0.86rem",
                }}
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "0.5rem 0.7rem",
                  color: "var(--text-primary)", fontSize: "0.86rem",
                }}
              />
            </div>
            {isError && (
              <p style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.75rem" }}>{message}</p>
            )}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                background: "var(--teal)", color: "#0a1628", border: "none",
                borderRadius: "var(--radius-sm)", padding: "0.5rem 1.1rem",
                fontWeight: 700, fontSize: "0.84rem", cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? "Connecting…" : isConfigured ? "Re-authenticate" : "Authenticate"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              {message}
            </p>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Verification code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="000000"
                maxLength={8}
                autoFocus
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "0.5rem 0.7rem",
                  color: "var(--text-primary)", fontSize: "1rem", letterSpacing: "0.15em",
                }}
              />
            </div>
            {isError && (
              <p style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.75rem" }}>{message}</p>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  background: "var(--teal)", color: "#0a1628", border: "none",
                  borderRadius: "var(--radius-sm)", padding: "0.5rem 1.1rem",
                  fontWeight: 700, fontSize: "0.84rem", cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? "Verifying…" : "Verify code"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("idle"); setCode(""); setMessage(""); }}
                style={{
                  background: "transparent", color: "var(--text-secondary)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  padding: "0.5rem 1rem", fontSize: "0.84rem", cursor: "pointer",
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
