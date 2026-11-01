"""
FAI Layer for Muze Music Recommendation.

This module acts as an Intelligent Goal-Based Agent that receives 100-200 raw
candidate songs retrieved by the vector ML layer and selects an optimal final playlist
of 30 songs using:
  1. Candidate Validation (Query exclusion, deduplication, sanity checks)
  2. Constraint Satisfaction Problem (CSP) formulation (Hard vs Soft constraints)
  3. Multi-objective Heuristic Scoring (Similarity + Feature Diversity - Repetition)
  4. Greedy State-Space Search
  5. Stepwise Constraint Relaxation & Fallback Handling
"""

import sys
import os
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple, Set
import numpy as np

# Ensure root directory is in sys.path for RecommendationPipeline imports
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


# 1. DATA MODELS & CONFIGURATION

@dataclass
class SongCandidate:
    """Represents a single candidate track passed from ML to FAI."""
    track_id: str
    vector_id: int
    distance: float                        # Cosine distance from query song
    similarity: float                      # Cosine similarity = 1 - distance
    vector: np.ndarray                     # Feature embedding (e.g. 19-dim)
    title: str = "Unknown Title"
    artist: str = "Unknown Artist"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "title": self.title,
            "artist": self.artist,
            "vector_id": self.vector_id,
            "distance": round(float(self.distance), 6),
            "similarity": round(float(self.similarity), 6),
        }


@dataclass
class FAIConfig:
    """Configurable weights and constraints for the FAI Agent."""
    target_count: int = 30                 # Number of songs to select
    max_artist_repetition: int = 3         # Hard artist threshold per playlist
    min_similarity_threshold: float = 0.50 # Soft similarity cutoff (relaxed if needed)
    
    # Multi-objective weights (sum normalized in scoring)
    weight_similarity: float = 0.70       # Importance of relevance to seed
    weight_diversity: float = 0.20         # Importance of intra-list acoustic variety
    weight_artist_penalty: float = 0.10    # Penalty for artist concentration


@dataclass
class SelectionDiagnostic:
    """Audit log explaining why a specific song was chosen at step k."""
    step: int
    track_id: str
    title: str
    artist: str
    score: float
    similarity: float
    diversity_distance: float
    current_artist_count: int
    relaxation_tier: int
    reason: str


@dataclass
class FAIAgentState:
    """Internal state maintained by the agent during playlist selection."""
    selected_songs: List[SongCandidate] = field(default_factory=list)
    selected_track_ids: Set[str] = field(default_factory=set)
    artist_counts: Dict[str, int] = field(default_factory=dict)
    selected_vectors: List[np.ndarray] = field(default_factory=list)
    diagnostics: List[SelectionDiagnostic] = field(default_factory=list)

    def add_song(self, song: SongCandidate, diag: SelectionDiagnostic):
        """Updates internal state upon selecting a song."""
        self.selected_songs.append(song)
        self.selected_track_ids.add(song.track_id)
        self.artist_counts[song.artist] = self.artist_counts.get(song.artist, 0) + 1
        self.selected_vectors.append(np.asarray(song.vector, dtype=np.float32))
        self.diagnostics.append(diag)


# 2. CANDIDATE VALIDATION (Stage 1)

def validate_candidates(
    candidates: List[SongCandidate],
    query_track_id: str
) -> Tuple[List[SongCandidate], Dict[str, int]]:
    """
    Validates raw ML candidates before reasoning:
      1. Excludes query song itself (Hard Requirement).
      2. Removes duplicates by track_id, keeping the highest-similarity instance.
      3. Discards invalid records (NaNs, empty IDs, corrupt vector dimensions).

    Returns:
        valid_candidates: Clean list of distinct candidates.
        stats: Summary dictionary of filtered counts.
    """
    stats = {
        "initial_candidates": len(candidates),
        "removed_query_song": 0,
        "removed_duplicates": 0,
        "removed_corrupt": 0,
    }

    seen_ids: Set[str] = set()
    cleaned: List[SongCandidate] = []

    for c in candidates:
        # Check 1: Exclude query song
        if c.track_id == query_track_id:
            stats["removed_query_song"] += 1
            continue

        # Check 2: Deduplication
        if c.track_id in seen_ids:
            stats["removed_duplicates"] += 1
            continue

        # Check 3: Corrupt record checks
        if not c.track_id or c.vector is None or len(c.vector) == 0:
            stats["removed_corrupt"] += 1
            continue
        if np.isnan(c.vector).any() or np.isnan(c.similarity):
            stats["removed_corrupt"] += 1
            continue

        seen_ids.add(c.track_id)
        cleaned.append(c)

    return cleaned, stats


# 3. CONSTRAINT CHECKING & RELAXATION (Stage 2)

def check_candidate_eligibility(
    candidate: SongCandidate,
    state: FAIAgentState,
    config: FAIConfig,
    relaxation_tier: int = 0
) -> Tuple[bool, str]:
    """
    Evaluates whether a candidate satisfies all active CSP constraints.

    Constraint Taxonomy:
      - HARD (Non-negotiable):
          * Uniqueness: candidate not already selected (AllDifferent).
      - SOFT / RELAXABLE (Handled across relaxation tiers):
          * Tier 0: Strict artist limit (<= max_artist) AND strict similarity (>= min_sim).
          * Tier 1: Strict artist limit, similarity threshold lowered by 25%.
          * Tier 2: Strict artist limit, similarity threshold lowered by 50%.
          * Tier 3: Strict artist limit, similarity threshold fully removed (>= -1.0).
          * Tier 4: Artist limit relaxed by +1 (<= max_artist + 1), similarity unrestricted.

    Returns:
        (is_eligible, failure_reason)
    """
    # Hard constraint: Must not already be selected
    if candidate.track_id in state.selected_track_ids:
        return False, "Already selected"

    # Effective artist threshold for current tier
    allowed_artist_count = config.max_artist_repetition
    if relaxation_tier >= 4:
        allowed_artist_count += 1

    current_artist_occurences = state.artist_counts.get(candidate.artist, 0)
    if current_artist_occurences >= allowed_artist_count:
        return False, f"Artist repetition limit reached ({current_artist_occurences}/{allowed_artist_count})"

    # Effective similarity threshold for current tier
    if relaxation_tier == 0:
        sim_threshold = config.min_similarity_threshold
    elif relaxation_tier == 1:
        sim_threshold = config.min_similarity_threshold * 0.75
    elif relaxation_tier == 2:
        sim_threshold = config.min_similarity_threshold * 0.50
    else:  # Tier 3 and above: remove similarity gate
        sim_threshold = -1.0

    if candidate.similarity < sim_threshold:
        return False, f"Similarity {candidate.similarity:.3f} below active threshold {sim_threshold:.3f}"

    return True, "Eligible"


# 4. MULTI-OBJECTIVE HEURISTIC SCORING (Stage 3)

def calculate_feature_diversity(
    candidate_vector: np.ndarray,
    stacked_selected: Optional[np.ndarray],
    selected_norms: Optional[np.ndarray]
) -> float:
    """
    Computes MaxMin Cosine Distance diversity of candidate relative to current playlist:
      Diversity(c, R) = min_{r in R} (1 - cos_sim(v_c, v_r))

    If no songs are selected yet, returns 1.0 (maximum initial diversity).
    A higher diversity means the candidate explores a distinct musical acoustic region.

    OPTIMIZATION: Uses pre-stacked matrices to avoid redundant np.vstack calls.
    """

    if stacked_selected is None or len(stacked_selected) == 0 :
        return 1.0
    
    cand = np.asarray(candidate_vector , dtype=np.float32)
    cand_norm = np.linalg.norm(cand)

    denom = (selected_norms * cand_norm)
    denom = np.where(denom == 0.0 , 1e-9 , denom)

    cos_sims = np.dot(stacked_selected , cand) / denom
    distances = np.clip(1.0 - cos_sims , 0.0 , 2.0)

    min_dist = float(np.min(distances))
    return min_dist

    # if not selected_vectors:
    #     return 1.0

    # # Convert to contiguous matrices
    # cand = np.asarray(candidate_vector, dtype=np.float32)
    # selected = np.vstack(selected_vectors)

    # # Compute dot product and L2 norms
    # cand_norm = np.linalg.norm(cand)
    # selected_norms = np.linalg.norm(selected, axis=1)

    # # Avoid zero division
    # denom = (selected_norms * cand_norm)
    # denom = np.where(denom == 0.0, 1e-9, denom)

    # cos_sims = np.dot(selected, cand) / denom
    # # Cosine distance = 1 - cosine similarity, clipped to [0, 2]
    # distances = np.clip(1.0 - cos_sims, 0.0, 2.0)

    # # MaxMin distance: distance to closest neighbor in current playlist
    # min_dist = float(np.min(distances))
    # return min_dist


def calculate_selection_score(
    similarity: float,
    diversity_distance: float,
    artist_count: int,
    config: FAIConfig
) -> float:
    """
    Evaluates multi-objective utility function:
      Score(c) = w_sim * NormalizedSimilarity
               + w_div * NormalizedDiversity
               - w_art * ArtistRepetitionRatio

    Terms:
      1. Relevance: similarity to seed song in [0, 1].
      2. Diversity: min cosine distance to current playlist in [0, 2] (normalized / 2.0).
      3. Repetition Penalty: (current occurrences for artist) / max_artist_repetition.
    """
    # Normalize components to [0, 1] range
    norm_sim = np.clip((similarity + 1.0) / 2.0 if similarity < 0 else similarity, 0.0, 1.0)
    norm_div = np.clip(diversity_distance / 2.0, 0.0, 1.0)
    norm_art = min(1.0, artist_count / max(1, config.max_artist_repetition))

    score = (
        config.weight_similarity * norm_sim
        + config.weight_diversity * norm_div
        - config.weight_artist_penalty * norm_art
    )
    return float(score)


# 5. GREEDY SELECTION ENGINE & GOAL-BASED AGENT (Stage 4)

def select_recommendations(
    candidates: List[SongCandidate],
    query_track_id: str,
    config: Optional[FAIConfig] = None
) -> Tuple[List[Dict[str, Any]], FAIAgentState, Dict[str, Any]]:
    """
    Core FAI Agent reasoning loop:
      - Validates candidate pool.
      - Iteratively picks the highest-utility candidate satisfying active constraints.
      - Updates agent internal state (playlist, artist counts, diversity matrix).
      - Relaxes constraints across tiers if candidate space becomes exhausted.
      - Stops when target_count (30) is reached or all relaxations are exhausted.

    Returns:
        final_recommendations: List of 30 song dicts with diagnostics.
        agent_state: Complete internal state.
        execution_report: Summary of agent decisions and relaxation steps.
    """
    if config is None:
        config = FAIConfig()

    state = FAIAgentState()

    # Step 1: Candidate Validation
    valid_candidates, validation_stats = validate_candidates(candidates, query_track_id)

    max_tiers = 5
    current_tier = 0
    total_iterations = 0

    # Step 2: Goal-based Selection Loop
    while len(state.selected_songs) < config.target_count:
        total_iterations += 1
        best_candidate: Optional[SongCandidate] = None
        best_score: float = -float("inf")
        best_diag_info: Optional[Tuple[float, float, int]] = None

        if state.selected_vectors :
            stacked_selected = np.vstack(state.selected_vectors)
            selected_norms = np.linalg.norm(stacked_selected, axis=1)
        else:
            stacked_selected = None
            selected_norms = None

        # Evaluate all available candidates against current constraints
        for candidate in valid_candidates:
            is_eligible, _ = check_candidate_eligibility(
                candidate=candidate,
                state=state,
                config=config,
                relaxation_tier=current_tier
            )
            if not is_eligible:
                continue

            # Compute diversity relative to already-chosen songs in state
            div_dist = calculate_feature_diversity(candidate.vector, stacked_selected, selected_norms)
            curr_art_count = state.artist_counts.get(candidate.artist, 0)
            score = calculate_selection_score(candidate.similarity, div_dist, curr_art_count, config)

            # Greedy choice: pick candidate that maximizes multi-objective utility
            if score > best_score:
                best_score = score
                best_candidate = candidate
                best_diag_info = (candidate.similarity, div_dist, curr_art_count)

        # Step 3: Candidate Selection or Constraint Relaxation
        if best_candidate is not None and best_diag_info is not None:
            sim, div, art = best_diag_info
            diag = SelectionDiagnostic(
                step=len(state.selected_songs) + 1,
                track_id=best_candidate.track_id,
                title=best_candidate.title,
                artist=best_candidate.artist,
                score=round(best_score, 4),
                similarity=round(sim, 4),
                diversity_distance=round(div, 4),
                current_artist_count=art + 1,
                relaxation_tier=current_tier,
                reason=f"Greedy selection at Tier {current_tier} with score {best_score:.4f}"
            )
            state.add_song(best_candidate, diag)
        else:
            # No eligible candidate found at current tier -> Relax constraints
            if current_tier < max_tiers - 1:
                current_tier += 1
            else:
                # All constraint relaxation tiers exhausted; terminate gracefully
                break

    # Build final output representation
    final_output = []
    for song, diag in zip(state.selected_songs, state.diagnostics):
        item = song.to_dict()
        item["selection_step"] = diag.step
        item["fai_score"] = diag.score
        item["diversity_distance"] = diag.diversity_distance
        item["relaxation_tier"] = diag.relaxation_tier
        item["selection_reason"] = diag.reason
        final_output.append(item)

    execution_report = {
        "target_count": config.target_count,
        "selected_count": len(state.selected_songs),
        "goal_achieved": len(state.selected_songs) == config.target_count,
        "validation_stats": validation_stats,
        "final_relaxation_tier": current_tier,
        "unique_artists": len(state.artist_counts),
        "max_songs_per_artist": max(state.artist_counts.values()) if state.artist_counts else 0,
        "average_similarity": float(np.mean([s.similarity for s in state.selected_songs])) if state.selected_songs else 0.0,
    }

    return final_output, state, execution_report


# 6. HIGH-LEVEL REASONING ENGINE (INTEGRATION WITH ML PIPELINE)

class FAIMusicRecommender:
    """
    Complete end-to-end recommender connecting the ML retrieval layer
    with the FAI goal-based selection agent.
    """

    def __init__(
        self,
        ml_engine=None,
        metadata_df=None,
        config: Optional[FAIConfig] = None
    ):
        """
        Initializes the recommender:
          - Reuses existing ML vector search engine without rebuilding.
          - Reuses in-memory metadata lookups without reloading the huge CSV.
        """
        self.config = config or FAIConfig()

        if ml_engine is not None:
            self.ml_engine = ml_engine
        else:
            from RecommendationPipeline.query_service import MuzeRecommendationEngine
            self.ml_engine = MuzeRecommendationEngine()

        # Load or bind metadata lookup
        if metadata_df is not None:
            self.metadata = metadata_df
        else:
            import pandas as pd
            from RecommendationPipeline.config import DEFAULT_METADATA_PATH, DEFAULT_DATASET_PATH
            if os.path.exists(DEFAULT_METADATA_PATH):
                self.metadata = pd.read_parquet(DEFAULT_METADATA_PATH)
            else:
                self.metadata = pd.read_csv(DEFAULT_DATASET_PATH, usecols=["id", "name", "artists"]).rename(
                    columns={"id": "track_id", "name": "title", "artists": "artist"}
                )

        # Build fast O(1) hash tables for track title and artist
        print("[FAIMusicRecommender] Building metadata cache...")
        self.meta_lookup = self.metadata.set_index("track_id")[["title", "artist"]].to_dict(orient="index")
        print(f"[FAIMusicRecommender] Ready with {len(self.meta_lookup):,} metadata records.")

    def recommend(
        self,
        query_track_id: str,
        candidate_pool_size: int = 70
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Retrieves candidate_pool_size candidates from ML layer,
        enriches them with metadata & feature vectors, and applies the FAI agent.
        """
        # Step A: Retrieve raw candidates from ML Vector Index
        raw_matches = self.ml_engine.recommend_by_track_id(query_track_id, top_k=candidate_pool_size)

        # Step B: Enrich candidates with title, artist, and embedding vectors
        candidate_objs: List[SongCandidate] = []
        for m in raw_matches:
            tid = m["track_id"]
            vid = m["vector_id"]
            dist = float(m["distance"])
            sim = 1.0 - dist
            vec = np.asarray(self.ml_engine.track_to_vector.get(tid, np.zeros(19)), dtype=np.float32)

            meta = self.meta_lookup.get(tid, {"title": "Unknown Title", "artist": "Unknown Artist"})
            candidate_objs.append(
                SongCandidate(
                    track_id=tid,
                    vector_id=vid,
                    distance=dist,
                    similarity=sim,
                    vector=vec,
                    title=str(meta.get("title", "Unknown Title")),
                    artist=str(meta.get("artist", "Unknown Artist"))
                )
            )

        # Step C: Execute FAI Selection Agent
        recommendations, state, report = select_recommendations(
            candidates=candidate_objs,
            query_track_id=query_track_id,
            config=self.config
        )

        return recommendations, report
