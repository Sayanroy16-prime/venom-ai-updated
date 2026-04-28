import React from 'react';
import { Sliders, Volume2, ChevronRight, Settings, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface VoiceSettingsData {
  pitch: number;
  rate: number;
  voiceName: string;
  profileId?: 'default' | 'prime' | 'synth' | 'stealth' | 'berserker';
}

export const VENOM_PROFILES = [
  { id: 'default', name: 'System Default', description: 'Standard neural output' },
  { id: 'prime', name: 'Venom Prime', description: 'Deep, authoritative core', pitch: 0.8, rate: 0.95 },
  { id: 'synth', name: 'Synth Core', description: 'Technical, efficient processor', pitch: 1.1, rate: 1.1 },
  { id: 'stealth', name: 'Stealth Protocol', description: 'Low-frequency stealth comms', pitch: 0.7, rate: 0.8 },
  { id: 'berserker', name: 'Berserker Link', description: 'High-energy override', pitch: 1.2, rate: 1.4 },
] as const;

interface VoiceSettingsProps {
  settings: VoiceSettingsData;
  onSettingsChange: (settings: VoiceSettingsData) => void;
  availableVoices: SpeechSynthesisVoice[];
  onTestVoice: () => void;
}

export const VoiceSettings = ({ 
  settings, 
  onSettingsChange, 
  availableVoices,
  onTestVoice
}: VoiceSettingsProps) => {
  const handleProfileSelect = (profile: typeof VENOM_PROFILES[number]) => {
    if (profile.id === 'default') {
      onSettingsChange({ ...settings, profileId: 'default' });
    } else if ('pitch' in profile) {
      onSettingsChange({ 
        ...settings, 
        profileId: profile.id as any,
        pitch: profile.pitch!,
        rate: profile.rate!
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020505] border border-cyan-500/30 overflow-hidden shadow-[0_0_50px_rgba(0,242,255,0.1)]">
      {/* HUD Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-cyan-950/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-[0.3em] text-cyan-500 italic">Neural_Voice_Configuration</span>
        </div>
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
        {/* Venom Voice Profiles */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-cyan-500" />
            <label className="text-[10px] font-black uppercase tracking-widest text-cyan-500">Venom_Voice_Profiles</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {VENOM_PROFILES.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileSelect(profile)}
                className={`relative flex flex-col items-start p-2 border transition-all text-left group overflow-hidden ${
                  settings.profileId === profile.id 
                    ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.1)]' 
                    : 'bg-black/40 border-cyan-900/10 hover:border-cyan-600/30 hover:bg-cyan-950/5'
                }`}
              >
                <span className={`text-[9px] font-black uppercase tracking-tighter ${settings.profileId === profile.id ? 'text-cyan-400' : 'text-cyan-800'}`}>
                  {profile.name}
                </span>
                {settings.profileId === profile.id && (
                  <div className="absolute top-0 right-0 p-1">
                    <Check className="w-2 h-2 text-cyan-400" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Manual Modifiers */}
        <div className="space-y-4 pt-4 border-t border-cyan-900/10">
          <div className="flex items-center gap-2">
            <Sliders className="w-2 h-2 text-cyan-700" />
            <label className="text-[9px] font-black uppercase tracking-widest text-cyan-700">Neural_Modifiers</label>
          </div>
          
          <div className="space-y-4">
            {/* Pitch Control */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[8px] font-black tracking-widest text-cyan-800 uppercase">Pitch</label>
                <span className="text-[8px] font-mono text-cyan-500">{settings.pitch.toFixed(1)}Hz</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.05" 
                value={settings.pitch}
                onChange={(e) => onSettingsChange({ ...settings, pitch: parseFloat(e.target.value), profileId: undefined })}
                className="w-full accent-cyan-500 bg-cyan-950/30 h-[2px] appearance-none rounded-none cursor-pointer"
              />
            </div>

            {/* Rate Control */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[8px] font-black tracking-widest text-cyan-800 uppercase">Rate</label>
                <span className="text-[8px] font-mono text-cyan-500">{settings.rate.toFixed(1)}kps</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.05" 
                value={settings.rate}
                onChange={(e) => onSettingsChange({ ...settings, rate: parseFloat(e.target.value), profileId: undefined })}
                className="w-full accent-cyan-500 bg-cyan-950/30 h-[2px] appearance-none rounded-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="p-3 border-t border-cyan-500/10 bg-cyan-950/20 flex justify-between items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onTestVoice}
          className="h-7 text-[8px] font-black border border-cyan-600/30 text-cyan-500 hover:bg-cyan-600 hover:text-black rounded-none transition-all flex-1 mr-2"
        >
          <Volume2 className="w-3 h-3 mr-2" />
          Test_Sync
        </Button>
      </div>
    </div>
  );
};
