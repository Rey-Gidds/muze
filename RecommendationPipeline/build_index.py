"""
build_index.py
--------------
Main entry point to:
1. Extract the 19-dimensional vectors from scaled dataset.
2. Build the bidirectional mapping: track_id <-> vector_id <-> vector.
3. Construct and save the usearch vector index.
4. Persist the mapping store for production lookups.
"""

import time
import numpy as np
import pandas as pd

try:
    from config import (
        DEFAULT_DATASET_PATH,
        DEFAULT_INDEX_PATH,
        DEFAULT_MAPPING_PATH,
        VECTOR_FEATURES,
        VECTOR_DIMENSION,
        BATCH_SIZE
    )
    from vector_builder import iter_data_batches, save_mapping_store
    from index_manager import create_index, add_batch_to_index, save_index
except ImportError:
    from .config import (
        DEFAULT_DATASET_PATH,
        DEFAULT_INDEX_PATH,
        DEFAULT_MAPPING_PATH,
        VECTOR_FEATURES,
        VECTOR_DIMENSION,
        BATCH_SIZE
    )
    from .vector_builder import iter_data_batches, save_mapping_store
    from .index_manager import create_index, add_batch_to_index, save_index


def run_indexing_pipeline(
    csv_path: str = DEFAULT_DATASET_PATH,
    index_path: str = DEFAULT_INDEX_PATH,
    mapping_path: str = DEFAULT_MAPPING_PATH,
    batch_size: int = BATCH_SIZE
):
    """
    Executes the complete vector construction and indexing pipeline in batches.
    - Streams dataset in chunks of `batch_size`.
    - Converts each batch to a contiguous memory block and indexes it immediately.
    - Assembles the mapping table and saves both index and mapping to disk.
    """
    start_time = time.time()
    print("=" * 60)
    print("MUZE VECTOR INDEX BUILDER (BATCHED PROCESSING)")
    print("=" * 60)

    # Initialize empty usearch index
    index = create_index(ndim=VECTOR_DIMENSION, metric="cos", dtype="f32")

    mapping_chunks = []
    total_indexed = 0

    # Stream through dataset in contiguous memory batches
    for batch_vectors, batch_ids, batch_mapping in iter_data_batches(
        csv_path=csv_path,
        feature_cols=VECTOR_FEATURES,
        batch_size=batch_size
    ):
        # Add contiguous batch directly to the usearch index
        add_batch_to_index(index, batch_vectors, batch_ids)
        mapping_chunks.append(batch_mapping)
        total_indexed += len(batch_ids)
        print(f"[build_index] Indexed {total_indexed:,} songs...")

    # Combine chunked mapping metadata
    print("[build_index] Combining mapping table...")
    full_mapping_df = pd.concat(mapping_chunks, ignore_index=True)

    # Save index to disk
    save_index(index, filepath=index_path)

    # Save mapping table to disk
    save_mapping_store(full_mapping_df, output_path=mapping_path)

    elapsed = time.time() - start_time
    print("=" * 60)
    print(f"Batched indexing completed in {elapsed:.2f} seconds.")
    print(f"Total songs indexed: {total_indexed:,}")
    print(f"Batch size used: {batch_size:,}")
    print(f"Index file: {index_path}")
    print(f"Mapping file: {mapping_path}")
    print("=" * 60)

if __name__ == "__main__":
    run_indexing_pipeline()

