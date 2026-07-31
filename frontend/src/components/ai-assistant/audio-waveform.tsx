"use client";

import { useEffect, useRef, useState } from "react";

interface AudioWaveformProps {
  isRecording: boolean;
  stream?: MediaStream | null;
}

export function AudioWaveform({ isRecording, stream }: AudioWaveformProps) {
  const [levels, setLevels] = useState<number[]>(Array(24).fill(0.1));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isRecording || !stream) {
      setLevels(
        Array(24)
          .fill(0)
          .map(() => 0.05 + Math.random() * 0.1),
      );
      historyRef.current = [];
      return;
    }

    const audioContext = new window.AudioContext();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);

    const updateLevels = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      for (const sample of dataArray) {
        const normalized = (sample - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / dataArray.length);
      const avgLevel = Math.max(0.15, Math.min(1, rms * 4));
      historyRef.current.unshift(avgLevel);

      if (historyRef.current.length > 12) {
        historyRef.current.pop();
      }

      const nextLevels = Array(24).fill(0.1);
      const center = 12;

      historyRef.current.forEach((level, index) => {
        const leftIndex = center - 1 - index;
        const rightIndex = center + index;

        if (leftIndex >= 0) nextLevels[leftIndex] = level;
        if (rightIndex < 24) nextLevels[rightIndex] = level;
      });

      setLevels(nextLevels);
      animationRef.current = requestAnimationFrame(updateLevels);
    };

    updateLevels();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    };
  }, [isRecording, stream]);

  return (
    <div className="flex h-8 flex-1 items-center justify-center gap-0.5 px-2">
      {levels.map((level, index) => (
        <div
          key={index}
          className="rounded-full bg-muted-foreground/50 transition-all duration-75"
          style={{
            width: "3px",
            height: `${Math.max(4, level * 28)}px`,
          }}
        />
      ))}
    </div>
  );
}
