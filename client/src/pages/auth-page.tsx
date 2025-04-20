import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AuthTabs from "@/components/auth/auth-tabs";
import LoginForm from "@/components/auth/login-form";
import SignupForm from "@/components/auth/signup-form";

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();

  // Redirect to home if user is already logged in
  useEffect(() => {
    if (user && !isLoading) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">SimTwo</h1>
          <p className="text-gray-600 mt-1">Modern Simulation Platform</p>
        </div>

        {/* Auth Form Container */}
        <div>
          {/* Tab Navigation */}
          <AuthTabs activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Form Content */}
          {activeTab === "login" ? <LoginForm /> : <SignupForm />}

          {/* Additional Links */}
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>
              By using SimTwo, you agree to our{" "}
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
