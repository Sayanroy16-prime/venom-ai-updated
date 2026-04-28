import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Video, VideoOff, Crosshair, Scan } from 'lucide-react';

interface CameraFeedProps {
  isActive: boolean;
  onCapture?: (base64: string) => void;
  isScanning?: boolean;
}

export const CameraFeed = ({ isActive, onCapture, isScanning = false }: CameraFeedProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isActive]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Optical sensors offline. Check permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (!onCapture || !videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      onCapture(base64);
    }
  };

  return (
    <div className="relative w-full h-full bg-black/40 rounded-lg overflow-hidden border border-white/5 group">
      <canvas ref={canvasRef} className="hidden" />
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div 
            key="camera-active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-full"
          >
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500/50 p-4 text-center">
                <VideoOff className="w-8 h-8 mb-2" />
                <p className="text-[10px] font-mono uppercase tracking-widest">{error}</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover grayscale opacity-40 mix-blend-screen"
                />
                
                {/* HUD Overlays */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Corner Brackets */}
                  <div className="absolute top-4 left-4 w-8 h-8 border-t border-l border-cyan-500/40" />
                  <div className="absolute top-4 right-4 w-8 h-8 border-t border-r border-cyan-500/40" />
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b border-l border-cyan-500/40" />
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b border-r border-cyan-500/40" />
                  
                  {/* Center Crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <Crosshair className={`w-12 h-12 ${isScanning ? 'text-red-500 animate-spin' : 'text-cyan-400'}`} />
                  </div>

                  {/* Scanning Line */}
                  <motion.div 
                    className={`absolute inset-x-0 h-[2px] ${isScanning ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.5)]'}`}
                    animate={{ top: isScanning ? ["0%", "100%", "0%", "100%", "0%"] : ["0%", "100%", "0%"] }}
                    transition={{ duration: isScanning ? 1 : 4, repeat: Infinity, ease: "linear" }}
                  />

                  {/* Data Readout */}
                  <div className="absolute bottom-6 left-6 font-mono text-[8px] text-cyan-500/60 space-y-1 uppercase tracking-tighter">
                    <div className="flex items-center gap-2">
                      <Scan className="w-3 h-3" />
                      <span>{isScanning ? 'Neural Extracting...' : 'Subject Identified: User'}</span>
                    </div>
                    <div>Biometric Scan: {isScanning ? 'Intensive' : 'Active'}</div>
                    <div>Neural Link: Stable</div>
                    {isScanning && <div className="text-red-500/80 animate-pulse">Syncing with Cloud Core...</div>}
                  </div>

                  <div className="absolute top-6 right-6 font-mono text-[8px] text-red-500/40 uppercase tracking-widest animate-pulse">
                    Rec • 00:00:00
                  </div>
                </div>

                {/* Capture Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={handleCapture}
                    disabled={isScanning}
                    className="bg-cyan-600/20 border border-cyan-500 text-cyan-400 px-6 py-2 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-cyan-500 hover:text-black transition-all transform hover:scale-105"
                  >
                    NEURAL_SCAN
                  </button>
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="camera-inactive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center text-white/10"
          >
            <Video className="w-12 h-12 mb-4" />
            <p className="text-[10px] font-mono uppercase tracking-[4px]">Optical Sensors Standby</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
