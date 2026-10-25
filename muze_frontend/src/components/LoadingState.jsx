import React from 'react';
import { Cpu } from 'lucide-react';

const LoadingState = () => {
  return (
    <div className="w-full max-w-4xl mx-auto my-12 transition-all duration-300">
      
      {/* Geometric Spinner & Status Header */}
      <div className="text-center mb-10">
        <div className="relative inline-flex items-center justify-center">
          {/* Outer pulsing ring */}
          <div className="w-16 h-16 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
          {/* Inner counter-rotating ring */}
          <div className="absolute w-10 h-10 rounded-full border-2 border-emerald-500/20 border-b-emerald-400 animate-spin [animation-direction:reverse]"></div>
          {/* Center core */}
          <div className="absolute w-3 h-3 rounded-full bg-indigo-400 shadow-md shadow-indigo-500/50"></div>
        </div>

        <h3 className="mt-5 text-sm sm:text-base font-semibold text-white tracking-wide">
          Executing FAI Agent & Vector Search
        </h3>
        <p className="mt-1 text-xs font-mono text-indigo-400/80">
          Evaluating 1.2M+ vectors • Calculating CSP constraints & diversity distance...
        </p>
      </div>

      {/* Pulsing Skeleton Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-neutral-900/40 border border-neutral-800/60 p-5 space-y-4 animate-pulse"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2 w-3/4">
                <div className="h-4 bg-neutral-800 rounded-md w-4/5"></div>
                <div className="h-3 bg-neutral-800/60 rounded-md w-1/2"></div>
              </div>
              <div className="w-8 h-8 rounded-xl bg-neutral-800/60"></div>
            </div>

            <div className="pt-3 border-t border-neutral-800/40 flex gap-2">
              <div className="h-5 bg-neutral-800 rounded-full w-20"></div>
              <div className="h-5 bg-neutral-800/70 rounded-full w-28"></div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default LoadingState;
