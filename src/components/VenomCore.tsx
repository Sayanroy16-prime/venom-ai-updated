import { motion } from "motion/react";

interface VenomCoreProps {
  isThinking: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isLiveSession?: boolean;
  isOffline?: boolean;
  wakeWordStatus?: 'idle' | 'listening' | 'detected' | 'error';
  accentColorOverride?: string;
}

export const VenomCore = ({ 
  isThinking, 
  isSpeaking, 
  isListening, 
  isLiveSession = false, 
  isOffline = false, 
  wakeWordStatus = 'idle',
  accentColorOverride
}: VenomCoreProps) => {
  const isError = wakeWordStatus === 'error';
  
  // Use override if provided, otherwise fallback to the derived values
  const baseColor = accentColorOverride 
    ? accentColorOverride.replace(')', ', 0.3)').replace('rgb', 'rgba') 
    : (isError ? "rgba(239, 68, 68, 0.3)" : isOffline ? "rgba(249, 115, 22, 0.3)" : "rgba(0, 242, 255, 0.3)");
    
  const accentColor = accentColorOverride 
    ? accentColorOverride.replace(')', ', 0.8)').replace('rgb', 'rgba') 
    : (isError ? "rgba(239, 68, 68, 0.8)" : isOffline ? "rgba(249, 115, 22, 0.8)" : "rgba(0, 242, 255, 0.8)");
    
  // Simplified color logic: if override is hex or rgb, just use it for the borders/accents
  const hudColor = accentColorOverride || (isError ? "#ef4444" : isOffline ? "#f97316" : "#00f2ff");

  return (
    <div className="relative flex items-center justify-center w-80 h-80">
      {/* Outer Rotating HUD Ring */}
      <motion.div
        className="absolute w-full h-full border border-dashed rounded-full"
        style={{ borderColor: `${hudColor}33` }}
        animate={{ 
          rotate: 360,
          scale: isListening ? [1, 1.02, 1] : 1
        }}
        transition={{ 
          rotate: { duration: isThinking ? 5 : 20, repeat: Infinity, ease: "linear" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }}
      />

      {/* Segmented Ring */}
      <motion.div
        className="absolute w-[90%] h-[90%] border-4 border-double rounded-full"
        style={{ 
          borderColor: `${hudColor}4D`,
          clipPath: "polygon(50% 50%, 100% 0, 100% 100%, 0 100%, 0 0)" 
        }}
        animate={{ 
          rotate: -360,
          scale: isListening ? [1, 1.05, 1] : 1
        }}
        transition={{ 
          rotate: { duration: isThinking ? 4 : 15, repeat: Infinity, ease: "linear" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }}
      />

      {/* Data Arcs */}
      <svg className="absolute w-full h-full -rotate-90">
        <motion.circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke={`${hudColor}33`}
          strokeWidth="2"
          strokeDasharray="10 5"
        />
        <motion.circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke={`${hudColor}99`}
          strokeWidth="4"
          strokeDasharray="100 200"
          animate={{ strokeDashoffset: [0, 300] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
      </svg>

      {/* Inner Pulsing Core */}
      <motion.div
        className="relative w-48 h-48 rounded-full flex items-center justify-center border"
        style={{ 
          background: `linear-gradient(to bottom right, ${hudColor}1A, black, ${hudColor}1A)`,
          borderColor: `${hudColor}4D`,
          boxShadow: `0 0 50px ${hudColor}33`
        }}
        animate={{
          scale: isSpeaking ? [1, 1.08, 0.98, 1.05, 1] : 1,
          boxShadow: isListening 
            ? [`0 0 50px ${hudColor}4D`, `0 0 80px ${hudColor}80`, `0 0 50px ${hudColor}4D`]
            : isError ? "0 0 40px rgba(239, 68, 68, 0.1)" : `0 0 40px ${hudColor}1A`,
        }}
        transition={{
          scale: { duration: 0.4, repeat: isSpeaking ? Infinity : 0, ease: "easeInOut" },
          boxShadow: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
        }}
      >
        {/* The "Eye" or Pupil */}
        <motion.div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ 
            backgroundColor: hudColor,
            boxShadow: `0 0 20px ${hudColor}CC`
          }}
          animate={{
            opacity: isThinking ? [0.6, 1, 0.6] : 1,
            scale: isSpeaking ? [1, 1.2, 0.9, 1.1, 1] : 1,
            rotate: isThinking ? 360 : 0
          }}
          transition={{ 
            opacity: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
            scale: { duration: 0.3, repeat: isSpeaking ? Infinity : 0 },
            rotate: { duration: 2, repeat: Infinity, ease: "linear" }
          }}
        >
          <div className="w-4 h-4 bg-white rounded-full blur-[1px] opacity-80" />
          {/* Scanning Line when thinking */}
          {isThinking && (
            <motion.div 
              className="absolute w-full h-[1px] bg-white/50"
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          )}
        </motion.div>

        {/* HUD Labels inside core */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-[8px] font-mono absolute top-8 uppercase tracking-widest" style={{ color: `${hudColor}80` }}>{isLiveSession ? 'Live_Session' : 'Neural_Link'}</div>
          <div className="text-[8px] font-mono absolute bottom-8 uppercase tracking-widest" style={{ color: `${hudColor}80` }}>{isError ? 'Status_Error' : isLiveSession ? 'Status_Live' : 'Status_Active'}</div>
          <div className="text-[8px] font-mono absolute left-4 rotate-90 uppercase tracking-widest" style={{ color: `${hudColor}80` }}>Sync_01</div>
          <div className="text-[8px] font-mono absolute right-4 -rotate-90 uppercase tracking-widest" style={{ color: `${hudColor}80` }}>Buff_99</div>
        </div>
      </motion.div>

      {/* Orbiting Particles */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full blur-[1px]"
          style={{ 
            backgroundColor: hudColor,
            originX: "0px", 
            originY: "0px", 
            left: "50%", 
            top: "50%" 
          }}
          animate={{
            rotate: 360,
            x: isThinking ? [80, 90, 80] : [120, 130, 120],
          }}
          transition={{
            rotate: { duration: (isThinking ? 1 : 3) + i, repeat: Infinity, ease: "linear" },
            x: { duration: isListening ? 0.5 : 2, repeat: Infinity, ease: "easeInOut" }
          }}
        />
      ))}
    </div>
  );
};
