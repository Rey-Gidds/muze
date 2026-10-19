import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

def run_phase2(input_csv, output_csv):
    
    print(f"Loading {input_csv}...")
    df = pd.read_csv(input_csv)
    initial_rows = len(df)
    
    print("\nCleaning Data")
    df_cleaned = df.dropna(subset=['name', 'album']).copy()
    final_rows = len(df_cleaned)

    print(f"Dropped {initial_rows - final_rows} rows with missing 'name' or 'album'.")
    print(f"Remaining rows: {final_rows:,}")
    

    # Selecting relevant cols
    # We keep identifiers/metadata for search, and audio features for ML
    columns_to_keep = [
        'id', 'name', 'artists', 'album', 'year', # Metadata
        'danceability', 'energy', 'key', 'loudness', 'mode', 
        'speechiness', 'acousticness', 'instrumentalness', 
        'liveness', 'valence', 'tempo', 'duration_ms' # Audio Features
    ]

    df_cleaned = df_cleaned[columns_to_keep]
    print(f"Filtered dataset down to {len(columns_to_keep)} essential columns.")

    print("\nGenerating Exploratory Data Analysis (EDA) Plots")
    
    audio_features = [
        'danceability', 'energy', 'loudness', 'speechiness', 
        'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo'
    ]
    
    # Feature Distributions
    plt.figure(figsize=(15, 10))
    for i, feature in enumerate(audio_features, 1):
        plt.subplot(3, 3, i)
        sns.histplot(df_cleaned[feature], bins=30, kde=False, color='skyblue')
        plt.title(f'Distribution of {feature}')
        plt.xlabel('')
        plt.ylabel('')

    plt.tight_layout()
    plt.savefig('eda_distributions.png')
    plt.close()
    
    # Correlation Matrix
    print("Generating correlation heatmap (eda_correlation.png)...")
    plt.figure(figsize=(10, 8))
    correlation_matrix = df_cleaned[audio_features].corr()
    sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', fmt=".2f", vmin=-1, vmax=1)

    plt.title("Correlation Matrix of Audio Features")
    plt.tight_layout()
    plt.savefig('eda_correlation.png')
    plt.close()
    

    print(f"\nSaving Cleaned Data")
    df_cleaned.to_csv(output_csv, index=False)
    
    print(f" Cleaned data saved as: {output_csv}")
    

if __name__ == "__main__":
    ORIGINAL_CSV = "tracks_features.csv" 
    
    CLEANED_CSV = "cleaned_tracks_features.csv"
    
    run_phase2(ORIGINAL_CSV, CLEANED_CSV)