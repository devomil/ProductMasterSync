import { useState, useEffect, createContext, useContext } from 'react';
import { OnboardingWelcome } from './OnboardingWelcome';

interface OnboardingContextType {
  triggerOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingManager');
  }
  return context;
};

interface OnboardingManagerProps {
  children: React.ReactNode;
}

export function OnboardingManager({ children }: OnboardingManagerProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem('mdm-onboarding-completed');
    
    // Show onboarding for new users after a brief delay for better UX
    const timer = setTimeout(() => {
      setIsLoading(false);
      if (!hasCompletedOnboarding) {
        setShowOnboarding(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('mdm-onboarding-completed', 'true');
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('mdm-onboarding-completed', 'true');
    setShowOnboarding(false);
  };

  const triggerOnboarding = () => {
    setShowOnboarding(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your MDM System...</p>
        </div>
      </div>
    );
  }

  return (
    <OnboardingContext.Provider value={{ triggerOnboarding }}>
      {children}
      {showOnboarding && (
        <OnboardingWelcome
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
    </OnboardingContext.Provider>
  );
}