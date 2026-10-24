"""
evaluate_recommendations.py
---------------------------
Quantitative evaluation script comparing:
  - Baseline: ML-Only Top-30 Nearest Neighbors
  - Proposed: ML + FAI Goal-Based Agent Top-30

Measures actual metrics on the real dataset:
  1. Average Similarity to Query Song
  2. Artist Diversity (Number of unique artists)
  3. Maximum Repetition per Artist
  4. Constraint Violations (Artists with > 3 songs)
  5. Intra-List Feature Diversity (Mean pairwise cosine distance)
  6. Runtime Latency (ms)
"""

import time
import os
import sys
import numpy as np
import pandas as pd

# Path setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from RecommendationPipeline.query_service import MuzeRecommendationEngine
from src.fai_agent import FAIMusicRecommender, FAIConfig


def calculate_intralist_diversity(vectors: np.ndarray) -> float:
    """
    Computes average pairwise cosine distance across all pairs in the playlist:
      ILD = (2 / (N * (N - 1))) * sum_{i < j} (1 - cos_sim(v_i, v_j))
    """
    n = len(vectors)
    if n <= 1:
        return 0.0

    # L2-normalize vectors
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.where(norms == 0.0, 1e-9, norms)
    normed = vectors / norms

    # Pairwise cosine similarity matrix
    sim_matrix = np.dot(normed, normed.T)
    # Cosine distance
    dist_matrix = np.clip(1.0 - sim_matrix, 0.0, 2.0)

    # Upper triangular elements (excluding diagonal)
    triu_indices = np.triu_indices(n, k=1)
    pairwise_distances = dist_matrix[triu_indices]

    return float(np.mean(pairwise_distances))


def run_evaluation(seed_track_id: str = "2NLLH8KVjVZDKc8NAtE3ok"):
    print("=" * 70)
    print("MUZE MUSIC RECOMMENDATION EVALUATION: ML-ONLY vs ML + FAI AGENT")
    print("=" * 70)
    print(f"Seed Query Track ID: {seed_track_id}\n")

    # Initialize Recommender and Engines
    t0 = time.time()
    recommender = FAIMusicRecommender()
    print(f"Loaded Recommender Engine in {time.time() - t0:.2f}s.\n")

    ml_engine = recommender.ml_engine
    meta_lookup = recommender.meta_lookup

    query_meta = meta_lookup.get(seed_track_id, {"title": "Unknown", "artist": "Unknown"})
    print(f"Query Song: '{query_meta['title']}' by {query_meta['artist']}\n")

    # 1. EVALUATE ML-ONLY BASELINE (TOP-30 NEAREST NEIGHBORS)
    t_start = time.perf_counter()
    ml_matches = ml_engine.recommend_by_track_id(seed_track_id, top_k=30)
    ml_latency_ms = (time.perf_counter() - t_start) * 1000.0

    ml_artists = []
    ml_similarities = []
    ml_vectors = []

    for m in ml_matches:
        tid = m["track_id"]
        dist = m["distance"]
        sim = 1.0 - dist
        meta = meta_lookup.get(tid, {"title": "Unknown", "artist": "Unknown"})
        ml_artists.append(meta["artist"])
        ml_similarities.append(sim)
        vec = ml_engine.track_to_vector.get(tid, np.zeros(19))
        ml_vectors.append(vec)

    ml_vectors_arr = np.array(ml_vectors, dtype=np.float32)

    # Compute ML Metrics
    ml_artist_series = pd.Series(ml_artists)
    ml_artist_counts = ml_artist_series.value_counts()
    ml_unique_artists = len(ml_artist_counts)
    ml_max_rep = int(ml_artist_counts.max()) if not ml_artist_counts.empty else 0
    ml_violations = int((ml_artist_counts > 3).sum())
    ml_avg_sim = float(np.mean(ml_similarities))
    ml_ild = calculate_intralist_diversity(ml_vectors_arr)

    # 2. EVALUATE ML + FAI AGENT (CANDIDATE POOL 150 -> FINAL 30)
    t_start = time.perf_counter()
    fai_recs, fai_report = recommender.recommend(seed_track_id, candidate_pool_size=70)
    fai_latency_ms = (time.perf_counter() - t_start) * 1000.0

    fai_artists = [r["artist"] for r in fai_recs]
    fai_similarities = [r["similarity"] for r in fai_recs]
    fai_vectors = [ml_engine.track_to_vector.get(r["track_id"], np.zeros(19)) for r in fai_recs]
    fai_vectors_arr = np.array(fai_vectors, dtype=np.float32)

    # Compute FAI Metrics
    fai_artist_series = pd.Series(fai_artists)
    fai_artist_counts = fai_artist_series.value_counts()
    fai_unique_artists = len(fai_artist_counts)
    fai_max_rep = int(fai_artist_counts.max()) if not fai_artist_counts.empty else 0
    fai_violations = int((fai_artist_counts > 3).sum())
    fai_avg_sim = float(np.mean(fai_similarities))
    fai_ild = calculate_intralist_diversity(fai_vectors_arr)

    # 3. COMPARISON TABLE
    results_df = pd.DataFrame([
        {
            "Metric": "Total Recommendations",
            "ML-Only (Baseline)": len(ml_matches),
            "ML + FAI Agent": len(fai_recs),
            "Goal / Ideal": "30 songs"
        },
        {
            "Metric": "Average Query Similarity",
            "ML-Only (Baseline)": f"{ml_avg_sim:.4f}",
            "ML + FAI Agent": f"{fai_avg_sim:.4f}",
            "Goal / Ideal": "High (> 0.90)"
        },
        {
            "Metric": "Unique Artists",
            "ML-Only (Baseline)": f"{ml_unique_artists}",
            "ML + FAI Agent": f"{fai_unique_artists}",
            "Goal / Ideal": "Higher is better"
        },
        {
            "Metric": "Max Songs per Artist",
            "ML-Only (Baseline)": f"{ml_max_rep}",
            "ML + FAI Agent": f"{fai_max_rep}",
            "Goal / Ideal": "<= 3 (Hard CSP)"
        },
        {
            "Metric": "Artist Constraint Violations (>3)",
            "ML-Only (Baseline)": f"{ml_violations}",
            "ML + FAI Agent": f"{fai_violations}",
            "Goal / Ideal": "0 violations"
        },
        {
            "Metric": "Intra-List Feature Diversity (ILD)",
            "ML-Only (Baseline)": f"{ml_ild:.4f}",
            "ML + FAI Agent": f"{fai_ild:.4f}",
            "Goal / Ideal": "Higher is diverse"
        },
        {
            "Metric": "Runtime Latency (ms)",
            "ML-Only (Baseline)": f"{ml_latency_ms:.2f} ms",
            "ML + FAI Agent": f"{fai_latency_ms:.2f} ms",
            "Goal / Ideal": "< 50 ms"
        }
    ])

    print(results_df.to_string(index=False))
    print("\n" + "=" * 70)

    # Print top 5 samples from both approaches
    print("\nSample Top 5 from ML-Only:")
    for idx, (m, art, sim) in enumerate(zip(ml_matches[:30], ml_artists[:30], ml_similarities[:30]), 1):
        title = meta_lookup.get(m["track_id"], {}).get("title", "Unknown")
        print(f"  {idx}. '{title}' - {art} (Sim: {sim:.4f})")

    print("\nSample Top 5 from ML + FAI Agent:")
    for idx, r in enumerate(fai_recs, 1):
        print(f"  {idx}. '{r['title']}' - {r['artist']} (Sim: {r['similarity']:.4f}, Score: {r['fai_score']:.4f}, DivDist: {r['diversity_distance']:.4f})")

    return results_df, (ml_matches, ml_artists), fai_recs


if __name__ == "__main__":
    run_evaluation()
