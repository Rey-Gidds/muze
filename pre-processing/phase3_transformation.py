import os
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, normalize
from RecommendationPipeline.config import *

# Continuous statistical features to be standard-scaled.
# Note:
# - 'key' is encoded cyclically into (key_sin, key_cos)
# - 'mode' is preserved as raw binary {0, 1}
# - 'time_signature' is discrete and one-hot encoded (neither standardized nor L2-normalized)
STATS_COLS_TO_SCALE = [
    "danceability",
    "energy",
    "loudness",
    "speechiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "valence",
    "tempo"
]

def preprocess():
    print(f"Loading dataset from {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    print(f"Dataset loaded. Initial shape: {df.shape}")

    # 1. Cyclical encoding for musical 'key' (0 to 11)
    print("Computing cyclical encoding for 'key'...")
    key_sin = np.sin(2 * np.pi * df["key"] / 12)
    key_cos = np.cos(2 * np.pi * df["key"] / 12)

    # 2. Fit and transform StandardScaler on continuous statistical features
    print(f"Standardizing continuous features: {STATS_COLS_TO_SCALE}...")
    scaler = StandardScaler()
    scaled_stats = scaler.fit_transform(df[STATS_COLS_TO_SCALE])

    # 3. Save the fitted StandardScaler
    print(f"Saving StandardScaler to {SCALER_PATH}...")
    joblib.dump(scaler, SCALER_PATH)
    print("Scaler saved successfully.")

    # 4. Construct feature matrix for L2 normalization:
    # scaled_stats (9 cols) + mode (1 col) = 10 dimensions
    # Note: key_sin and key_cos are preserved as-is and not L2-normalized.
    continuous_mode_cols = STATS_COLS_TO_SCALE + ["mode"]
    raw_feature_matrix = np.column_stack([
        scaled_stats,
        df["mode"].to_numpy(dtype=np.float32)
    ])

    print("Applying L2 normalization to musical feature vectors (excluding key_sin and key_cos)...")
    l2_normalized_vectors = normalize(raw_feature_matrix, norm="l2", axis=1)

    # 5. One-hot encode 'time_signature' (discrete values)
    print("One-hot encoding 'time_signature'...")
    time_sig_dummies = pd.get_dummies(df["time_signature"], prefix="time_signature", dtype=int)

    # 6. Create copy dataset
    df_copy = df.copy()

    # Drop original 'key' and 'time_signature' columns as requested
    df_copy.drop(columns=["key", "time_signature"], inplace=True)

    # Put scaled continuous features into copy
    df_copy[STATS_COLS_TO_SCALE] = scaled_stats

    # Add key_sin and key_cos
    df_copy["key_sin"] = key_sin
    df_copy["key_cos"] = key_cos

    # Add L2 normalized columns
    for i, col in enumerate(continuous_mode_cols):
        df_copy[f"{col}_l2"] = l2_normalized_vectors[:, i]

    # Append one-hot encoded time_signature columns (not standardized, not L2 normalized)
    df_copy = pd.concat([df_copy, time_sig_dummies], axis=1)

    # 7. Save to CSV
    print(f"Saving scaled copy dataset to {OUTPUT_CSV_PATH}...")
    df_copy.to_csv(OUTPUT_CSV_PATH, index=False)
    print(f"Successfully saved scaled dataset to {OUTPUT_CSV_PATH}. Final shape: {df_copy.shape}")

if __name__ == "__main__":
    preprocess()
