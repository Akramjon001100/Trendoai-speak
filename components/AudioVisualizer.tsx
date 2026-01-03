import React, { useEffect, useRef } from 'react';
import { AudioVisualizerProps } from '../types';

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, isActive, color = '#3B82F6' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !analyser || !canvasRef.current) {
      if (canvasRef.current) {
         const ctx = canvasRef.current.getContext('2d');
         if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed buffer size for the analyser
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Simple bar visualizer centered
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;
      
      // Calculate average volume for a "breathing" circle effect in background
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      // Draw Breathing Circle
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 30 + average / 2, 0, 2 * Math.PI);
      ctx.fillStyle = `${color}33`; // low opacity
      ctx.fill();

      // Draw Bars
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        // Mirror effect for symmetry
        const distanceFromCenter = Math.abs((canvas.width / 2) - x);
        const opacity = Math.max(0.2, 1 - distanceFromCenter / (canvas.width / 2));

        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        
        // Draw centered bars
        const y = (canvas.height - barHeight) / 2;
        ctx.fillRect(x, y, barWidth, barHeight);

        x += barWidth + 1;
      }
      ctx.globalAlpha = 1.0;
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isActive, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={150} 
      className="w-full h-full max-w-[300px] max-h-[150px]"
    />
  );
};

export default AudioVisualizer;