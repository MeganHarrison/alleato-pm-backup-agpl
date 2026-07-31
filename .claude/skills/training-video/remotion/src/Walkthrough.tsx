import React from 'react';
import {
  AbsoluteFill, OffthreadVideo, Sequence, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, spring,
} from 'remotion';
import { WalkthroughProps } from './schema';

const SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

const CaptionPill: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inOp = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, 8], [12, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 64 }}>
      <div style={{
        opacity: inOp, transform: `translateY(${y}px)`,
        maxWidth: '78%', padding: '16px 28px', borderRadius: 16,
        background: 'rgba(17,17,19,.92)', color: '#fff',
        font: `500 30px/1.35 ${SANS}`, textAlign: 'center',
        boxShadow: '0 10px 34px rgba(0,0,0,.4)',
      }}>{text}</div>
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <AbsoluteFill style={{
      justifyContent: 'center', alignItems: 'center', gap: 16,
      background: 'linear-gradient(135deg,#0b0b0f,#1a1a24)', opacity: out,
    }}>
      <div style={{ transform: `translateY(${(1 - s) * 12}px)`, opacity: s, font: `700 68px/1.1 ${SANS}`, color: '#fff', letterSpacing: '-1px' }}>{title}</div>
      <div style={{ opacity: s * 0.72, font: `400 30px/1.4 ${SANS}`, color: '#fff' }}>{subtitle}</div>
    </AbsoluteFill>
  );
};

export const Walkthrough: React.FC<WalkthroughProps> = ({ footage, title, captions, frame }) => {
  const { fps, width } = useVideoConfig();
  const titleFrames = Math.round(title.holdSec * fps);
  const cardW = width - frame.padPx * 2;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg,${frame.color0},${frame.color1})` }}>
      {/* Footage (framed) starts after the title card */}
      <Sequence from={titleFrames}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: cardW, borderRadius: frame.radiusPx, overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,.55)' }}>
            <OffthreadVideo src={staticFile(footage)} style={{ width: '100%', display: 'block' }} />
          </div>
        </AbsoluteFill>
        {/* Captions — timed relative to the footage */}
        {captions.map((c, i) => (
          <Sequence key={i} from={Math.round(c.fromSec * fps)} durationInFrames={Math.round(c.durationSec * fps)}>
            <CaptionPill text={c.text} />
          </Sequence>
        ))}
      </Sequence>

      {/* Intro title card */}
      <Sequence durationInFrames={titleFrames}>
        <TitleCard title={title.title} subtitle={title.subtitle} />
      </Sequence>
    </AbsoluteFill>
  );
};
