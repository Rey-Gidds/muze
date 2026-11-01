import React from 'react';
import { Disc3, Radio } from 'lucide-react';

const SongCard = ({ track, index }) => {
  const similarityPct = (track.similarity * 100).toFixed(1);
  const divDistFormatted = track.div_dist ? track.div_dist.toFixed(3) : '0.150';
  const tierNumber = track.fai_tier ?? 0;

  return (
    <div className="relative group overflow-hidden rounded-2xl bg-neutral-900/50 backdrop-blur-md border border-neutral-800/80 p-5 shadow-lg hover:border-neutral-700/90 hover:bg-neutral-900/80 transition-all duration-300 hover:-translate-y-0.5">
      
      {/* Top Header: Track Title & Artist */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          {/* Track Title (bold, prominent) */}
          <h3 className="font-bold text-base sm:text-lg text-white tracking-tight truncate group-hover:text-indigo-200 transition-colors">
            {track.title}
          </h3>

          {/* Artist Name (subtle) */}
          <p className="text-xs sm:text-sm text-neutral-400 truncate mt-0.5 font-normal">
            {track.artist}
          </p>
        </div>

        {/* Index / Vinyl Icon Accent */}
        <div className="w-8 h-8 rounded-xl bg-neutral-800/70 border border-neutral-700/50 flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-indigo-400 group-hover:border-indigo-500/40 transition-colors">
          <Disc3 className="w-4 h-4" />
        </div>
      </div>

      {/* Badges Section */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-neutral-800/60">
        
        {/* ML Similarity % Badge (in green) */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>{similarityPct}% Sim</span>
        </span>

        {/* FAI Diversity Distance & Selection Tier Badge (in purple/amber) */}
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium text-purple-300 bg-purple-950/50 border border-purple-800/50 shadow-xs">
          <span className="flex items-center gap-1">
            <span className="text-neutral-400 text-[10px]">DIV:</span>
            <span>{divDistFormatted}</span>
          </span>
          <span className="text-neutral-500">•</span>
          <span className={`text-xs ${tierNumber === 0 ? 'text-amber-300 font-semibold' : 'text-amber-400'}`}>
            Tier {tierNumber}
          </span>
        </span>

      </div>

      {/* Subtle bottom hover line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/0 via-indigo-500/40 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

    </div>
  );
};

export default SongCard;