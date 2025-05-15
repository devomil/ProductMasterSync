import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize } from "lucide-react";

interface FullscreenButtonProps {
  onToggle: (isFullscreen: boolean) => void;
  className?: string;
}

export function FullscreenButton({ onToggle, className = "" }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        onToggle(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, onToggle]);

  const toggleFullscreen = () => {
    const newState = !isFullscreen;
    setIsFullscreen(newState);
    onToggle(newState);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleFullscreen}
      className={`h-8 w-8 rounded-full p-0 ${className}`}
      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
    >
      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </Button>
  );
}

export function FullscreenActionButton({ onToggle, className = "" }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        onToggle(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, onToggle]);

  const toggleFullscreen = () => {
    const newState = !isFullscreen;
    setIsFullscreen(newState);
    onToggle(newState);
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggleFullscreen}
      className={className}
      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
    >
      {isFullscreen ? (
        <>
          <Minimize className="h-4 w-4 mr-2" /> Exit Fullscreen
        </>
      ) : (
        <>
          <Maximize className="h-4 w-4 mr-2" /> Fullscreen
        </>
      )}
    </Button>
  );
}