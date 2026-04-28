import { useState, useCallback, useEffect, useRef } from 'react';

export type WakeWordStatus = 'idle' | 'listening' | 'detected' | 'error';

export interface VoiceOptions {
  wakeWords?: string[];
  onWakeWord?: () => void;
  lang?: string;
  pitch?: number;
  rate?: number;
  voiceName?: string;
  profileId?: string;
}

export const useVoice = (options: VoiceOptions = {}) => {
  const { 
    wakeWords = ['wake up venom', 'hey venom', 'hello venom', 'venom wake up', 'system start', 'venom online'],
    onWakeWord,
    lang = 'en-US',
    pitch = 1.0,
    rate = 1.0,
    voiceName = '',
    profileId = 'default'
  } = options;

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const updateVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [wakeWordStatus, setWakeWordStatus] = useState<WakeWordStatus>('idle');
  
  const wakeWordRecognitionRef = useRef<any>(null);
  const manualRecognitionRef = useRef<any>(null);
  const shouldBeDetectingRef = useRef(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef(false);
  const hasInteractedRef = useRef(false);

  // Wake Word Detection
  const startWakeWordDetection = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Neural Link Failure: SpeechRecognition API missing. Use a modern browser (Chrome/Edge/Safari).");
      setWakeWordStatus('error');
      return;
    }

    console.log("Neural Link: Initializing wake word recognition...");
    if (wakeWordRecognitionRef.current) {
      try {
        wakeWordRecognitionRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      console.log("Neural Link: Link established. Listening for wake phrases.");
      setWakeWordStatus('listening');
      shouldBeDetectingRef.current = true;
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      const text = lastResult[0].transcript.toLowerCase().trim();
      
      // Check for wake words with improved robustness (contains check)
      const detected = wakeWords.some(word => text.includes(word.toLowerCase()));

      if (detected) {
        setWakeWordStatus('detected');
        if (onWakeWord) {
          onWakeWord();
        }
        // Stop wake word detection while processing/listening to command
        stopWakeWordDetection();
      }
    };

    recognition.onend = () => {
      // Restart if it should still be active and wasn't stopped manually
      if (shouldBeDetectingRef.current) {
        // Use a small delay to avoid rapid restart loops on errors
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          try {
            if (shouldBeDetectingRef.current) {
              recognition.start();
            }
          } catch (e) {
            console.warn("Failed to restart wake word detection:", e);
            setWakeWordStatus('error');
          }
        }, 300);
      } else {
        setWakeWordStatus('idle');
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        console.warn("Neural Link: Permission withheld or blocked.", event.error);
        shouldBeDetectingRef.current = false;
        
        // If not-allowed happens without interaction, it's just the browser blocking auto-start.
        if (!hasInteractedRef.current) {
           console.log("Neural Link: Auto-start blocked by browser. Awaiting user interaction.");
           setWakeWordStatus('idle');
        } else {
           setWakeWordStatus('error');
           const isIframe = window.self !== window.top;
           console.warn(`Neural Link: Permission ${event.error}. ${isIframe ? 'Note: App is running in an iframe, ensure browser permissions allow microphone for this domain.' : 'Please check browser settings.'}`);
        }
      } else if (event.error === 'network') {
        console.error("Wake word network error:", event.error);
        setWakeWordStatus('error');
        setTimeout(() => {
          if (wakeWordStatus === 'error') setWakeWordStatus('idle');
        }, 5000);
      } else if (event.error === 'no-speech') {
        // Silent error
      } else {
        console.error("Wake word detection error:", event.error);
        setWakeWordStatus('error');
      }
    };

    wakeWordRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      setWakeWordStatus('error');
    }
  }, [onWakeWord, wakeWords, lang]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined') return false;

    // Track interaction to allow showing error states
    hasInteractedRef.current = true;

    // Reset status to attempt a clean start
    setWakeWordStatus('idle');
    shouldBeDetectingRef.current = true;

    // Direct start is often better for triggering browser permission prompts
    // than a pre-flight getUserMedia check which can lose gesture context.
    try {
      console.log("Direct neural link initialization triggered...");
      startWakeWordDetection();
      return true;
    } catch (e) {
      console.error("Neural link direct start failed, falling back to media devices:", e);
      
      // Fallback to manual getUserMedia if direct start fails
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          startWakeWordDetection();
          return true;
        } catch (mediaError) {
          console.error("Neural link hardware access denied:", mediaError);
          setWakeWordStatus('error');
          return false;
        }
      }
      
      setWakeWordStatus('error');
      return false;
    }
  }, [startWakeWordDetection]);

  const stopWakeWordDetection = useCallback(() => {
    shouldBeDetectingRef.current = false;
    setWakeWordStatus('idle');
    if (wakeWordRecognitionRef.current) {
      try {
        wakeWordRecognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  const stopManualListening = useCallback(() => {
    setIsListening(false);
    if (manualRecognitionRef.current) {
      try {
        manualRecognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      manualRecognitionRef.current = null;
    }
  }, []);

  // Speech Recognition (Manual Command)
  const startListening = useCallback(() => {
    hasInteractedRef.current = true;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported in this browser.");
      return;
    }

    if (manualRecognitionRef.current) {
      stopManualListening();
    }

    // Ensure wake word detection is paused
    const wasWakeWordActive = shouldBeDetectingRef.current;
    if (wasWakeWordActive) {
      stopWakeWordDetection();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true; // Use interim results for "Live" feel
    recognition.lang = lang;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        setTranscript(finalTranscript);
        // Force stop once we have a final result to trigger the cycle in App.tsx
        recognition.stop();
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      manualRecognitionRef.current = null;
      // We don't restart wake word detection here anymore. 
      // It's better to let the App.tsx loop or manual wake word toggle handle it.
    };

    recognition.onerror = (event: any) => {
      console.error("Command recognition error:", event.error);
      setIsListening(false);
      manualRecognitionRef.current = null;
    };

    manualRecognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start command recognition:", e);
      setIsListening(false);
      manualRecognitionRef.current = null;
    }
  }, [stopWakeWordDetection, startWakeWordDetection, stopManualListening, lang]);

  // Text to Speech
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      console.error("Speech synthesis not supported.");
      return;
    }

    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // 1. Try to find user selected voice by name
    let preferredVoice = voiceName ? voices.find(v => v.name === voiceName) : null;
    
    // 2. If no voice selected, or if we want to auto-select based on profile
    if (!preferredVoice) {
      // Logic for picking a voice based on persona/profile
      const isIndo = lang === 'hi-IN';
      
      preferredVoice = voices.find(v => {
        // High quality hints
        const isHighQuality = v.name.includes('Premium') || v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google');
        const correctLang = v.lang.includes(isIndo ? 'hi' : 'en');
        
        if (!correctLang) return false;

        // Profile specific hints
        if (profileId === 'prime' || profileId === 'stealth') {
          // Prefer deep/male voices for "Venom Prime" and "Stealth"
          return isHighQuality && (v.name.includes('Male') || v.name.includes('Daniel') || v.name.includes('Guy') || v.name.includes('Rishi'));
        }
        
        if (profileId === 'synth' || profileId === 'berserker') {
          // Prefer crisp/mechanical or distinct voices
          return isHighQuality && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Aria') || v.name.includes('Google'));
        }

        return isHighQuality;
      }) || voices.find(v => v.lang.includes(lang.split('-')[0])) || voices[0];
    }
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    }
    
    // Settings from options
    utterance.pitch = pitch; 
    utterance.rate = rate; 
    utterance.volume = profileId === 'stealth' ? 0.6 : 0.9; 

    utterance.onstart = () => {
      setIsSpeaking(true);
      isSpeakingRef.current = true;
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  }, [voiceName, pitch, rate, lang]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWakeWordDetection();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopWakeWordDetection]);

  return {
    isListening,
    transcript,
    startListening,
    speak,
    isSpeaking,
    isSpeakingRef,
    setTranscript,
    wakeWordStatus,
    isWakeWordActive: wakeWordStatus === 'listening' || wakeWordStatus === 'detected',
    startWakeWordDetection,
    stopWakeWordDetection,
    requestPermission,
    availableVoices
  };
};
