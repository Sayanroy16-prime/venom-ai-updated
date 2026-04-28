/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Send, Terminal, Cpu, Shield, Zap, Volume2, VolumeX, Video, VideoOff, LogOut, Activity, Smartphone, Trash2, RotateCcw, Check, CheckCircle2, Image as ImageIcon, MapPin, Brain, Sliders, Clipboard, AlertCircle } from 'lucide-react';
import { generateVenomResponse } from './services/gemini';
import { VoiceSettings, VoiceSettingsData } from './components/VoiceSettings';
import { useVoice } from './hooks/useVoice';
import { VenomCore } from './components/VenomCore';
import { CameraFeed } from './components/CameraFeed';
import { Typewriter } from './components/Typewriter';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

declare global {
  interface Window {
    electron: any;
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface Message {
  id?: string;
  role: 'user' | 'model';
  text: string;
  timestamp: any;
  imageUrl?: string;
  videoUrl?: string;
}

interface Task {
  id?: string;
  title: string;
  description?: string;
  dueAt: any;
  status: 'pending' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'reminder' | 'task' | 'mission';
  createdAt: any;
}

const HoloCard = ({ children, className = "", label, gridClass = "" }: { children: React.ReactNode, className?: string, label?: string, gridClass?: string }) => {
  return (
    <div className={`h-full ${gridClass}`}>
      <div className={`bento-card h-full origin-center overflow-visible ${className}`}>
        {label && <span className="bento-card-label">{label}</span>}
        <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOffline, setIsOffline] = useState(() => {
    try {
      return localStorage.getItem('venom_offline_mode') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [synapticBuffer, setSynapticBuffer] = useState('');
  const [codeVault, setCodeVault] = useState<{ language: string; code: string; timestamp: Date }[]>([]);
  const [visualVault, setVisualVault] = useState<{ id: string; url: string; type: 'image' | 'video'; timestamp: Date }[]>([]);
  const [metricsData, setMetricsData] = useState<{ time: string; cpu: number; mem: number }[]>([]);
  const [language, setLanguage] = useState<'en-US' | 'hi-IN'>('en-US');
  const [isLiveSession, setIsLiveSession] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [hudProfile, setHudProfile] = useState<'cyan' | 'crimson' | 'void' | 'forest'>('cyan');
  const [showKeyRequest, setShowKeyRequest] = useState(false);

  const getThemeClass = useCallback(() => {
    switch (hudProfile) {
      case 'crimson': return 'theme-crimson';
      case 'void': return 'theme-void';
      case 'forest': return 'theme-forest';
      default: return '';
    }
  }, [hudProfile]);

  const currentThemeColor = useCallback(() => {
    switch (hudProfile) {
      case 'crimson': return '#ef4444';
      case 'void': return '#a855f7';
      case 'forest': return '#10b981';
      default: return '#00f2ff';
    }
  }, [hudProfile]);

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsData>(() => {
    const saved = localStorage.getItem('venom_voice_settings');
    return saved ? JSON.parse(saved) : { pitch: 1.0, rate: 1.0, voiceName: '', profileId: 'default' };
  });

  useEffect(() => {
    localStorage.setItem('venom_voice_settings', JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const codeScrollRef = useRef<HTMLDivElement>(null);

  // Metrics Simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setMetricsData(prev => {
        const newData = [
          ...prev,
          {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            cpu: Math.floor(Math.random() * 30) + (isThinking ? 60 : 10),
            mem: Math.floor(Math.random() * 10) + 40
          }
        ];
        return newData.slice(-15); // Keep last 15 points
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isThinking]);

  // Extract code from messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'model') {
      const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      const newSnippets: { language: string; code: string; timestamp: Date }[] = [];
      while ((match = codeRegex.exec(lastMessage.text)) !== null) {
        newSnippets.push({
          language: match[1] || 'text',
          code: match[2].trim(),
          timestamp: new Date()
        });
      }
      if (newSnippets.length > 0) {
        setCodeVault(prev => {
          const uniqueNew = newSnippets.filter(snip => !prev.some(p => p.code === snip.code));
          return [...prev, ...uniqueNew];
        });
      }
    }
  }, [messages]);

  // Sync visual assets from messages
  useEffect(() => {
    const assets = messages
      .filter(m => m.imageUrl || m.videoUrl)
      .map(m => ({
        id: m.id || Math.random().toString(36).substr(2, 9),
        url: (m.imageUrl || m.videoUrl)!,
        type: m.videoUrl ? 'video' as const : 'image' as const,
        timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : 
                   m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp || Date.now())
      }))
      .reverse(); 
    
    setVisualVault(assets);
  }, [messages]);

  // Auto-start wake word detection 
  useEffect(() => {
    if (isAuthReady) {
      startWakeWordDetection();
    }
  }, [isAuthReady]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        // Sync user to firestore
        const userRef = doc(db, 'users', u.uid);
        setDoc(userRef, {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          lastLogin: serverTimestamp()
        }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${u.uid}`));
      }
    });
    return () => unsubscribe();
  }, []);

  // Message Listener
  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/messages`);
    });

    return () => unsubscribe();
  }, [user]);

  // Task Listener
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('dueAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(tks);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/tasks`);
    });

    return () => unsubscribe();
  }, [user]);

  // Task Monitor
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      tasks.forEach(task => {
        if (task.status === 'pending') {
          const dueTime = task.dueAt?.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
          const diff = dueTime.getTime() - now.getTime();
          
          // Notify if due within the last minute and not yet notified
          if (diff <= 0 && diff > -60000) {
            saveVenomResponse(`URGENT MISSION UPDATE: ${task.title} is due now.`);
            if (user && task.id) {
              setDoc(doc(db, 'users', user.uid, 'tasks', task.id), { status: 'completed' }, { merge: true })
                .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/tasks/${task.id}`));
            }
          }
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [tasks, user]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        console.log("Login popup already in progress or cancelled.");
      } else {
        console.error("Login failed:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleIngestBuffer = () => {
    if (!synapticBuffer.trim()) return;
    const textToProcess = synapticBuffer;
    setSynapticBuffer('');
    handleSendMessage(`SYNCHRONIZE_BUFFER_DATA:\n\n${textToProcess}`);
    speak("Neural data ingested into core.");
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputText(prev => prev + (prev ? '\n' : '') + text);
      speak("Data synchronized from clipboard.");
    } catch (err) {
      speak("Neural Link: Manual synchronization required. Use System Paste Command.");
    }
  };

  const toggleOfflineMode = () => {
    const newState = !isOffline;
    setIsOffline(newState);
    localStorage.setItem('venom_offline_mode', String(newState));
  };
  
  const handleWakeWord = useCallback(() => {
    startListening();
    console.log("Venom Awakened");
  }, []);

  const { 
    isListening, 
    transcript, 
    startListening, 
    speak, 
    isSpeaking, 
    isSpeakingRef,
    setTranscript,
    wakeWordStatus,
    isWakeWordActive,
    startWakeWordDetection,
    stopWakeWordDetection,
    requestPermission,
    availableVoices
  } = useVoice({ 
    onWakeWord: handleWakeWord,
    wakeWords: [
      'wake up venom', 'hey venom', 'hello venom', 'venom wake up', 'system start', 'venom online', 'awaken venom',
      'venom utho', 'suno venom', 'venom suno', 'venom shuru karo', 'venom start karo', 'namaste venom'
    ],
    lang: language,
    pitch: voiceSettings.pitch,
    rate: voiceSettings.rate,
    voiceName: voiceSettings.voiceName,
    profileId: voiceSettings.profileId
  });

  // Auto-restart listening for transcript if it was cleared and we are in live mode
  useEffect(() => {
    if (transcript && !isListening) {
      handleSendMessage(transcript);
      setTranscript('');
    }
  }, [transcript, isListening]);

  // Ensure wake word detection is OFF in Live Session
  useEffect(() => {
    if (isLiveSession) {
      stopWakeWordDetection();
    }
  }, [isLiveSession, stopWakeWordDetection]);

  // Handle Live Session Loop and Wake Word Resumption
  useEffect(() => {
    // If in Live mode, handle the loop
    if (isLiveSession) {
      if (!isSpeaking && !isThinking && !isListening && !isSpeakingRef.current) {
        const timer = setTimeout(() => {
          if (isLiveSession && !isSpeaking && !isThinking && !isListening && !isSpeakingRef.current) {
            startListening();
          }
        }, 800);
        return () => clearTimeout(timer);
      }
    } 
    // If not in Live mode, but wake word detection is supposed to be active, restart it if we are idle
    else if (!isSpeaking && !isThinking && !isListening && !isSpeakingRef.current && wakeWordStatus === 'idle' && !isWakeWordActive) {
      // Note: We only auto-restart if the user had it running before
      // This is a bit complex without a dedicated 'desired' state, so we'll rely on the status
    }
  }, [isLiveSession, isSpeaking, isThinking, isListening, startListening, startWakeWordDetection, isWakeWordActive, wakeWordStatus, isSpeakingRef]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isThinking]);

  const handleNeuralEyeScan = async (imageBase64: string) => {
    if (!user) return;
    
    setIsScanning(true);
    setIsThinking(true);
    
    // Add a system-like message for the user
    const scanMsg = language === 'hi-IN' ? "Neural Eye se scan kar raha hoon... Vision analysis shuru." : "Initiating Neural Eye capture... Analysis in progress.";
    
    try {
      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        role: 'user',
        text: `[NEURAL_EYE_SCAN_INITIALIZED]`,
        timestamp: serverTimestamp(),
        uid: user.uid,
        hasImage: true // Optional flag for UI
      });

      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const prompt = language === 'hi-IN' ? "Kripya apne neural eye se is image ko analyze kare aur mujhe bataye aap kya dekh rahe hain." : "Please analyze this image through your neural eyes and describe what you see, maintaining your Venom persona.";
      const aiResponse = await generateVenomResponse(prompt, history, imageBase64);
      
      if (aiResponse.text) {
        saveVenomResponse(aiResponse.text);
      }
    } catch (e) {
      console.error("Neural Eye Error:", e);
      saveVenomResponse("System Error: Neural Eye sync failed. Visual link corrupted.");
    } finally {
      setIsScanning(false);
      setIsThinking(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) {
      setInputText('');
      return;
    }

    if (user) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'messages'), {
          role: 'user',
          text,
          timestamp: serverTimestamp(),
          uid: user.uid
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/messages`);
      }
    } else {
      setMessages(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
    }

    setInputText('');

    const lowerText = text.toLowerCase();
    if (lowerText.includes('purge conversation') || lowerText.includes('clear chat') || lowerText.includes('/clear')) {
      handleClearChat();
      return;
    }

    if (lowerText.includes('activate wake word') || lowerText.includes('wake word shuru karo') || lowerText.includes('wake word chalu karo')) {
      startWakeWordDetection();
      saveVenomResponse(language === 'hi-IN' ? "Wake word detection shuru ho gaya hai, Sir." : "Wake word detection activated, Sir.");
      return;
    }
    
    if (lowerText.includes('deactivate wake word') || lowerText.includes('wake word band karo')) {
      stopWakeWordDetection();
      saveVenomResponse(language === 'hi-IN' ? "Wake word detection band kar diya gaya hai." : "Wake word detection deactivated.");
      return;
    }

    setIsThinking(true);

    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

      const isImageReq = /\b(generate|create|make|draw|show|give)\b.*\b(image|photo|picture|sketch|portrait)\b/i.test(lowerText) || lowerText.includes('generate image');
      const isVideoReq = /\b(generate|create|make)\b.*\b(video|clip|animation)\b/i.test(lowerText) || lowerText.includes('generate video');

      if (isVideoReq) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setShowKeyRequest(true);
          setIsThinking(false);
          saveVenomResponse("Neural video synthesis requires prioritization. Please authorize your Paid Neural Key to proceed.");
          return;
        }
      }

      try {
        const aiResponse = await generateVenomResponse(text, history, undefined, {
          thinkingMode: isThinkingMode,
          forceImage: isImageReq,
          forceVideo: isVideoReq
        });
        
        if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
          for (const call of aiResponse.toolCalls) {
            if (call.name === 'launch_app' && window.electron) {
              const appName = (call.args as any).appName;
              try {
                await window.electron.launchApp(appName);
                saveVenomResponse(`Initiating launch sequence for ${appName}.`);
              } catch (e) {
                saveVenomResponse(`Error: Failed to launch ${appName}.`);
              }
            } else if (call.name === 'open_url' && window.electron) {
              const url = (call.args as any).url;
              await window.electron.openUrl(url);
              saveVenomResponse(`Opening neural link to ${url}.`);
            } else if (call.name === 'get_system_info' && window.electron) {
              const info = await window.electron.getSystemInfo();
              saveVenomResponse(`System Status: Platform ${info.platform}, Arch ${info.arch}.`);
            } else if (call.name === 'schedule_task') {
              const args = call.args as any;
              if (user) {
                try {
                  await addDoc(collection(db, 'users', user.uid, 'tasks'), {
                    ...args,
                    uid: user.uid,
                    status: 'pending',
                    createdAt: serverTimestamp()
                  });
                  saveVenomResponse(`Mission logged: ${args.title}. Scheduled for ${new Date(args.dueAt).toLocaleString()}.`);
                } catch (e) {
                  handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/tasks`);
                }
              }
            }
          }
        }

        const hasOutput = (aiResponse.text && aiResponse.text.trim().length > 0) || aiResponse.imageOutput || aiResponse.videoBase64;
        const hasToolCalls = aiResponse.toolCalls && aiResponse.toolCalls.length > 0;

        if (hasOutput) {
          saveVenomResponse(aiResponse.text || "", aiResponse.imageOutput, aiResponse.videoBase64);
        } else if (!hasToolCalls) {
          // If no text, no media, AND no tools were called, show a fallback
          saveVenomResponse("Neural Core transmission stabilized. Ready for next command.");
        }
      } catch (err: any) {
        if (err.message === "VIDEO_API_KEY_REQUIRED") {
          setShowKeyRequest(true);
          saveVenomResponse("Authorization expired or invalid. Please re-authenticate your Paid Neural Key.");
        } else {
          saveVenomResponse(`Core Sync Failure: ${err.message}`);
        }
      }
    
    setIsThinking(false);
  };

  const handleCompleteMission = useCallback(async (taskId: string, title: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'tasks', taskId), { status: 'completed' }, { merge: true });
      saveVenomResponse(language === 'hi-IN' ? `Mission accomplished: ${title}. System optimized.` : `Mission accomplished: ${title}. Data link secured.`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/tasks/${taskId}`);
    }
  }, [user, language]);

  const handleClearChat = useCallback(async () => {
    if (!user) {
      setMessages([]);
      return;
    }

    try {
      const q = query(collection(db, 'users', user.uid, 'messages'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      saveVenomResponse(language === 'hi-IN' ? "Sari batchit mita di gayi hai, Sir." : "Data link purged. All conversation history deleted.");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/messages`);
    }
  }, [user, language]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + Delete to purge chat
      if (e.ctrlKey && e.shiftKey && e.key === 'Delete') {
        e.preventDefault();
        handleClearChat();
      }

      // 'M' to toggle mute (if not typing in input)
      if (e.key.toLowerCase() === 'm' && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        setIsMuted(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClearChat]);

  const saveVenomResponse = async (text: string, imageUrl?: string, videoBase64?: string) => {
    if (user) {
      try {
        const payload: any = {
          role: 'model',
          text,
          timestamp: serverTimestamp(),
          uid: user.uid
        };
        if (imageUrl) {
          payload.imageUrl = imageUrl;
        }
        if (videoBase64) {
          payload.videoUrl = `data:video/mp4;base64,${videoBase64}`;
        }
        await addDoc(collection(db, 'users', user.uid, 'messages'), payload);
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/messages`);
      }
    } else {
      setMessages(prev => [...prev, { role: 'model', text, timestamp: new Date(), imageUrl, videoUrl: videoBase64 ? `data:video/mp4;base64,${videoBase64}` : undefined } as Message]);
    }

    if (!isMuted) {
      speak(text);
    }
  };

  // Auth readiness check
  useEffect(() => {
    // Safety fallback for auth readiness
    const timer = setTimeout(() => {
      if (!isAuthReady) {
        console.warn("Neural Link: Auth readiness timeout reached. Forcing link established.");
        setIsAuthReady(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isAuthReady]);

  const downloadImage = (base64Data: string, format: 'png' | 'jpeg' | 'pdf', fileName: string) => {
    import('jspdf').then(({ jsPDF }) => {
      if (format === 'pdf') {
        const pdf = new jsPDF();
        const img = new Image();
        img.src = base64Data;
        img.onload = () => {
          const width = pdf.internal.pageSize.getWidth();
          const height = (img.height * width) / img.width;
          pdf.addImage(base64Data, 'JPEG', 0, 0, width, height);
          pdf.save(`${fileName}.pdf`);
        };
      } else {
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = `${fileName}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  if (!isAuthReady) {
    return (
      <div id="venom-init-overlay" className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="text-[var(--accent)] font-mono animate-pulse tracking-[4px]">INITIALIZING NEURAL LINK...</div>
      </div>
    );
  }

  return (
    <>
    <div id="venom-app-root" className={`min-h-screen bg-[var(--bg)] text-[var(--text-primary)] font-sans p-4 flex flex-col overflow-hidden relative selection:bg-[var(--accent)] selection:text-black ${getThemeClass()}`}>
        <div className="matrix-bg" />
        <div className="scanline" />
        
        {/* Header */}
        <header className="flex justify-between items-end mb-6 border-b border-[var(--border)] pb-4 z-10 relative">
          <div className="flex flex-col">
            <div className="text-4xl font-black tracking-tighter uppercase flex items-center gap-4 text-[var(--accent)] italic glow-text">
              <Shield className="w-10 h-10 drop-shadow-[0_0_10px_var(--accent-glow)]" />
              VENOM_CORE
              {isOffline && (
                <Badge variant="outline" className="text-[11px] border-orange-600/50 text-orange-500 bg-orange-950/20 px-2 py-0.5 h-5 font-black tracking-widest">
                  OFFLINE_MODE
                </Badge>
              )}
            </div>
            <div className="font-mono text-[11px] text-[var(--text-secondary)] tracking-[6px] mt-2 font-black">
              NEURAL_STATUS: <span className="text-[var(--accent)] animate-pulse">OPTIMIZED</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {user ? (
              <div className="flex items-center gap-4 bg-cyan-950/20 border border-cyan-600/30 px-5 py-2 rounded-none skew-x-[-12deg]">
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-none border-2 border-cyan-600 skew-x-[12deg]" referrerPolicy="no-referrer" />
                <span className="text-[11px] font-black text-cyan-500 tracking-widest skew-x-[12deg]">{user.displayName?.toUpperCase()}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-700 hover:text-cyan-500 skew-x-[12deg]" onClick={logout}>
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="font-black text-[11px] border-cyan-600 text-cyan-500 hover:bg-cyan-600 hover:text-black rounded-none tracking-[0.3em] px-6 h-10 skew-x-[-12deg]" 
                onClick={handleLogin}
                disabled={isLoggingIn}
              >
                <span className="skew-x-[12deg]">{isLoggingIn ? "CONSUMING..." : "SYNC_SOUL"}</span>
              </Button>
            )}
            
            <div className="flex items-center gap-2">
               <button
                onClick={() => {
                  const next = !isLiveSession;
                  setIsLiveSession(next);
                  if (next) {
                    startListening();
                    saveVenomResponse(language === 'hi-IN' ? "Live Neural Session shuru ho gaya hai. Main aapko lagatar sun raha hoon." : "Live Neural Session established. I am listening continuously.");
                  } else {
                    saveVenomResponse(language === 'hi-IN' ? "Live Neural Session band kar diya gaya hai." : "Live Neural Session terminated.");
                  }
                }}
                className={`text-[10px] font-black border border-cyan-900/30 h-8 px-3 rounded-none uppercase tracking-widest transition-all flex items-center justify-center cursor-pointer bg-transparent ${isLiveSession ? 'bg-red-950/30 text-red-500 border-red-500 animate-pulse' : 'text-cyan-600 hover:bg-cyan-600/10'}`}
              >
                {isLiveSession ? 'LIVE_ON' : 'LIVE_OFF'}
              </button>

              <button
                onClick={() => setLanguage(prev => prev === 'en-US' ? 'hi-IN' : 'en-US')}
                onKeyDown={(e) => e.key === 'Enter' && setLanguage(prev => prev === 'en-US' ? 'hi-IN' : 'en-US')}
                className={`text-[10px] font-black border h-8 px-3 rounded-none uppercase tracking-widest flex items-center justify-center cursor-pointer transition-all duration-300 bg-transparent ${language === 'hi-IN' ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500 shadow-[0_0_10px_rgba(0,242,255,0.2)]' : 'text-cyan-600 border-cyan-900/30 hover:bg-cyan-600/10'}`}
              >
                {language === 'en-US' ? 'EN' : 'HI'}
              </button>

              <div className={`flex items-center gap-2 px-3 py-1 border border-cyan-900/30 ${wakeWordStatus === 'listening' ? 'bg-cyan-950/20' : ''} rounded-none bg-transparent`}>
                <div className={`w-1.5 h-1.5 rounded-full ${wakeWordStatus === 'listening' ? 'bg-cyan-500 animate-pulse' : wakeWordStatus === 'error' ? 'bg-red-500' : 'bg-cyan-900'}`} />
                <span className="text-[9px] font-black uppercase text-cyan-700 tracking-[0.2em]">
                  Link: {wakeWordStatus}
                </span>
              </div>

              {wakeWordStatus === 'error' && (
                <div 
                  role="button"
                  tabIndex={0}
                  onClick={() => requestPermission()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && requestPermission()}
                  className="bg-red-950/40 text-red-500 hover:bg-red-900/50 h-10 px-4 flex items-center gap-3 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse cursor-pointer group"
                >
                  <AlertCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[10px] font-black tracking-widest uppercase text-red-400">LINK_SEVERED</span>
                     <span className="text-[8px] font-mono opacity-80 decoration-dotted underline underline-offset-2">CLICK TO RESTORE COMMAND_VOICE</span>
                     <span className="text-[7px] font-mono opacity-50 mt-1">[RESET VIA BROWSER LOCK ICON IF BLOCKED]</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setIsCameraActive(!isCameraActive)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsCameraActive(!isCameraActive)}
                className={`${isCameraActive ? 'text-cyan-500 bg-cyan-950/30 shadow-[0_0_15px_rgba(0,242,255,0.3)]' : 'text-cyan-900'} hover:bg-cyan-900/10 h-10 w-10 flex items-center justify-center cursor-pointer transition-all duration-300 rounded-none border-none bg-transparent`}
              >
                {isCameraActive ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>

              <button
                onClick={toggleOfflineMode}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleOfflineMode()}
                className={`${isOffline ? 'text-orange-500 bg-orange-950/30 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'text-cyan-900'} hover:bg-cyan-900/10 h-10 w-10 flex items-center justify-center cursor-pointer transition-all duration-300 rounded-none border-none bg-transparent`}
              >
                <Zap className={`w-6 h-6 ${isOffline ? 'fill-orange-500' : ''}`} />
              </button>

              <div className="flex gap-1 h-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-cyan-900 h-10 w-10 hover:bg-cyan-600/10"
                  onClick={handleClearChat}
                >
                  <RotateCcw className="w-5 h-5 text-red-900" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-cyan-900 h-10 w-10 hover:bg-cyan-600/10"
                >
                  {isMuted ? <VolumeX className="w-6 h-6 border-red-500" /> : <Volume2 className="w-6 h-6" />}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Bento Grid - HUD Redesign */}
        <main className="bento-grid flex-grow relative">
          {/* HUD Decorative Corners */}
          <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-cyan-500/50 pointer-events-none" />
          <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-cyan-500/50 pointer-events-none" />
          <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-cyan-500/50 pointer-events-none" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-cyan-500/50 pointer-events-none" />

          {/* AI Center Hub */}
          <div className="bento-card bento-hero border-cyan-600/30">
            <VenomCore 
              isThinking={isThinking} 
              isSpeaking={isSpeaking} 
              isListening={isListening} 
              isLiveSession={isLiveSession}
              isOffline={isOffline}
              wakeWordStatus={wakeWordStatus}
              accentColorOverride={currentThemeColor()}
            />
            <div className="text-center mt-4">
              <h2 className="text-3xl font-black mb-1 tracking-widest italic text-[var(--accent)] uppercase glow-text">
                {isScanning ? "Scanning..." : isListening ? "Listening..." : isThinking ? "Processing..." : isSpeaking ? "Transmitting..." : "Awaiting Command"}
              </h2>
              <p className="text-[var(--text-secondary)] text-[10px] font-black tracking-[0.6em] uppercase">{isScanning ? 'Vision Analysis Mode' : 'Neural Core Optimized'}</p>
            </div>
          </div>

          {/* Neural Profile Switcher */}
          <HoloCard label="Neural_Configuration">
            <div className="flex flex-col gap-4 h-full py-2">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cyan', label: 'Cyan_V4', color: 'bg-[#00f2ff]' },
                  { id: 'crimson', label: 'Crimson', color: 'bg-red-500' },
                  { id: 'void', label: 'Void', color: 'bg-purple-500' },
                  { id: 'forest', label: 'Forest', color: 'bg-emerald-500' }
                ].map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => {
                      setHudProfile(profile.id as any);
                      speak(`Neural profile switched to ${profile.label}.`);
                    }}
                    className={`flex items-center gap-3 p-2 border border-[var(--border)] transition-all ${hudProfile === profile.id ? 'bg-[var(--accent)] text-black' : 'hover:bg-[var(--accent)]/10 text-[var(--accent)]'} rounded-none group`}
                  >
                    <div className={`w-3 h-3 ${profile.color} ${hudProfile === profile.id ? 'ring-2 ring-black' : ''}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5">{profile.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-auto pt-2 border-t border-[var(--border)] flex flex-col gap-1">
                <div className="flex justify-between text-[8px] font-mono text-[var(--text-secondary)]">
                  <span>HOLO_PERSPECTIVE</span>
                  <span>94.2%</span>
                </div>
                <div className="w-full h-1 bg-[var(--accent-muted)] overflow-hidden">
                  <motion.div 
                    animate={{ width: ["0%", "94%", "93%", "95%", "94%"] }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="h-full bg-[var(--accent)]" 
                  />
                </div>
              </div>
            </div>
          </HoloCard>

          {/* Synaptic_Buffer */}
          <HoloCard label="Synaptic_Buffer" gridClass="md:row-span-1">
            <div className="flex flex-col h-full gap-2 pt-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[7px] font-mono text-[var(--text-secondary)] uppercase tracking-tighter">Large_Text_Ingest</span>
                <span className="text-[7px] font-mono text-[var(--text-secondary)] italic">{synapticBuffer.length} chars</span>
              </div>
              <textarea
                value={synapticBuffer}
                onChange={(e) => setSynapticBuffer(e.target.value)}
                placeholder="DUMP NEURAL DATA HERE..."
                className="flex-1 bg-black/40 border border-[var(--border)] text-[10px] font-mono p-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none resize-none placeholder:text-[var(--text-secondary)]/50 selection:bg-[var(--accent)]/30"
              />
              <div className="flex gap-1 h-8">
                <Button 
                  onClick={handleIngestBuffer}
                  disabled={!synapticBuffer.trim()}
                  variant="ghost" 
                  className="flex-1 text-[9px] border border-[var(--border)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black uppercase font-black rounded-none disabled:opacity-30"
                >
                  <Zap className="w-3 h-3 mr-2" />
                  Ingest
                </Button>
                <Button 
                  onClick={() => setSynapticBuffer('')}
                  variant="ghost" 
                  className="w-10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-black uppercase font-black rounded-none"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </HoloCard>

          {/* Programs List - Top Right */}
          <div className="bento-card col-span-1 row-span-1">
            <span className="bento-card-label">Programs</span>
            <div className="flex flex-col gap-2 mt-2">
              {['Gmail', 'Wikipedia', 'GTU', 'SSASIT', 'LinkedIn', 'Torrentz'].map((prog) => (
                <div key={prog} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-[10px] font-black text-cyan-900 group-hover:text-cyan-400 transition-colors uppercase tracking-widest">{prog}</span>
                  <div className="w-2 h-2 rounded-full border border-cyan-600 group-hover:bg-cyan-500" />
                </div>
              ))}
            </div>
          </div>

          {/* Environment */}
          <HoloCard label="Atmosphere">
            <div className="flex justify-between items-center h-full">
              <div className="text-5xl font-black italic text-cyan-600 glow-text">18&deg;</div>
              <div className="text-right">
                <div className="text-sm font-black uppercase text-cyan-500">Stormy</div>
                <div className="bento-stat-sub">H: 21&deg; L: 14&deg;</div>
              </div>
            </div>
          </HoloCard>

          {/* Metrics */}
          <HoloCard label="Neural_Load_Analysis" gridClass="col-span-2">
            <div className="h-full w-full pt-4">
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={metricsData}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={currentThemeColor()} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={currentThemeColor()} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={[0, 100]} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#000', border: '1px solid var(--border)', fontSize: '10px', fontFamily: 'monospace' }}
                    itemStyle={{ color: 'var(--accent)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cpu" 
                    stroke={currentThemeColor()} 
                    fillOpacity={1} 
                    fill="url(#colorCpu)" 
                    isAnimationActive={false}
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="mem" 
                    stroke="#1e3a8a" 
                    fill="none" 
                    isAnimationActive={false}
                    strokeWidth={1}
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-2 px-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]" />
                  <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase">CPU: {metricsData[metricsData.length-1]?.cpu || 0}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-900 border border-blue-500" />
                  <span className="text-[9px] font-black text-cyan-900 uppercase">MEM: {metricsData[metricsData.length-1]?.mem || 0}%</span>
                </div>
              </div>
            </div>
          </HoloCard>

          {/* Weather Gauge - Bottom Right */}
          <HoloCard label="Atmospheric Analysis">
            <div className="flex flex-col items-center justify-center h-full relative">
              <div className="text-4xl font-black text-cyan-600 glow-text">30&deg;</div>
              <div className="text-[10px] font-black text-cyan-900 uppercase tracking-widest mt-1">Mostly Cloudy</div>
              <svg className="absolute w-24 h-24 -rotate-90 opacity-30">
                <circle cx="50%" cy="50%" r="40%" fill="none" stroke="currentColor" strokeWidth="4" className="text-cyan-900" />
                <circle cx="50%" cy="50%" r="40%" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="180 360" className="text-cyan-500" />
              </svg>
            </div>
          </HoloCard>

          {/* Messages */}
          <HoloCard label="Neural Streams" gridClass="bento-tall border-[var(--border)]">
            <ScrollArea className="flex-1 -mx-2 px-2" ref={scrollRef}>
              <div className="space-y-6 py-4">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-10 py-24">
                    <Cpu className="w-16 h-16 text-[var(--accent)] mb-4" />
                    <p className="text-sm font-black uppercase tracking-[0.6em]">Void_Detected</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-1 h-4 ${msg.role === 'user' ? 'bg-[var(--text-secondary)]' : 'bg-[var(--accent)]'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-[var(--text-secondary)]' : 'text-[var(--accent)]'}`}>
                          {msg.role === 'user' ? 'Prey' : 'Venom'}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed p-4 rounded-none border-l-2 ${msg.role === 'user' ? 'bg-[var(--accent-muted)] border-[var(--text-secondary)] text-[var(--text-primary)]' : 'bg-[var(--accent)]/5 border-[var(--accent)] text-white italic'}`}>
                        {msg.role === 'model' && i === messages.length - 1 ? (
                          <Typewriter text={msg.text} delay={8} />
                        ) : (
                          msg.text
                        )}
                      </p>
                      {msg.imageUrl && (
                        <div className="mt-2 border border-cyan-500/30 overflow-hidden bg-black/40 p-1">
                          <img src={msg.imageUrl} alt="Venom Synthesis" className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-700 brightness-75 hover:brightness-100" referrerPolicy="no-referrer" />
                          <div className="flex items-center gap-2 mt-2 px-2 pb-1">
                            <ImageIcon className="w-3 h-3 text-cyan-500" />
                            <span className="text-[9px] font-black text-cyan-700 uppercase tracking-tighter">Neural Image Output</span>
                          </div>
                        </div>
                      )}
                      {msg.videoUrl && (
                        <div className="mt-2 border border-cyan-500/30 overflow-hidden bg-black/40 p-1">
                          <video src={msg.videoUrl} controls className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-700 brightness-75 hover:brightness-100" />
                          <div className="flex items-center gap-2 mt-2 px-2 pb-1">
                            <Video className="w-3 h-3 text-cyan-500" />
                            <span className="text-[9px] font-black text-cyan-700 uppercase tracking-tighter">Veo 3 Neural Motion</span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isThinking && (
                  <div className="flex gap-2 p-4">
                    <span className="w-2 h-2 bg-cyan-600 animate-pulse" />
                    <span className="w-2 h-2 bg-cyan-600 animate-pulse [animation-delay:0.2s]" />
                    <span className="w-2 h-2 bg-cyan-600 animate-pulse [animation-delay:0.4s]" />
                  </div>
                )}
              </div>
            </ScrollArea>
          </HoloCard>

          {/* Code Vault Column */}
          <HoloCard label="Code_Vault" gridClass="bento-tall border-cyan-600/20 col-span-2">
            <ScrollArea className="flex-1 -mx-2 px-2" ref={codeScrollRef}>
              <div className="space-y-6 py-4">
                {codeVault.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-10 py-24">
                    <Terminal className="w-16 h-16 text-cyan-600 mb-4" />
                    <p className="text-sm font-black uppercase tracking-[0.6em]">Vault_Empty</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {codeVault.map((snippet, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col gap-2 border border-cyan-600/20 bg-black/40 p-4"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-cyan-500 tracking-widest">{snippet.language}</span>
                        <span className="text-[9px] text-cyan-900 font-mono">{snippet.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <pre className="text-[11px] leading-relaxed text-cyan-100 overflow-x-auto font-mono p-2 bg-cyan-950/10 border-l border-cyan-600">
                        <code>{snippet.code}</code>
                      </pre>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="self-end text-[9px] h-6 px-2 text-cyan-500 hover:bg-cyan-600 hover:text-black rounded-none uppercase font-black"
                        onClick={() => navigator.clipboard.writeText(snippet.code)}
                      >
                        Copy_Source
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </HoloCard>

          <HoloCard label="Visual_Repository" gridClass="bento-tall border-cyan-600/20">
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-4 py-4">
                {visualVault.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-10 py-12">
                    <ImageIcon className="w-12 h-12 text-cyan-600 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">Gallery_Empty</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {visualVault.map((asset) => (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="border border-cyan-600/20 bg-black/40 p-2 space-y-2 group"
                    >
                      <div className="relative aspect-square overflow-hidden border border-cyan-900/30 bg-black flex items-center justify-center">
                        {asset.type === 'image' ? (
                          <img 
                            src={asset.url} 
                            alt="Neural Synthesis" 
                            className="w-full h-full object-cover transition-all group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <video 
                            src={asset.url} 
                            controls
                            className="w-full h-full object-contain"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 pointer-events-none" />
                        {asset.type === 'video' && (
                          <div className="absolute top-2 right-2 bg-black/80 px-1.5 py-0.5 border border-cyan-500/30 text-[8px] text-cyan-400 font-bold uppercase tracking-widest">
                            Video
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] text-cyan-900 font-mono text-center">{asset.timestamp.toLocaleTimeString()}</span>
                        <div className="grid grid-cols-3 gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[8px] h-6 px-0 text-cyan-500 hover:bg-cyan-600 hover:text-black rounded-none uppercase font-black"
                            onClick={() => asset.type === 'image' ? downloadImage(asset.url, 'png', `venom_visual_${asset.id}`) : window.open(asset.url)}
                          >
                            {asset.type === 'image' ? 'PNG' : 'MP4'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[8px] h-6 px-0 text-cyan-500 hover:bg-cyan-600 hover:text-black rounded-none uppercase font-black"
                            onClick={() => asset.type === 'image' ? downloadImage(asset.url, 'jpeg', `venom_visual_${asset.id}`) : window.open(asset.url)}
                          >
                            {asset.type === 'image' ? 'JPG' : 'OPEN'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[8px] h-6 px-0 text-cyan-500 hover:bg-cyan-600 hover:text-black rounded-none uppercase font-black"
                            onClick={() => asset.type === 'image' ? downloadImage(asset.url, 'pdf', `venom_visual_${asset.id}`) : window.open(asset.url)}
                          >
                            {asset.type === 'image' ? 'PDF' : 'LINK'}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </HoloCard>

          {/* Activity - Mission Chronometer */}
          <HoloCard label="Mission_Chronometer" gridClass="bento-tall border-cyan-600/20">
            {wakeWordStatus === 'error' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-2 mt-4 p-4 bg-orange-950/20 border border-orange-600/40 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3 text-orange-500">
                  <AlertCircle className="w-5 h-5 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Neural_Link_Severed</span>
                </div>
                <p className="text-[9px] text-orange-700 font-mono leading-relaxed">
                  Microphone access is restricted. The beast cannot hear your commands.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-8 text-[9px] font-black uppercase tracking-widest border-orange-600/50 text-orange-500 hover:bg-orange-600 hover:text-black rounded-none"
                  onClick={() => requestPermission()}
                >
                  Re-establish_Link
                </Button>
              </motion.div>
            )}

            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-4 py-4">
                {tasks.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-10 py-12">
                    <Zap className="w-12 h-12 text-cyan-600 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">No_Missions</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {tasks.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ 
                        opacity: task.status === 'completed' ? 0.6 : 1, 
                        x: 0,
                        backgroundColor: task.status === 'completed' ? 'rgba(8, 51, 68, 0.2)' : 'rgba(8, 51, 68, 0.4)',
                        borderLeftColor: task.status === 'completed' ? 'rgba(8, 51, 68, 0.8)' : '#06b6d4'
                      }}
                      className={`p-3 border-l-2 relative group overflow-hidden`}
                    >
                      {task.status === 'completed' && (
                        <motion.div 
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                        >
                          <CheckCircle2 className="w-12 h-12 text-cyan-500/20" />
                        </motion.div>
                      )}
                      
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${task.status === 'completed' ? 'text-cyan-900 line-through decoration-cyan-700' : 'text-cyan-400'}`}>
                          {task.title}
                        </span>
                        <div className="flex items-center gap-2">
                          {task.status === 'completed' && <Check className="w-3 h-3 text-cyan-600" />}
                          <Badge variant="outline" className={`text-[8px] h-4 rounded-none border-cyan-900 text-cyan-700 uppercase`}>
                            {task.priority || 'NORMAL'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-[9px] text-cyan-700 font-mono mb-2">
                        DUE: {task.dueAt?.toDate ? task.dueAt.toDate().toLocaleString() : new Date(task.dueAt).toLocaleString()}
                      </div>
                      {task.status === 'pending' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full h-6 text-[8px] font-black uppercase tracking-widest text-cyan-600 hover:bg-cyan-600 hover:text-black rounded-none border border-cyan-600/20 z-20"
                          onClick={() => handleCompleteMission(task.id!, task.title)}
                        >
                          Complete_Mission
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </HoloCard>

          <HoloCard label="Neural_Voice_Protocol">
            <VoiceSettings 
              settings={voiceSettings}
              onSettingsChange={setVoiceSettings}
              availableVoices={availableVoices}
              onTestVoice={() => speak("Neural link check. Audio transmission at optimal frequency.")}
            />
          </HoloCard>

          {/* Chat Input (Wide) - NOW TALLER WITH SHIFT+ENTER SUPPORT */}
          <HoloCard gridClass="bento-wide !p-0 overflow-hidden min-h-[100px] border-cyan-600/40">
            <div className="flex h-full">
              <div className="flex-1 relative">
                <textarea
                  autoFocus
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault(); 
                      handleSendMessage(inputText);
                    }
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const start = e.currentTarget.selectionStart;
                      const end = e.currentTarget.selectionEnd;
                      const value = e.currentTarget.value;
                      setInputText(value.substring(0, start) + "\t" + value.substring(end));
                      setTimeout(() => {
                        (e.target as HTMLTextAreaElement).setSelectionRange(start + 1, start + 1);
                      }, 0);
                    }
                  }}
                  placeholder="Enter command... (Shift + Enter for new line)"
                  className="w-full h-full bg-black/40 border border-cyan-500/10 focus:border-cyan-500/50 focus:outline-none text-white placeholder:text-[var(--text-secondary)]/50 pl-6 pr-32 pt-4 text-sm resize-none relative z-50 transition-all"
                />
                
                {/* Action Buttons (Repositioned to top-right of the box) */}
                <div className="absolute right-3 top-3 flex gap-1 bg-[var(--card-bg)] rounded-md">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handlePasteFromClipboard}
                    title="Paste from clipboard"
                    className="h-8 w-8 text-cyan-700 hover:text-cyan-400 hover:bg-cyan-500/10"
                  >
                    <Clipboard className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={startListening}
                    className={`h-8 w-8 ${isListening ? 'text-red-500 bg-red-500/10' : 'text-[var(--accent)]'} hover:bg-[var(--accent)]/10`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsMuted(!isMuted)}
                    className="h-8 w-8 text-[var(--text-secondary)] hover:bg-white/5"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              
              {/* Execute Button */}
              <Button 
                onClick={() => handleSendMessage(inputText)}
                disabled={!inputText.trim() || isThinking}
                className="h-full px-8 rounded-none bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-black font-bold uppercase tracking-widest text-xs"
              >
                <Send className="w-4 h-4 mr-2" />
                Execute
              </Button>
            </div>
          </HoloCard>

          {/* Camera */}
          <HoloCard label="Optical Kill_Link">
            <div className="flex-1 mt-4 grayscale contrast-125 brightness-75 border border-cyan-900/30">
              <CameraFeed 
                isActive={isCameraActive} 
                isScanning={isScanning}
                onCapture={handleNeuralEyeScan}
              />
            </div>
          </HoloCard>
        </main>

        {/* Footer */}
      </div>

      {/* Key Selection Overlay */}
      {showKeyRequest && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <div className="max-w-md w-full bento-card border-cyan-500/50 p-8 text-center">
            <Shield className="w-16 h-16 text-[var(--accent)] mx-auto mb-6" />
            <h2 className="text-2xl font-black italic uppercase tracking-widest text-[var(--accent)] glow-text mb-4">Neural Override Required</h2>
            <p className="text-sm text-cyan-500/80 font-mono mb-8 leading-relaxed">
              High-fidelity video synthesis utilizes premium neural cores. Please authorize a Paid Google Cloud API Key to bridge the transmission.
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={async () => {
                  await window.aistudio.openSelectKey();
                  setShowKeyRequest(false);
                  saveVenomResponse("Neural link authorized. Standing by for video synthesis command.");
                }}
                className="w-full bg-[var(--accent)] text-black font-black uppercase tracking-widest py-6 rounded-none hover:bg-[var(--accent)]/80"
              >
                Authorize Paid Key
              </Button>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noreferrer"
                className="text-[10px] text-cyan-700 hover:text-cyan-500 uppercase tracking-tighter"
              >
                Billing Documentation -{'>'}
              </a>
              <Button 
                variant="ghost" 
                onClick={() => setShowKeyRequest(false)}
                className="mt-2 text-red-500/50 hover:text-red-500 text-xs font-mono"
              >
                Abort Protocol
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* System Ticker */}
      <div className="fixed bottom-0 left-0 w-full h-6 bg-black/80 border-t border-[var(--border)] overflow-hidden z-[110] backdrop-blur-md flex items-center pointer-events-none">
        <div className="flex whitespace-nowrap animate-marquee px-4 items-center gap-12 text-[var(--text-secondary)]">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-12 text-[10px] font-mono font-black uppercase tracking-widest">
              <span>MEM_SYNC: 98% [OK]</span>
              <span>NEURAL_ITERATION: 44.2ms</span>
              <span>CORE_TEMP: 32°C</span>
              <span>UPLINK: STABLE</span>
              <span>ENCRYPTION: QUANTUM_AES</span>
              <span>VOID_PROTOCOL: ACTIVE</span>
              <span>LATENCY: 0.12ms</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
