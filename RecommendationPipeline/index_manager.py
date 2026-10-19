"""
index_manager.py
----------------
Module responsible for building, saving, loading, and querying
the vector index using the `usearch` library.

Metric Selection:
-----------------
Cosine similarity ('cos') is selected because song feature vectors
contain both directional continuous components (e.g. L2 normalized features)
and categorical one-hot vectors.
"""

import os
import numpy as np
from usearch.index import Index

try:
    from config import VECTOR_DIMENSION
except ImportError:
    from .config import VECTOR_DIMENSION


def create_index(
    ndim: int = VECTOR_DIMENSION,
    metric: str = "cos",
    dtype: str = "f32"
) -> Index:
    """
    Initializes an empty usearch Index.
    """
    print(f"[index_manager] Initializing empty usearch Index (ndim={ndim}, metric='{metric}', dtype='{dtype}')...")
    return Index(ndim=ndim, metric=metric, dtype=dtype)


def add_batch_to_index(
    index: Index,
    batch_vectors: np.ndarray,
    batch_vector_ids: np.ndarray
):
    """
    Adds a contiguous batch of vectors with corresponding IDs to the index.
    """
    # Ensure vectors are C-contiguous in memory
    contiguous_vectors = np.ascontiguousarray(batch_vectors, dtype=np.float32)
    index.add(batch_vector_ids, contiguous_vectors)


def build_usearch_index(
    vectors: np.ndarray,
    vector_ids: np.ndarray,
    metric: str = "cos",
    dtype: str = "f32"
) -> Index:
    """
    Initializes and populates a usearch vector index in one go.
    """
    ndim = vectors.shape[1]
    index = create_index(ndim=ndim, metric=metric, dtype=dtype)
    print(f"[index_manager] Adding {len(vectors):,} vectors into index...")
    add_batch_to_index(index, vectors, vector_ids)
    print(f"[index_manager] Successfully added {len(index):,} vectors to the index.")
    return index


def save_index(index: Index, filepath: str):
    """
    Saves index to disk.
    """
    print(f"[index_manager] Saving vector index to {filepath}...")
    index.save(filepath)
    print("[index_manager] Vector index saved successfully.")

def load_index(filepath: str, ndim: int = VECTOR_DIMENSION, metric: str = "cos") -> Index:
    """
    Loads saved usearch index from disk.
    """
    print(f"[index_manager] Loading vector index from {filepath}...")
    index = Index(ndim=ndim, metric=metric)
    index.load(filepath)
    print(f"[index_manager] Loaded index containing {len(index)} vectors.")
    return index

def query_similar_tracks(
    index: Index,
    query_vector: np.ndarray,
    top_k: int = 100
):
    """
    Performs approximate nearest neighbors search.

    Parameters:
    -----------
    index : Index
        The usearch index.
    query_vector : np.ndarray
        (D,) query vector representing a target song.
    top_k : int
        Number of nearest recommendations to retrieve.

    Returns:
    --------
    matches : Matches object containing keys (vector_ids) and distances.
    """
    matches = index.search(query_vector, top_k)
    return matches.keys, matches.distances
