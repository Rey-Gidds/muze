import React from 'react';
import SongCard from './SongCard';
import { Sparkles, Layers } from 'lucide-react';

const PlaylistGrid = ({ recommendations }) => {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="w-full max-w-6xl mx-auto my-10 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
      
      {/* Grid Section Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-neutral-800/80">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
            Recommended Track Space
          </h2>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
            {recommendations.length} Selected Tracks
          </span>
        </div>

        <span className="text-xs font-mono text-neutral-500 hidden sm:inline">
          Constrained by FAI Multi-Objective Agent
        </span>
      </div>

      {/* Responsive Standard / Masonry-style Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {recommendations.map((track, index) => (
          <SongCard
            key={track.track_id || index}
            track={track}
            index={index}
          />
        ))}
      </div>

    </div>
  );
};

export default PlaylistGrid;