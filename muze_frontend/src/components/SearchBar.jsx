import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Sparkles, Music } from 'lucide-react';
import { dummySearchResults } from '../dummyData';

const SearchBar = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Filter seed tracks based on query input
  const filteredSeeds = query.trim() === ''
    ? dummySearchResults
    : dummySearchResults.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.artist.toLowerCase().includes(query.toLowerCase())
      );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectTrack = (track) => {
    setQuery(`${track.title} — ${track.artist}`);
    setIsOpen(false);
    onSearch(track.track_id, track);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSeeds.length > 0) {
        handleSelectTrack(filteredSeeds[0]);
      } else if (query.trim()) {
        setIsOpen(false);
        onSearch('custom_seed', { title: query.trim(), artist: 'Custom Seed' });
      }
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl mx-auto">
      
      {/* Sleek, Centered, Oversized Glassmorphic Search Bar */}
      <div className="relative group transition-all duration-300">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-emerald-500/10 to-indigo-500/20 rounded-2xl blur-md opacity-40 group-focus-within:opacity-100 transition-opacity duration-500"></div>

        <div className="relative flex items-center bg-neutral-900/60 backdrop-blur-xl border border-neutral-800/80 rounded-2xl shadow-2xl transition-all duration-300 group-focus-within:border-indigo-500/60 group-focus-within:bg-neutral-900/80">
          {/* Search Icon */}
          <div className="pl-6 text-neutral-500 group-focus-within:text-indigo-400 transition-colors duration-200">
            <Search className="w-6 h-6" />
          </div>

          {/* Oversized Input */}
          <input
            type="text"
            className="w-full bg-transparent text-white placeholder-neutral-500 text-base sm:text-lg px-4 py-5 focus:outline-none font-normal"
            placeholder="Search seed track or artist to initialize FAI recommendation..."
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />

          {/* Action / Clear Badge */}
          <div className="pr-5 flex items-center gap-2">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-mono text-neutral-500 px-2 py-1 rounded bg-neutral-800/60 border border-neutral-700/50">
              Press ↵
            </span>
          </div>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-3 bg-neutral-900/90 backdrop-blur-2xl border border-neutral-800/90 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-neutral-800/50 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          
          <div className="px-5 py-2.5 bg-neutral-950/40 text-[11px] font-mono uppercase tracking-wider text-neutral-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Available Seed Tracks from 1.2M Corpus
            </span>
            <span>{filteredSeeds.length} results</span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-neutral-800/40">
            {filteredSeeds.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-neutral-500">
                No indexed seed found matching "{query}". Press Enter to run custom query.
              </div>
            ) : (
              filteredSeeds.map((track) => (
                <div
                  key={track.track_id}
                  onClick={() => handleSelectTrack(track)}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-neutral-800/60 cursor-pointer transition-colors duration-150 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700/60 flex items-center justify-center shrink-0 group-hover:border-indigo-500/40 transition-colors">
                      <Music className="w-4 h-4 text-neutral-400 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-white group-hover:text-indigo-300 transition-colors truncate">
                        {track.title}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">
                        {track.artist} {track.genre && `• ${track.genre}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono text-neutral-500 group-hover:text-neutral-400">
                      Select Seed →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default SearchBar;