"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, AuthError } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Image from "next/image";

// for login error
interface LoginError extends Error {
  code?: string;
  message: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, "admin", user.uid));

      if (snap.exists() && snap.data()?.role === "admin") {
        router.push("/admin");
      } else {
        setError("Access denied: Admin rights required");
      }
    } catch (error: unknown) {
      const err = error as AuthError | LoginError;
      console.error("Login error:", err);
      setError(err.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-50">
      <div className="max-w-md w-full mx-4">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <Image
            src="/adu-logo.png"
            alt="ADU Logo"
            width={400}
            height={300}
            className="mx-auto mb-4"
          />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-600">Sign in to access the admin dashboard</p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleLogin}
          className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] space-y-6"
        >
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-black w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-black rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {/* Forgot Password */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => setIsResetOpen(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Forgot password?
            </button>
          </div>
          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 "
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Password Reset Modal */}
        {isResetOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl text-black font-semibold mb-4">
                Password Reset
              </h3>
              <div className="space-y-4">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg">
                  <p className="font-medium">
                    To change password, Kindly visit the ITC office.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetOpen(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-600">
          AQMS Admin Dashboard
        </p>
      </div>
    </div>
  );
}
