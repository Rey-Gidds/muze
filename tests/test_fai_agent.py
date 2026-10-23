"""
test_fai_agent.py
-----------------
Automated test suite using pytest and synthetic song candidates to verify
all FAI layer invariants, constraints, scoring, diversity, and fallback behaviors.
"""

import sys
import os
import pytest
import numpy as np

# Ensure root directory is accessible
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.fai_agent import (
    SongCandidate,
    FAIConfig,
    FAIAgentState,
    validate_candidates,
    check_candidate_eligibility,
    calculate_feature_diversity,
    calculate_selection_score,
    select_recommendations
)


# FIXTURES & SYNTHETIC DATA GENERATORS

def make_candidate(
    track_id: str,
    artist: str,
    similarity: float,
    vector: np.ndarray = None,
    title: str = "Test Song"
) -> SongCandidate:
    """Helper to instantiate a synthetic candidate with a normalized 19-dim vector."""
    if vector is None:
        v = np.random.RandomState(hash(track_id) % 2**32).randn(19).astype(np.float32)
        vector = v / np.linalg.norm(v)
    return SongCandidate(
        track_id=track_id,
        vector_id=hash(track_id) % 100000,
        distance=1.0 - similarity,
        similarity=similarity,
        vector=vector,
        title=title,
        artist=artist
    )


# TEST CASES

def test_query_exclusion():
    """Requirement: The query song must never appear in recommendations."""
    query_id = "query_song_001"
    candidates = [
        make_candidate(query_id, "Artist A", 0.99, title="Seed Track"),
        make_candidate("track_1", "Artist B", 0.85),
        make_candidate("track_2", "Artist C", 0.80),
    ]

    valid, stats = validate_candidates(candidates, query_track_id=query_id)
    assert stats["removed_query_song"] == 1
    assert query_id not in [c.track_id for c in valid]

    recs, state, report = select_recommendations(candidates, query_track_id=query_id, config=FAIConfig(target_count=2))
    assert all(r["track_id"] != query_id for r in recs)


def test_duplicate_prevention():
    """Requirement: Duplicate track IDs in the candidate pool must be eliminated."""
    candidates = [
        make_candidate("duplicate_id", "Artist A", 0.90),
        make_candidate("duplicate_id", "Artist A", 0.90),
        make_candidate("unique_1", "Artist B", 0.85),
    ]

    valid, stats = validate_candidates(candidates, query_track_id="seed")
    assert stats["removed_duplicates"] == 1
    assert len(valid) == 2
    assert len({c.track_id for c in valid}) == 2


def test_artist_limit_enforcement():
    """Requirement: Artist limit (default <= 3) must be strictly enforced."""
    candidates = [
        make_candidate(f"track_{i}", "Dominant Artist", 0.95 - i * 0.01)
        for i in range(10)
    ] + [
        make_candidate(f"other_track_{i}", f"Diverse Artist {i}", 0.70)
        for i in range(10)
    ]

    config = FAIConfig(target_count=8, max_artist_repetition=3, min_similarity_threshold=0.50)
    recs, state, report = select_recommendations(candidates, query_track_id="seed", config=config)

    artist_counts = {}
    for r in recs:
        artist_counts[r["artist"]] = artist_counts.get(r["artist"], 0) + 1

    assert artist_counts["Dominant Artist"] <= 3, "Dominant Artist exceeded limit of 3!"
    assert len(recs) == 8


def test_similarity_threshold_enforcement():
    """Requirement: Candidates below the active similarity threshold are rejected at Tier 0."""
    state = FAIAgentState()
    config = FAIConfig(min_similarity_threshold=0.60)

    good_cand = make_candidate("good", "Artist A", 0.75)
    bad_cand = make_candidate("bad", "Artist B", 0.45)

    is_ok, reason = check_candidate_eligibility(good_cand, state, config, relaxation_tier=0)
    assert is_ok is True

    is_ok, reason = check_candidate_eligibility(bad_cand, state, config, relaxation_tier=0)
    assert is_ok is False
    assert "below active threshold" in reason


def test_score_calculation():
    """Requirement: Mathematical scoring function must match the specified formula."""
    config = FAIConfig(
        weight_similarity=0.60,
        weight_diversity=0.30,
        weight_artist_penalty=0.10,
        max_artist_repetition=3
    )
    similarity = 0.80
    diversity_dist = 1.0   # normalized to 1.0 / 2.0 = 0.50
    artist_count = 1       # normalized to 1 / 3 = 0.3333

    expected_score = (0.60 * 0.80) + (0.30 * 0.50) - (0.10 * (1.0 / 3.0))
    actual_score = calculate_selection_score(similarity, diversity_dist, artist_count, config)

    assert pytest.approx(actual_score, rel=1e-4) == expected_score


def test_feature_diversity_calculation():
    """Requirement: Intra-list diversity is measured correctly using MaxMin cosine distance."""
    # Empty list -> max diversity (1.0)
    v1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert calculate_feature_diversity(v1, []) == 1.0

    # Exactly identical vector -> distance is 0.0
    v2 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert pytest.approx(calculate_feature_diversity(v2, [v1]), abs=1e-5) == 0.0

    # Orthogonal vector -> distance is 1.0 (cosine sim = 0 -> distance = 1 - 0 = 1.0)
    v3 = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    assert pytest.approx(calculate_feature_diversity(v3, [v1]), abs=1e-5) == 1.0


def test_deterministic_selection():
    """Requirement: The greedy selection process must be 100% deterministic."""
    np.random.seed(42)
    candidates = [
        make_candidate(f"track_{i}", f"Artist_{i % 5}", 0.50 + (i % 50) * 0.01)
        for i in range(60)
    ]
    config = FAIConfig(target_count=15)

    recs1, _, _ = select_recommendations(candidates, query_track_id="seed", config=config)
    recs2, _, _ = select_recommendations(candidates, query_track_id="seed", config=config)

    tids1 = [r["track_id"] for r in recs1]
    tids2 = [r["track_id"] for r in recs2]
    assert tids1 == tids2, "Selection must be strictly reproducible."


def test_insufficient_candidates_and_fallback():
    """
    Requirement: When candidates are scarce, the agent must gracefully relax soft
    constraints across tiers and return all available valid songs without crashing.
    """
    # Only 5 candidates provided, but target_count is 30
    candidates = [
        make_candidate(f"scarce_{i}", f"Artist_{i}", 0.30)  # Below initial 0.50 threshold
        for i in range(5)
    ]

    config = FAIConfig(target_count=30, min_similarity_threshold=0.50)
    recs, state, report = select_recommendations(candidates, query_track_id="seed", config=config)

    assert len(recs) == 5
    assert report["goal_achieved"] is False
    assert report["final_relaxation_tier"] > 0
    # Crucial: Hard constraints are NEVER violated even during fallback
    assert len(set(r["track_id"] for r in recs)) == 5


def test_metadata_and_vector_mapping():
    """Requirement: Selected tracks retain their metadata and valid vector dimensions."""
    candidates = [
        make_candidate("track_alpha", "Queen", 0.92, title="Bohemian Rhapsody"),
        make_candidate("track_beta", "Pink Floyd", 0.88, title="Comfortably Numb"),
    ]
    recs, state, _ = select_recommendations(candidates, query_track_id="seed", config=FAIConfig(target_count=2))

    assert len(recs) == 2
    assert recs[0]["artist"] in ["Queen", "Pink Floyd"]
    assert recs[0]["title"] in ["Bohemian Rhapsody", "Comfortably Numb"]
    assert "fai_score" in recs[0]
    assert "diversity_distance" in recs[0]
