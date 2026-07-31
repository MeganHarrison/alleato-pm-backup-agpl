import React from 'react';
import { Composition, staticFile } from 'remotion';
import { getVideoMetadata } from '@remotion/media-utils';
import { Walkthrough } from './Walkthrough';
import { walkthroughSchema, WalkthroughProps } from './schema';

const FPS = 30;

// Default props — edit any of this live in Remotion Studio's right sidebar
// (captions, intro words/length, frame color/padding) and see it instantly.
const defaultProps: WalkthroughProps = {
  footage: 'footage.mp4',
  title: { title: 'Create a Prime Contract', subtitle: 'Step-by-step in Alleato PM', holdSec: 1.6 },
  captions: [
    { text: 'Start on your projects home', fromSec: 0.4, durationSec: 1.7 },
    { text: 'Open the Prime Contracts tool', fromSec: 2.3, durationSec: 1.9 },
    { text: 'Open the Create Prime Contract form', fromSec: 4.4, durationSec: 1.6 },
    { text: 'Enter a contract number', fromSec: 6.1, durationSec: 1.3 },
    { text: 'Give it a descriptive title', fromSec: 7.5, durationSec: 1.4 },
    { text: 'Select the Owner / Client', fromSec: 8.9, durationSec: 1.3 },
    { text: 'Set the contract status', fromSec: 10.3, durationSec: 1.2 },
    { text: 'Add the description, then review', fromSec: 11.5, durationSec: 2.6 },
  ],
  frame: { padPx: 200, radiusPx: 28, color0: '#0e0e16', color1: '#20202f' },
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Walkthrough"
    component={Walkthrough}
    schema={walkthroughSchema}
    defaultProps={defaultProps}
    fps={FPS}
    width={1920}
    height={1210}
    durationInFrames={300}
    calculateMetadata={async ({ props }) => {
      const meta = await getVideoMetadata(staticFile(props.footage));
      const titleFrames = Math.round(props.title.holdSec * FPS);
      return { durationInFrames: titleFrames + Math.ceil(meta.durationInSeconds * FPS) };
    }}
  />
);
