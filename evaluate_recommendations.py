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


def run_evaluation(seed_track_id: str = "11cxKUEgnVAlesUKt4e3br"):
    print("MUZE MUSIC RECOMMENDATION EVALUATION: ML-ONLY vs ML + FAI AGENT")
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

    # 2. EVALUATE ML + FAI AGENT (CANDIDATE POOL 70 -> FINAL 30)
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
    for idx, (m, art, sim) in enumerate(zip(ml_matches[:5], ml_artists[:5], ml_similarities[:30]), 1):
        title = meta_lookup.get(m["track_id"], {}).get("title", "Unknown")
        print(f"  {idx}. '{title}' - {art} (Sim: {sim:.4f})")

    print("\nSample Top 5 from ML + FAI Agent:")
    for idx, r in enumerate(fai_recs[:5], 1):
        print(f"  {idx}. '{r['title']}' - {r['artist']} (Sim: {r['similarity']:.4f}, Score: {r['fai_score']:.4f}, DivDist: {r['diversity_distance']:.4f})")

    # Compute Precision & Recall
    calculate_precision_and_recall(recommender, seed_track_id=seed_track_id, k=30)

    return results_df, (ml_matches, ml_artists), fai_recs


def calculate_precision_and_recall(recommender, seed_track_id: str, k: int = 30, similarity_threshold: float = 0.85):
    """
    1. Precision@K: Fraction of top-K songs meeting the acoustic similarity threshold.
    2. ANN Recall@K: Overlap between HNSW index and Exact Dot-Product Brute Force.
    """
    ml_engine = recommender.ml_engine
    target_vec = np.array(ml_engine.track_to_vector[seed_track_id], dtype=np.float32)

    # --- A. Calculate Precision@K for both ML and FAI ---
    ml_recs = ml_engine.recommend_by_track_id(seed_track_id, top_k=k)
    fai_recs, _ = recommender.recommend(seed_track_id, candidate_pool_size=70)

    ml_relevant = sum(1 for m in ml_recs if (1.0 - m["distance"]) >= similarity_threshold)
    fai_relevant = sum(1 for r in fai_recs if r["similarity"] >= similarity_threshold)

    ml_precision = ml_relevant / k
    fai_precision = fai_relevant / k

    # --- B. Calculate ANN Recall@K (HNSW vs Exact Brute Force on subset/candidates) ---
    hnsw_ids = set([m["track_id"] for m in ml_recs])

    # To calculate exact ground truth on 1.2M songs:
    # (Extract dot product against candidates pool or all vectors)
    all_vectors = np.array(list(ml_engine.track_to_vector.values()), dtype=np.float32)
    all_ids = list(ml_engine.track_to_vector.keys())
    
    # Exact cosine similarities
    target_norm = target_vec / np.linalg.norm(target_vec)
    matrix_norms = all_vectors / np.linalg.norm(all_vectors, axis=1, keepdims=True)
    exact_sims = np.dot(matrix_norms, target_norm)
    
    # Exclude seed track itself
    exact_top_k_indices = np.argsort(exact_sims)[::-1]
    exact_ids = []
    for idx in exact_top_k_indices:
        tid = all_ids[idx]
        if tid != seed_track_id:
            exact_ids.append(tid)
        if len(exact_ids) == k:
            break

    ann_recall = len(hnsw_ids.intersection(set(exact_ids))) / k

    print(f"--- Precision & Recall Metrics (K={k}) ---")
    print(f"Acoustic Precision@30 (ML-Only) : {ml_precision * 100:.1f}%")
    print(f"Acoustic Precision@30 (ML + FAI): {fai_precision * 100:.1f}%")
    print(f"ANN Search Recall@30 (HNSW Fidelity): {ann_recall * 100:.1f}%")

    return {
        "ml_precision": ml_precision,
        "fai_precision": fai_precision,
        "ann_recall": ann_recall
    }

if __name__ == "__main__":
    run_evaluation()

