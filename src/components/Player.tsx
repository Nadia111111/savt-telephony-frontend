'use client';

import React from 'react';
import { useAudioPlayer } from './AudioPlayerContext';
import { formatDuration, formatDateTimeFull } from '@/lib/date-utils';
import { Play, Pause, RotateCcw, RotateCw, X, AlertCircle } from 'lucide-react';

export default function Player() {
  const {
    currentCall,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    audioError,
    togglePlay,
    seek,
    changeSpeed,
    closePlayer,
  } = useAudioPlayer();

  if (!currentCall) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    seek(pct * duration);
  };

  const callerNumber = currentCall.caller || currentCall.caller_raw || 'Не определён';
  const startedAtFormatted = formatDateTimeFull(currentCall.started_at);

  return (
    <div className="player-container">
      <div className="player-controls">
        <button
          onClick={() => seek(Math.max(0, currentTime - 5))}
          title="Назад на 5 секунд"
        >
          <RotateCcw size={18} />
        </button>

        <button
          onClick={togglePlay}
          className="play-btn"
          title={isPlaying ? 'Пауза' : 'Воспроизведение'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
        </button>

        <button
          onClick={() => seek(Math.min(duration, currentTime + 5))}
          title="Вперёд на 5 секунд"
        >
          <RotateCw size={18} />
        </button>

        <button
          onClick={changeSpeed}
          className="speed"
          title="Скорость воспроизведения"
        >
          ×{playbackRate}
        </button>
      </div>

      <div className="player-progress">
        <span className="timecode">{formatDuration(Math.floor(currentTime))}</span>
        <div className="track" onClick={handleTrackClick}>
          <div
            className="track-fill"
            style={{ width: `${progressPercent}%`, transition: isPlaying ? 'none' : 'width .15s' }}
          />
        </div>
        <span className="timecode">{formatDuration(Math.floor(duration))}</span>
      </div>

      <div className="player-info">
        {audioError ? (
          <span style={{ color: 'var(--miss)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={14} /> {audioError}
          </span>
        ) : (
          <>
            <span className="call-num">{callerNumber}</span> · {startedAtFormatted}
          </>
        )}
      </div>

      <button
        onClick={closePlayer}
        className="close-btn"
        title="Закрыть плеер"
        style={{ marginLeft: 'auto', border: 'none' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
