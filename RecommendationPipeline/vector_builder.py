"""
vector_builder.py
-----------------
Module responsible for extracting features from the dataset and building
aligned vectors along with tracking relationships.

ID Mapping Architecture:
-------------------------
Can track_Id directly uniquely identify a vector in the index?
- Spotify track_ids are alphanumeric strings (e.g., '4zKp...').
- High-performance vector search libraries (such as usearch and hnswlib)
  use 64-bit integer keys (uint64) for maximum speed and compact memory indexing.
- Therefore, we assign each track an integer index (`vector_id` = 0, 1, 2, ... N-1).
- We maintain a clean, bidirectional, 1-to-1 mapping linking:
    track_id (string) <---> vector_id (int64) <---> vector (19-dim float array).
"""

import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any

try:
    from config import VECTOR_FEATURES, TRACK_ID_COL, BATCH_SIZE
except ImportError:
    from .config import VECTOR_FEATURES, TRACK_ID_COL, BATCH_SIZE


def process_chunk(
    df_chunk: pd.DataFrame,
    start_idx: int,
    feature_cols: list = VECTOR_FEATURES,
    id_col: str = TRACK_ID_COL
) -> Tuple[np.ndarray, np.ndarray, pd.DataFrame]:
    """
    Processes a single batch/chunk of songs:
    - Fills missing values
    - Extracts contiguous float32 vector embeddings
    - Generates 64-bit integer vector_ids for this batch
    - Builds the mapping dataframe chunk

    Returns:
    --------
    batch_vectors : np.ndarray
        Contiguous float32 array of shape (batch_size, 19).
    batch_vector_ids : np.ndarray
        Int64 IDs corresponding to the songs in this batch.
    batch_mapping_df : pd.DataFrame
        DataFrame with columns ['vector_id', 'track_id', 'vector'].
    """
    # Fill missing values within the batch
    df_chunk = df_chunk.copy()
    df_chunk[feature_cols] = df_chunk[feature_cols].fillna(0.0)

    # Convert to contiguous float32 array in memory for usearch
    batch_vectors = np.ascontiguousarray(df_chunk[feature_cols].to_numpy(dtype=np.float32))

    # Sequential vector_ids starting from start_idx
    batch_vector_ids = np.arange(start_idx, start_idx + len(df_chunk), dtype=np.int64)

    # Build chunk mapping
    batch_mapping_df = pd.DataFrame({
        "vector_id": batch_vector_ids,
        "track_id": df_chunk[id_col].astype(str).values,
        "vector": list(batch_vectors)
    })

    return batch_vectors, batch_vector_ids, batch_mapping_df


def iter_data_batches(
    csv_path: str,
    feature_cols: list = VECTOR_FEATURES,
    id_col: str = TRACK_ID_COL,
    batch_size: int = BATCH_SIZE
):
    """
    Streams CSV dataset in chunks using pandas chunksize to save memory.
    Yields (batch_vectors, batch_vector_ids, batch_mapping_df) for each batch.
    """
    cols_to_load = [id_col] + feature_cols
    current_idx = 0

    print(f"[vector_builder] Streaming dataset from {csv_path} in batches of {batch_size:,}...")
    for df_chunk in pd.read_csv(csv_path, usecols=cols_to_load, chunksize=batch_size):
        batch_vectors, batch_ids, batch_mapping = process_chunk(
            df_chunk=df_chunk,
            start_idx=current_idx,
            feature_cols=feature_cols,
            id_col=id_col
        )
        current_idx += len(df_chunk)
        yield batch_vectors, batch_ids, batch_mapping


def load_data_and_extract_vectors(
    csv_path: str,
    feature_cols: list = VECTOR_FEATURES,
    id_col: str = TRACK_ID_COL,
    batch_size: int = BATCH_SIZE
) -> Tuple[np.ndarray, pd.DataFrame]:
    """
    Processes the entire dataset chunk by chunk to build vectors and mapping table.
    """
    vectors_list = []
    mapping_dfs = []

    for batch_vectors, _, batch_mapping in iter_data_batches(
        csv_path=csv_path,
        feature_cols=feature_cols,
        id_col=id_col,
        batch_size=batch_size
    ):
        vectors_list.append(batch_vectors)
        mapping_dfs.append(batch_mapping)

    all_vectors = np.vstack(vectors_list)
    all_mapping_df = pd.concat(mapping_dfs, ignore_index=True)

    print(f"[vector_builder] Finished batch extraction. Total tracks processed: {len(all_vectors):,}")
    return all_vectors, all_mapping_df


def save_mapping_store(mapping_df: pd.DataFrame, output_path: str):
    """
    Saves the track_id <-> vector_id <-> vector mapping to Parquet or Pickle.
    """
    print(f"[vector_builder] Persisting mapping table to {output_path}...")
    if output_path.endswith(".parquet"):
        mapping_df.to_parquet(output_path, index=False)
    else:
        mapping_df.to_pickle(output_path)
    print("[vector_builder] Mapping table saved successfully.")

