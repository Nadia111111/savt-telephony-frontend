'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { CallListItem } from '@/types/telephony';

type AudioKind = 'mix' | 'message' | 'client' | 'staff';

interface AudioPlayerContextType {
  currentCall: CallListItem | null;
  audioKind: AudioKind;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  audioError: string | null;
  audioUrl: string | null;
  playCall: (call: CallListItem, kind?: AudioKind) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  changeSpeed: () => void;
  setAudioKind: (kind: AudioKind) => void;
  closePlayer: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType>({
  currentCall: null,
  audioKind: 'mix',
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  audioError: null,
  audioUrl: null,
  playCall: () => {},
  togglePlay: () => {},
  seek: () => {},
  changeSpeed: () => {},
  setAudioKind: () => {},
  closePlayer: () => {},
});

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentCall, setCurrentCall] = useState<CallListItem | null>(null);
  const [audioKind, setAudioKindState] = useState<AudioKind>('mix');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioUrl = currentCall ? `/api/calls/${currentCall.id}/audio/${audioKind}` : null;

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setAudioError(null);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setAudioError('Запись недоступна');
      setIsPlaying(false);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  const playCall = (call: CallListItem, kind?: AudioKind) => {
    const selectedKind = kind || (call.has_recording ? 'mix' : call.has_message ? 'message' : 'mix');
    setCurrentCall(call);
    setAudioKindState(selectedKind);
    setAudioError(null);
    setCurrentTime(0);

    if (audioRef.current) {
      audioRef.current.src = `/api/calls/${call.id}/audio/${selectedKind}`;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.load();
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentCall) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        setAudioError('Запись недоступна');
      });
    }
  };

  const seek = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const changeSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const setAudioKind = (kind: AudioKind) => {
    if (!currentCall) return;
    setAudioKindState(kind);
    setAudioError(null);
    if (audioRef.current) {
      const wasPlaying = isPlaying;
      audioRef.current.src = `/api/calls/${currentCall.id}/audio/${kind}`;
      audioRef.current.load();
      if (wasPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  };

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setCurrentCall(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        currentCall,
        audioKind,
        isPlaying,
        currentTime,
        duration,
        playbackRate,
        audioError,
        audioUrl,
        playCall,
        togglePlay,
        seek,
        changeSpeed,
        setAudioKind,
        closePlayer,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  return useContext(AudioPlayerContext);
}
