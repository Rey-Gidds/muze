/**
 * FAI (Foundational / Flexible AI) Filter Service
 * -----------------------------------------------
 * Bridges the Node.js backend to the Goal-Based FAI Agent (`fai_agent.py`):
 * - Candidate Validation (query song exclusion, deduplication, sanity checks)
 * - Constraint Satisfaction Problem (CSP) formulation (artist repetition caps)
 * - Multi-objective Heuristic (Similarity + MaxMin Diversity - Repetition Penalty)
 * - Greedy State-Space Search & Stepwise Constraint Relaxation
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FAI_SCRIPT_PATH = path.resolve(__dirname, '../../scripts/fai_filter.py');

export const faiService = {
  /**
   * Invokes the FAI agent in Python to select the optimal subset of recommendations.
   *
   * @param {string} queryTrackId Seed track ID
   * @param {Array<Object>} candidates Candidate pool from ML ANN search
   * @param {number} targetCount Desired number of final recommendations (e.g. 20 or 30)
   * @returns {Promise<Array<Object>>} Selected tracks chosen by the FAI agent
   */
  async filterWithFAIAgent(queryTrackId, candidates, targetCount = 30) {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const py = spawn('python', ['-u', FAI_SCRIPT_PATH]);

      let stdoutData = '';
      let stderrData = '';

      py.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      py.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      py.on('error', (err) => {
        logger.error('[FAIService] Failed to spawn Python FAI agent:', { error: err.message });
        // Fallback: return raw top candidates if Python cannot be executed
        resolve(candidates.slice(0, targetCount));
      });

      py.on('close', (code) => {
        const duration = Date.now() - startTime;
        if (code !== 0) {
          logger.warn(`[FAIService] FAI process exited with code ${code}. Error: ${stderrData}`);
          // Fallback gracefully to nearest neighbors
          return resolve(candidates.slice(0, targetCount));
        }

        try {
          const parsed = JSON.parse(stdoutData);
          if (parsed.success && Array.isArray(parsed.recommendations)) {
            logger.info(`[FAIService] FAI agent selected ${parsed.recommendations.length} songs in ${duration}ms (target: ${targetCount})`);
            return resolve(parsed.recommendations);
          }
          logger.warn('[FAIService] Invalid response from FAI agent. Using fallback.');
          resolve(candidates.slice(0, targetCount));
        } catch (err) {
          logger.error('[FAIService] Failed to parse FAI agent output:', { error: err.message });
          resolve(candidates.slice(0, targetCount));
        }
      });

      const payload = JSON.stringify({
        query_track_id: queryTrackId,
        target_count: targetCount,
        candidates,
      });

      py.stdin.write(payload);
      py.stdin.end();
    });
  },
};

