import React, { useState } from 'react';
import { Search, ArrowRight, Sparkles, Disc3 } from 'lucide-react';
import { getTop5Recommendations, sampleSuggestions } from './dummyData';
import InteractiveBackground from './components/InteractiveBackground';

function App() {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  const executeSearch = (searchSong) => {
    const target = searchSong.trim();
    if (!target) return;

    setActiveQuery(target);
    setIsLoading(true);
    setResults(null);

    // Simulate vector similarity search latency
    setTimeout(() => {
      setResults(getTop5Recommendations(target));
      setIsLoading(false);
    }, 850);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSuggestionClick = (songTitle) => {
    setQuery(songTitle);
    executeSearch(songTitle);
  };

  return (
    <div className="relative min-h-screen bg-[#08090d] text-slate-100 flex flex-col justify-center items-center px-4 py-16 overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* Interactive Background with floating music shapes & click ripples */}
      <InteractiveBackground />

      {/* Subtle ambient gradient aura */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.07)_0%,_rgba(99,102,241,0.04)_40%,_transparent_75%)]"></div>
      </div>

      <div className="relative z-10 w-full max-w-xl mx-auto">
        
        {/* Project Name (Clean Lexend Font, no 1.2M badge) */}
        <div className="text-center mb-8">
          <h1 className="font-lexend text-5xl sm:text-6xl font-semibold tracking-tight text-white mb-2">
            Muze
          </h1>
          <p className="text-sm text-slate-400 font-normal">
            Provide a song of your choice to discover the most similar songs of that kind.
          </p>
        </div>

        {/* Floating Glassmorphic Input Bar */}
        <form onSubmit={handleSubmit} className="relative group mb-3.5">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-indigo-500/20 rounded-2xl blur-md opacity-25 group-focus-within:opacity-100 transition-opacity duration-500"></div>

          <div className="relative flex items-center bg-[#0e1017]/80 backdrop-blur-2xl border border-white/[0.08] group-focus-within:border-emerald-500/50 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all">
            <div className="pl-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors">
              <Search className="w-5 h-5" />
            </div>

            <input
              type="text"
              className="w-full bg-transparent text-white placeholder-slate-500 text-base px-4 py-4 focus:outline-none font-normal"
              placeholder="Input a song (e.g. The Scientist, Creep)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="pr-3">
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs tracking-wide transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                <span>Find</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>

        {/* Subtle Sample Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 text-xs font-mono">
          <span className="text-slate-500 flex items-center gap-1 text-[11px] mr-1">
            <Sparkles className="w-3 h-3 text-emerald-400/80" />
            Try:
          </span>
          {sampleSuggestions.map((song) => (
            <button
              key={song}
              type="button"
              disabled={isLoading}
              onClick={() => handleSuggestionClick(song)}
              className="px-2.5 py-1 rounded-full bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-emerald-500/30 text-slate-400 hover:text-slate-200 text-[11px] transition-all cursor-pointer"
            >
              {song}
            </button>
          ))}
        </div>

        {/* Audio Wave Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex items-center gap-1 h-8 mb-3">
              <span className="w-1 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-full animate-wave-1"></span>
              <span className="w-1 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-full animate-wave-2"></span>
              <span className="w-1 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-full animate-wave-3"></span>
              <span className="w-1 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-full animate-wave-4"></span>
              <span className="w-1 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-full animate-wave-5"></span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Measuring acoustic distances...
            </p>
          </div>
        )}

        {/* Top 5 Most Similar Songs Results */}
        {!isLoading && results && (
          <div className="space-y-3 transition-all duration-300">
            
            {/* Header info */}
            <div className="flex items-center justify-between px-1 mb-3 text-xs font-mono text-slate-400">
              <span className="tracking-wider">
                Top 5 Similar songs for "{activeQuery}"
              </span>
              <span className="text-emerald-400">Ranked by Similarity</span>
            </div>

            {/* List of 5 Songs */}
            <div className="space-y-2.5">
              {results.map((song) => (
                <div
                  key={song.rank}
                  className="group relative flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-emerald-500/30 backdrop-blur-xl transition-all duration-200 shadow-sm hover:shadow-lg"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Rank Numeral */}
                    <span className="text-xs font-mono font-bold text-emerald-400/80 w-6 text-center shrink-0">
                      0{song.rank}
                    </span>

                    {/* Disc Icon */}
                    <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                      <Disc3 className="w-4 h-4" />
                    </div>

                    {/* Title & Artist */}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white text-sm sm:text-base tracking-tight truncate group-hover:text-emerald-200 transition-colors">
                        {song.title}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">
                        {song.artist} {song.duration && `• ${song.duration}`}
                      </p>
                    </div>
                  </div>

                  {/* Score Badge */}
                  <div className="shrink-0 pl-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-500/20 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{song.score}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default App;