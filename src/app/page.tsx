"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (sessionStorage.getItem("isAuthenticated") || localStorage.getItem("isAuthenticated"))) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, isLogin: isLoginMode }),
      });

      const data = await response.json();

      if (data.success) {
        if (rememberMe && isLoginMode) {
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("userEmail", email);
          localStorage.setItem("uid", data.uid);
        } else {
          sessionStorage.setItem("isAuthenticated", "true");
          sessionStorage.setItem("userEmail", email);
          sessionStorage.setItem("uid", data.uid);
        }
        router.push("/dashboard");
      } else {
        alert("Error: " + data.message);
      }
    } catch (error: any) {
      alert("Network Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

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
                placeholder="Enter your password"
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
                <label htmlFor="rememberMe" style={{ marginBottom: "0", fontSize: "0.9rem", cursor: "pointer" }}>Remember me</label>
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
