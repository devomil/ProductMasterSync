import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { FullscreenButton } from "./fullscreen-button";

interface FullscreenContentProps {
  children: React.ReactNode;
  className?: string;
  headerContent?: React.ReactNode;
  buttonClass?: string;
}

export function FullscreenContent({
  children,
  className = "",
  headerContent,
  buttonClass = "",
}: FullscreenContentProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  return (
    <div
      className={cn(
        "relative",
        isFullscreen ? "fixed inset-0 w-screen h-screen z-[100] bg-background p-4" : "",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        {headerContent && <div className="flex-1">{headerContent}</div>}
        <FullscreenButton onToggle={setIsFullscreen} className={buttonClass} />
      </div>
      {children}
    </div>
  );
}