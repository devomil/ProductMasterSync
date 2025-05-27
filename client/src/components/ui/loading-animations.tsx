import React from "react";
import { motion } from "framer-motion";
import { Database, Zap, Save, Download, ArrowLeftRight, CheckCircle } from "lucide-react";

interface LoadingAnimationProps {
  type: 'data-loading' | 'auto-mapping' | 'saving' | 'processing';
  message?: string;
}

export function LoadingAnimation({ type, message }: LoadingAnimationProps) {
  const getAnimation = () => {
    switch (type) {
      case 'data-loading':
        return <DataLoadingAnimation message={message} />;
      case 'auto-mapping':
        return <AutoMappingAnimation message={message} />;
      case 'saving':
        return <SavingAnimation message={message} />;
      case 'processing':
        return <ProcessingAnimation message={message} />;
      default:
        return <DataLoadingAnimation message={message} />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      {getAnimation()}
    </div>
  );
}

function DataLoadingAnimation({ message }: { message?: string }) {
  return (
    <>
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-blue-100 p-6 rounded-full"
        >
          <Database className="w-12 h-12 text-blue-600" />
        </motion.div>
        
        {/* Pulsing rings */}
        <motion.div
          className="absolute inset-0 border-4 border-blue-300 rounded-full"
          animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 border-4 border-blue-400 rounded-full"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <h3 className="text-lg font-semibold text-blue-900">Loading Data</h3>
        <p className="text-blue-700 mt-1">
          {message || "Pulling fresh data from your source..."}
        </p>
        <motion.div
          className="flex justify-center mt-3 space-x-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-blue-500 rounded-full"
              animate={{ y: [0, -10, 0] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.2
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </>
  );
}

function AutoMappingAnimation({ message }: { message?: string }) {
  return (
    <>
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-purple-100 p-6 rounded-full"
        >
          <Zap className="w-12 h-12 text-purple-600" />
        </motion.div>
        
        {/* Electric animation */}
        <motion.div
          className="absolute -inset-2"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-full h-full border-2 border-dashed border-purple-400 rounded-full opacity-50" />
        </motion.div>
      </div>
      
      {/* Field mapping visualization */}
      <div className="flex items-center space-x-4 mt-4">
        <motion.div
          className="flex flex-col space-y-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          {['SKU', 'Name', 'Price'].map((field, i) => (
            <motion.div
              key={field}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            >
              {field}
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div
          animate={{ x: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ArrowLeftRight className="w-6 h-6 text-purple-600" />
        </motion.div>
        
        <motion.div
          className="flex flex-col space-y-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          {['CWR Part Number', 'Title', 'Your Cost'].map((field, i) => (
            <motion.div
              key={field}
              className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
            >
              {field}
            </motion.div>
          ))}
        </motion.div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <h3 className="text-lg font-semibold text-purple-900">Auto-Mapping Fields</h3>
        <p className="text-purple-700 mt-1">
          {message || "Intelligently matching your data fields..."}
        </p>
      </motion.div>
    </>
  );
}

function SavingAnimation({ message }: { message?: string }) {
  return (
    <>
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-green-100 p-6 rounded-full"
        >
          <motion.div
            animate={{ rotateY: [0, 180, 360] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Save className="w-12 h-12 text-green-600" />
          </motion.div>
        </motion.div>
        
        {/* Success checkmarks floating up */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${20 + i * 20}%`, top: '50%' }}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ 
              opacity: [0, 1, 0], 
              y: [-20, -40, -60], 
              scale: [0.5, 1, 0.5] 
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.5
            }}
          >
            <CheckCircle className="w-4 h-4 text-green-500" />
          </motion.div>
        ))}
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <h3 className="text-lg font-semibold text-green-900">Saving Template</h3>
        <p className="text-green-700 mt-1">
          {message || "Storing your mapping configuration..."}
        </p>
        <motion.div
          className="mt-3 h-2 bg-green-200 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <motion.div
            className="h-full bg-green-500 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>
    </>
  );
}

function ProcessingAnimation({ message }: { message?: string }) {
  return (
    <>
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-blue-100 to-purple-100 p-6 rounded-full"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Database className="w-12 h-12 text-blue-600" />
          </motion.div>
        </motion.div>
        
        {/* Data flowing animation */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-400 rounded-full"
            style={{
              top: '20%',
              left: '50%',
              marginLeft: '-4px'
            }}
            animate={{
              y: [0, 60, 0],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3
            }}
          />
        ))}
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <h3 className="text-lg font-semibold text-orange-900">Processing</h3>
        <p className="text-orange-700 mt-1">
          {message || "Working on your request..."}
        </p>
      </motion.div>
    </>
  );
}

// Compact loading spinner for buttons
export function ButtonSpinner() {
  return (
    <motion.div
      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  );
}

// Success animation for completed actions
export function SuccessAnimation({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        <CheckCircle className="w-6 h-6 text-green-600" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="text-green-800 font-medium"
      >
        {message}
      </motion.p>
    </motion.div>
  );
}