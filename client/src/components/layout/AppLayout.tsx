import React from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-grow flex">
        <Sidebar />
        <div className="flex-1 overflow-auto focus:outline-none" tabIndex={0}>
          <main className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
