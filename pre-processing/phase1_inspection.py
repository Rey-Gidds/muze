import pandas as pd
import os

def inspect_dataset(file_path):
    
    if not os.path.exists(file_path):
        print(f"Error: Could not find the file at {file_path}")
        return

    size_gb = os.path.getsize(file_path) / (1024 ** 3)
    print(f"File Size: {size_gb:.2f} GB")

    try:
        df = pd.read_csv(file_path)
    except MemoryError:
        print("\nERROR: Out of Memory!")
        return

    print(f"\nDataset Shape")
    print(f"Total Rows: {df.shape[0]:,}")
    print(f"Total Columns: {df.shape[1]}")

    print(df.dtypes)


    print("\nMissing Values")
    missing = df.isnull().sum()
    missing_cols = missing[missing > 0]

    if missing_cols.empty:
        print("No missing values found!")
    else:
        print(missing_cols)


    print("\nDuplicate Track IDs")
    id_candidates = [col for col in df.columns if 'id' in col.lower()]
    if id_candidates:
        primary_id = id_candidates[0]
        dupes = df.duplicated(subset=[primary_id]).sum()
        print(f"Using '{primary_id}' as the identifier. Found {dupes:,} duplicate rows.")
    else:
        print("No obvious 'id' column found. We will check this manually.")

    print("\nNumerical Feature Ranges (Summary Statistics)")
    numeric_df = df.select_dtypes(include=['float64', 'int64'])

    summary = numeric_df.describe().T[['min', 'mean', 'max']]
    print(summary)
    

if __name__ == "__main__":
    FILE_PATH = "tracks_features.csv" 
    
    inspect_dataset(FILE_PATH)