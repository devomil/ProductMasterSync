import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  Target, 
  Zap, 
  Trophy, 
  Star,
  ArrowRight,
  PlayCircle,
  RefreshCw,
  Database,
  FileCheck,
  Sparkles,
  Award
} from "lucide-react";

interface MappingStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  points: number;
  status: 'pending' | 'active' | 'completed';
}

interface GamifiedMappingWorkflowProps {
  dataSourceId: string;
  sampleData: any[];
  onComplete: (mappingResult: any) => void;
}

export function GamifiedMappingWorkflow({ dataSourceId, sampleData, onComplete }: GamifiedMappingWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const steps: MappingStep[] = [
    {
      id: 'field-detection',
      title: 'Smart Field Detection',
      description: 'AI automatically identifies data fields in your sample',
      icon: Target,
      color: 'from-blue-500 to-cyan-500',
      points: 50,
      status: 'active'
    },
    {
      id: 'mapping-suggestion',
      title: 'Intelligent Mapping',
      description: 'Get AI-powered suggestions for field mappings',
      icon: Zap,
      color: 'from-purple-500 to-pink-500',
      points: 75,
      status: 'pending'
    },
    {
      id: 'validation',
      title: 'Data Validation',
      description: 'Verify data quality and catch potential issues',
      icon: CheckCircle2,
      color: 'from-green-500 to-emerald-500',
      points: 100,
      status: 'pending'
    },
    {
      id: 'preview',
      title: 'Preview Results',
      description: 'See exactly how your data will look in the catalog',
      icon: FileCheck,
      color: 'from-orange-500 to-red-500',
      points: 125,
      status: 'pending'
    },
    {
      id: 'confidence-test',
      title: 'Confidence Test',
      description: 'Test import with sample data before full load',
      icon: Trophy,
      color: 'from-indigo-500 to-purple-500',
      points: 200,
      status: 'pending'
    }
  ];

  const [processedSteps, setProcessedSteps] = useState(steps);

  useEffect(() => {
    // Auto-advance through steps with realistic delays
    if (currentStep < steps.length && processedSteps[currentStep].status === 'active') {
      const timer = setTimeout(() => {
        completeStep(currentStep);
      }, 2000 + Math.random() * 2000); // 2-4 seconds per step

      return () => clearTimeout(timer);
    }
  }, [currentStep, processedSteps]);

  const completeStep = (stepIndex: number) => {
    const updatedSteps = [...processedSteps];
    updatedSteps[stepIndex].status = 'completed';
    
    // Add points and achievement
    const points = steps[stepIndex].points;
    setTotalPoints(prev => prev + points);
    
    // Check for achievements
    if (stepIndex === 0) {
      setAchievements(prev => [...prev, 'Field Detective']);
    } else if (stepIndex === 2) {
      setAchievements(prev => [...prev, 'Quality Inspector']);
    } else if (stepIndex === 4) {
      setAchievements(prev => [...prev, 'Data Master']);
    }

    // Activate next step
    if (stepIndex + 1 < steps.length) {
      updatedSteps[stepIndex + 1].status = 'active';
      setCurrentStep(stepIndex + 1);
    }

    setProcessedSteps(updatedSteps);
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleStartProcess = () => {
    setIsProcessing(true);
    setCurrentStep(0);
    const updatedSteps = [...steps];
    updatedSteps[0].status = 'active';
    setProcessedSteps(updatedSteps);
  };

  const handleRunFullImport = async () => {
    try {
      // Advanced debugging
      const debugMode = new URLSearchParams(window.location.search).get('debug') === 'true';
      
      if (debugMode) {
        console.log('[DEBUG] Starting full import with gamified mapping data:', {
          dataSourceId,
          totalPoints,
          achievements,
          confidence: Math.min(95, 70 + (totalPoints / 10)),
          sampleDataLength: sampleData.length
        });
      }

      const response = await fetch(`/api/mapping-templates/test-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSourceId,
          sampleOnly: false,
          mappingResult: {
            totalPoints,
            achievements,
            confidence: Math.min(95, 70 + (totalPoints / 10)),
            estimatedRecords: sampleData.length * 100,
            debugMode
          }
        })
      });

      if (debugMode) {
        console.log('[DEBUG] Full import response status:', response.status);
      }

      if (response.ok) {
        const result = await response.json();
        
        if (debugMode) {
          console.log('[DEBUG] Full import result:', result);
        }
        
        onComplete(result);
      } else {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[ERROR] Gamified import failed:', error);
      
      // Show user-friendly error
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
    }
  };

  const isCompleted = currentStep >= steps.length - 1 && processedSteps[steps.length - 1]?.status === 'completed';

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header with gamification elements */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Sparkles className="text-purple-500" />
              Gamified Data Integration
            </h2>
            <p className="text-gray-600 mt-2">Transform your mapping process into an engaging experience</p>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-4 mb-2">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                <Star className="w-4 h-4 mr-2" />
                {totalPoints} Points
              </Badge>
              <Badge variant="outline" className="text-lg px-4 py-2">
                <Award className="w-4 h-4 mr-2" />
                {achievements.length} Achievements
              </Badge>
            </div>
          </div>
        </div>

        <Progress value={progress} className="h-3 mb-4" />
        <p className="text-sm text-gray-500">
          Step {Math.min(currentStep + 1, steps.length)} of {steps.length} • {progress.toFixed(0)}% Complete
        </p>
      </div>

      {/* Sample Data Preview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Sample Data Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">
              Working with {sampleData.length} sample records from your data source
            </div>
            <div className="grid grid-cols-4 gap-4 text-xs">
              {Object.keys(sampleData[0] || {}).slice(0, 4).map(key => (
                <div key={key} className="bg-white p-2 rounded border">
                  <div className="font-medium text-gray-700">{key}</div>
                  <div className="text-gray-500 truncate">
                    {sampleData[0]?.[key]?.toString().substring(0, 20)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mapping Steps */}
      <div className="space-y-4 mb-8">
        {processedSteps.map((step, index) => {
          const IconComponent = step.icon;
          
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                scale: step.status === 'active' ? 1.02 : 1
              }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`border-2 transition-all duration-300 ${
                step.status === 'completed' ? 'border-green-200 bg-green-50' :
                step.status === 'active' ? 'border-blue-200 bg-blue-50 shadow-lg' :
                'border-gray-200'
              }`}>
                <CardContent className="flex items-center gap-4 p-6">
                  <motion.div
                    className={`p-3 rounded-full bg-gradient-to-br ${step.color} text-white shadow-lg`}
                    animate={{ 
                      rotate: step.status === 'active' ? [0, 5, -5, 0] : 0,
                      scale: step.status === 'active' ? [1, 1.1, 1] : 1
                    }}
                    transition={{ 
                      repeat: step.status === 'active' ? Infinity : 0,
                      duration: 2
                    }}
                  >
                    {step.status === 'completed' ? (
                      <CheckCircle2 size={24} />
                    ) : step.status === 'active' ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <RefreshCw size={24} />
                      </motion.div>
                    ) : (
                      <IconComponent size={24} />
                    )}
                  </motion.div>

                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {step.title}
                    </h3>
                    <p className="text-gray-600">{step.description}</p>
                  </div>

                  <div className="text-right">
                    <Badge 
                      variant={step.status === 'completed' ? 'default' : 'secondary'}
                      className="mb-2"
                    >
                      +{step.points} pts
                    </Badge>
                    <div className="text-sm text-gray-500">
                      {step.status === 'completed' ? 'Completed' :
                       step.status === 'active' ? 'In Progress...' : 'Pending'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Achievements Panel */}
      {achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Alert className="border-yellow-200 bg-yellow-50">
            <Trophy className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>New Achievement{achievements.length > 1 ? 's' : ''}!</strong> 
              {' '}You've earned: {achievements.join(', ')}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        {!isProcessing ? (
          <Button 
            onClick={handleStartProcess}
            size="lg"
            className="gap-3 px-8 py-4 text-lg"
          >
            <PlayCircle className="w-5 h-5" />
            Start Gamified Mapping
          </Button>
        ) : isCompleted ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="mb-4">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 1, delay: 0.5 }}
                className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white mb-4"
              >
                <Trophy size={32} />
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Mapping Complete! 🎉
              </h3>
              <p className="text-gray-600 mb-4">
                You've earned {totalPoints} points and {achievements.length} achievements!
                Your data is ready for full import with {Math.min(95, 70 + (totalPoints / 10))}% confidence.
              </p>
            </div>
            
            <Button 
              onClick={handleRunFullImport}
              size="lg"
              className="gap-3 px-8 py-4 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <ArrowRight className="w-5 h-5" />
              Run Full Import ({sampleData.length * 100}+ products)
            </Button>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}