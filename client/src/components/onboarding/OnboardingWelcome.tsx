import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Database, 
  Upload, 
  Zap, 
  Users, 
  BarChart3, 
  FileText, 
  Image, 
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Target,
  Layers,
  Globe
} from "lucide-react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  features: string[];
}

interface OnboardingWelcomeProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingWelcome({ onComplete, onSkip }: OnboardingWelcomeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Your MDM System!',
      description: 'Streamline product data management with intelligent automation',
      icon: Sparkles,
      color: 'from-purple-500 to-pink-500',
      features: [
        'Unified Master Catalog',
        'Intelligent Data Mapping',
        'Authentic Image Gallery',
        'Advanced Deduplication'
      ]
    },
    {
      id: 'catalog',
      title: 'Master Catalog Management',
      description: 'Centralize all your product information in one powerful system',
      icon: Database,
      color: 'from-blue-500 to-cyan-500',
      features: [
        'Single source of truth',
        'Real-time synchronization',
        'Category management',
        'Advanced search & filtering'
      ]
    },
    {
      id: 'mapping',
      title: 'Smart Data Mapping',
      description: 'Intelligent templates automatically map supplier data fields',
      icon: Target,
      color: 'from-green-500 to-emerald-500',
      features: [
        'Auto-detect image URLs',
        'Fuzzy field matching',
        'Dual mapping views',
        'Validation rules'
      ]
    },
    {
      id: 'gallery',
      title: 'Authentic Image Gallery',
      description: 'Showcase real product photos from your supplier feeds',
      icon: Image,
      color: 'from-orange-500 to-red-500',
      features: [
        'Live supplier integration',
        'Multiple image formats',
        'Fallback handling',
        'High-resolution support'
      ]
    },
    {
      id: 'deduplication',
      title: 'Advanced Deduplication',
      description: 'Eliminate duplicates with AI-powered matching algorithms',
      icon: Layers,
      color: 'from-indigo-500 to-purple-500',
      features: [
        '4-tier matching system',
        'USIN & UPC verification',
        'Fuzzy name matching',
        'Confidence scoring'
      ]
    }
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 800);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const currentStepData = steps[currentStep];
  const IconComponent = currentStepData.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="w-full max-w-2xl"
      >
        <Card className="relative overflow-hidden">
          {/* Animated background gradient */}
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br ${currentStepData.color} opacity-10`}
            animate={{ 
              backgroundPosition: ['0% 0%', '100% 100%'],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          />
          
          <CardHeader className="relative">
            {/* Progress indicator */}
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className="bg-white/80">
                Step {currentStep + 1} of {steps.length}
              </Badge>
              <Button variant="ghost" size="sm" onClick={onSkip}>
                Skip Tour
              </Button>
            </div>
            
            <Progress value={progress} className="mb-6 h-2" />
            
            <div className="flex items-center gap-4">
              <motion.div
                key={currentStep}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 260, 
                  damping: 20,
                  delay: 0.2
                }}
                className={`p-4 rounded-full bg-gradient-to-br ${currentStepData.color} text-white shadow-lg`}
              >
                <IconComponent size={32} />
              </motion.div>
              
              <div>
                <CardTitle className="text-2xl mb-2">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentStep}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {currentStepData.title}
                    </motion.span>
                  </AnimatePresence>
                </CardTitle>
                
                <motion.p
                  key={currentStep}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="text-gray-600"
                >
                  {currentStepData.description}
                </motion.p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
              >
                <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Zap className="text-yellow-500" size={20} />
                  Key Features
                </h4>
                
                {currentStepData.features.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ 
                      duration: 0.3, 
                      delay: 0.2 + (index * 0.1) 
                    }}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ 
                        type: "spring", 
                        delay: 0.3 + (index * 0.1) 
                      }}
                    >
                      <CheckCircle2 className="text-green-500" size={18} />
                    </motion.div>
                    <span className="text-gray-700">{feature}</span>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <div className="flex gap-2">
                {steps.map((_, index) => (
                  <motion.div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                    animate={{ 
                      scale: index === currentStep ? 1.2 : 1 
                    }}
                  />
                ))}
              </div>
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button onClick={nextStep} className="group">
                  {currentStep < steps.length - 1 ? 'Next' : 'Get Started'}
                  <motion.div
                    className="ml-2"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    <ArrowRight size={16} />
                  </motion.div>
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}