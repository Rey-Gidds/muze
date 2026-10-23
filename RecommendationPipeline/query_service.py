"""
query_service.py
----------------
Module providing quick lookups and recommendation querying:
- track_id -> vector_id -> nearest neighbors -> recommended track_ids.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any
import time

try:
    from config import DEFAULT_INDEX_PATH, DEFAULT_MAPPING_PATH, VECTOR_DIMENSION
    from index_manager import load_index, query_similar_tracks
except ImportError:
    from .config import DEFAULT_INDEX_PATH, DEFAULT_MAPPING_PATH, VECTOR_DIMENSION
    from .index_manager import load_index, query_similar_tracks


class MuzeRecommendationEngine:
    def __init__(
        self,
        index_path: str = DEFAULT_INDEX_PATH,
        mapping_path: str = DEFAULT_MAPPING_PATH
    ):
        print("[query_service] Initializing MuzeRecommendationEngine...")
        # Load mapping store
        if mapping_path.endswith(".parquet"):
            self.mapping_df = pd.read_parquet(mapping_path)
        else:
            self.mapping_df = pd.read_pickle(mapping_path)

        # Build in-memory fast hash lookups
        self.track_to_vector_id = dict(zip(self.mapping_df["track_id"], self.mapping_df["vector_id"]))
        self.vector_to_track_id = dict(zip(self.mapping_df["vector_id"], self.mapping_df["track_id"]))
        self.track_to_vector = dict(zip(self.mapping_df["track_id"], self.mapping_df["vector"]))

        # Load usearch index
        self.index = load_index(index_path, ndim=VECTOR_DIMENSION, metric="cos")
        print("[query_service] Recommendation engine ready.")

    def recommend_by_track_id(self, track_id: str, top_k: int = 100) -> List[Dict[str, Any]]:
        """
        Takes a track_id, retrieves its vector, queries the index, and returns
        the most similar track_ids with their distance scores.
        """
        if track_id not in self.track_to_vector:
            raise KeyError(f"Track ID '{track_id}' not found in database.")

        target_vector = np.array(self.track_to_vector[track_id], dtype=np.float32)
        
        # Query (fetching top_k + 1 to exclude the query song itself)
        matched_ids, distances = query_similar_tracks(self.index, target_vector, top_k=top_k + 1)

        recommendations = []
        for vid, dist in zip(matched_ids, distances):
            tid = self.vector_to_track_id.get(int(vid))
            if tid == track_id:
                continue  # Skip query song itself
            recommendations.append({
                "track_id": tid,
                "vector_id": int(vid),
                "distance": float(dist)
            })
            if len(recommendations) >= top_k:
                break

        return recommendations


if __name__ == "__main__":
    recommendor = MuzeRecommendationEngine()
    track_id = "2LXPNLSMAauNJfnC58lSqY"
    start = time.time()
    recommendations = recommendor.recommend_by_track_id(track_id, top_k=20)
    end = time.time()
    for obj in recommendations:
        print(f"Track ID: {obj['track_id']}, Vector ID: {obj['vector_id']}, Distance: {obj['distance']}")

    print(f"Time taken: {end - start} seconds")
