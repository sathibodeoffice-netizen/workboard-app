"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);

  // Server-side session আছে কিনা check করি
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("wb_token");
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        // Mobile Capacitor: Bearer token header দিয়ে auth check
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/auth/check', {
          cache: 'no-store',
          headers,
        });

        if (res.ok) {
          router.replace("/dashboard");
        } else {
          // Token invalid হলে clear করি
          localStorage.removeItem("wb_token");
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, isLogin: isLoginMode, rememberMe }),
      });

      const data = await response.json();

      if (data.success) {
        // uid ও token localStorage-এ রাখি
        // token: Capacitor mobile Bearer auth এর জন্য
        // uid: dashboard এ সহজ access এর জন্য
        localStorage.setItem("uid", data.uid);
        localStorage.setItem("userEmail", email);
        if (data.token) {
          localStorage.setItem("wb_token", data.token);
        }
        router.push("/dashboard");
      } else {
        alert("Error: " + data.message);
        setIsLoading(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Network error";
      alert("Network Error: " + message);
      setIsLoading(false);
    }
  };

  // Auth check চলাকালীন loading দেখাই
  if (isLoading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div className="background-animation"></div>
        <div style={{ color: "var(--text-primary)", fontSize: "1.2rem", opacity: 0.7 }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="background-animation"></div>
      <div className="glass-container">
        <div className="logo-wrapper">
          <img src="/logo.png" alt="Work Board Logo" className="home-logo" />
          <h1>Work Board</h1>
        </div>
        <h2 className="hero-text">Manage your tasks efficiently.</h2>
        <p className="sub-text">
          Organize your personal life and collaborate seamlessly with your department, all in one beautiful workspace.
        </p>
        <button id="btnLoginSignup" className="btn-get-started" onClick={() => setIsModalOpen(true)}>
          Login / Sign Up
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>

      {/* Login/Sign Up Modal */}
      <div id="authModal" className={`modal ${isModalOpen ? "" : "hidden"}`}>
        <div className="modal-content">
          <button id="closeAuthModal" className="btn-close" onClick={() => setIsModalOpen(false)}>
            &times;
          </button>
          <h2 id="authTitle">{isLoginMode ? "Login to Work Board" : "Create an Account"}</h2>
          <form id="authForm" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                required
                minLength={6}
                placeholder="Enter your password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {isLoginMode && (
              <div className="input-group" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem", marginTop: "-0.5rem" }}>
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: "auto" }}
                />
                <label htmlFor="rememberMe" style={{ marginBottom: "0", fontSize: "0.9rem", cursor: "pointer" }}>Remember me (7 days)</label>
              </div>
            )}
            <button type="submit" className="btn-get-started btn-full" disabled={isLoading}>
              {isLoading ? "Please wait..." : "Continue"}
            </button>
          </form>
          <p className="auth-switch">
            <span id="authSwitchText">
              {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            </span>
            <span
              id="toggleAuthMode"
              className="auth-link"
              onClick={() => setIsLoginMode(!isLoginMode)}
            >
              {isLoginMode ? "Sign Up" : "Login"}
            </span>
          </p>
        </div>
      </div>
    </>
  );
}
