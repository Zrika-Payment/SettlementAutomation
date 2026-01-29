import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
// Schema remains the same
const authSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [serverMsg, setServerMsg] = useState({ text: "", type: "" });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(authSchema),
  });

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setServerMsg({ text: "", type: "" });
    reset();
  };

  const onSubmit = async (data) => {
    const endpoint = isLogin ? '/api/login' : '/api/signup';
    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (response.ok) {
        // 3. If login is successful, redirect to the component
        if (isLogin) {
          setServerMsg({ text: "Success! Redirecting...", type: "success" });
          setTimeout(() => {
            navigate("/process-settlement"); // Matches your router path
          }, 1500);
        } else {
          // If signup is successful, switch to login mode
          setServerMsg({ text: "Account created! Please login.", type: "success" });
          setIsLogin(true);
          reset();
        }
      } else {
        setServerMsg({ text: result.message, type: "error" });
      }

      //setServerMsg({ text: result.message, type: response.ok ? "success" : "error" });
    } catch (err) {
      setServerMsg({ text: "Connection error", type: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-gray-500 mt-2">
            {isLogin ? "Please enter your details" : "Join our community today"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              {...register("email")}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-all ${errors.email ? "border-red-500 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-500"
                }`}
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              {...register("password")}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-all ${errors.password ? "border-red-500 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-500"
                }`}
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {/* Confirm Password (Conditional) */}
          {!isLogin && (
            <div className="animate-fadeIn">
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                {...register("confirmPassword")}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-all ${errors.confirmPassword ? "border-red-500 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-500"
                  }`}
                placeholder="••••••••"
              />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 shadow-md disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3 border-t-2 border-white rounded-full" viewBox="0 0 24 24"></svg>
                Processing...
              </span>
            ) : (isLogin ? "Sign In" : "Sign Up")}
          </button>
        </form>

        {/* Server Messages */}
        {serverMsg.text && (
          <div className={`mt-4 p-3 rounded-lg text-sm text-center font-medium ${serverMsg.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
            {serverMsg.text}
          </div>
        )}

        {/* Switcher */}
        <div className="mt-8 text-center text-sm text-gray-600">
          {isLogin ? "New here?" : "Already have an account?"}
          <button
            onClick={toggleMode}
            className="ml-1 text-blue-600 font-bold hover:underline focus:outline-none"
          >
            {isLogin ? "Create an account" : "Log in instead"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;