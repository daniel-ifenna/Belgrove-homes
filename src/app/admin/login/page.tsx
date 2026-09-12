"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/admin/bookings");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F7F2E7]">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap"
        rel="stylesheet"
      />
      <style>{`.fraunces{font-family:Fraunces,serif} .mono{font-family:IBM Plex Mono,monospace} .public{font-family:Public Sans,sans-serif}`}</style>

      <div className="grid lg:grid-cols-[0.92fr_1.08fr] min-h-screen">
        {/* Left */}
        <div className="relative min-h-[420px] lg:min-h-full overflow-hidden bg-[#0F1A12]">
          <img
            src="/admin-login-house.jpg"
            alt="Belgrove modern house"
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{ objectPosition: "center" }}
            loading="eager"
            decoding="async"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(180deg, rgba(15,26,18,0.16) 0%, rgba(15,26,18,0.14) 45%, rgba(15,26,18,0.68) 100%)",
            }}
          />
          <div className="absolute left-6 right-6 bottom-6 lg:left-8 lg:right-8 lg:bottom-8">
            <div className="inline-flex mono text-[10px] tracking-[0.16em] uppercase bg-[#C79A46] text-[#1F3328] px-2.5 py-1 rounded-[2px] font-medium">
              Admin Access
            </div>
            <h1
              className="fraunces text-white leading-[0.94] mt-3"
              style={{ fontSize: "clamp(28px, 3vw, 34px)", textShadow: "0 2px 18px rgba(0,0,0,0.45)" }}
            >
              Belgrove <span className="text-[#C79A46]">Homes</span>
              <br />
              Admin Portal
            </h1>
            <p
              className="public text-white/90 text-[13px] leading-[1.6] mt-3 max-w-[36ch]"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
            >
              Secure access for the Belgrove team to manage inspections, agents and bookings in one place.
            </p>
            <div className="flex items-center gap-2 mt-4 mono text-[11px] text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C79A46]" /> Secure and Verified Access
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="bg-[#F7F2E7] flex flex-col justify-center px-6 lg:px-12 py-10 lg:py-12">
          <div className="max-w-[520px] w-full mx-auto">
            <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Admin Sign In</span>
            <h2 className="fraunces text-[28px] leading-[1.05] text-[#1F3328] mt-2">Welcome back</h2>
            <p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-3">
              Sign in with your admin email and password to continue to the dashboard.
            </p>
            <div className="mt-8">
              <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-8 space-y-5">
                <div>
                  <label className="block text-sm text-stone-600 mb-1" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-stone-600 mb-1" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-stone-300 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-stone-500 hover:text-stone-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-stone-800 text-white rounded py-3 text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>
            <p className="mono text-[10px] tracking-[0.06em] text-[#8B5E3C] mt-6 text-center">Secure access for authorized staff only</p>
          </div>
        </div>
      </div>
    </div>
  );
}
