interface AuthTabsProps {
  activeTab: "login" | "signup";
  setActiveTab: (tab: "login" | "signup") => void;
}

export default function AuthTabs({ activeTab, setActiveTab }: AuthTabsProps) {
  return (
    <div className="bg-white rounded-t-lg shadow-sm border border-gray-200">
      <div className="flex">
        <button 
          className={`flex-1 py-4 text-center font-medium border-b-2 ${
            activeTab === "login"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("login")}
        >
          Log In
        </button>
        <button 
          className={`flex-1 py-4 text-center font-medium border-b-2 ${
            activeTab === "signup"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("signup")}
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}
