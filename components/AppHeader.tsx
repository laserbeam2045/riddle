"use client"; // Mark as Client Component because of onClick

import React from "react";
// Removed Link import as onClick is used

const AppHeader: React.FC = () => {
  const handleReturnHome = () => {
    // Basic navigation using window.location for simplicity
    window.location.href = "/";
  };

  return (
    <header className="w-dvw bg-gradient-to-r from-purple-800 to-blue-800 py-6 px-4 shadow-lg sticky top-0 z-10">
      <div className="text-white container mx-auto flex justify-between items-center">
        <div
          className="text-2xl font-bold tracking-wider cursor-pointer"
          onClick={handleReturnHome} // Use onClick handler
        >
          RIDDLE MASTER
        </div>
        <nav className="md:flex space-x-8"></nav> {/* Keep nav structure */}
      </div>
    </header>
  );
};

export default AppHeader;
