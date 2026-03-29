"""
generate_data.py — Synthetic Garbage Data Generator for Mumbai

Generates realistic training data by simulating garbage intensity
based on location characteristics, time of day, day of week,
and area-specific factors (population density, market proximity).

Output: training_data.csv with ~5000 rows
"""

import numpy as np
import pandas as pd
import os

np.random.seed(42)

# ─── Mumbai Location Grid ─────────────────────────────────────
# Known waste hotspot locations from the actual database
KNOWN_LOCATIONS = [
    {"lat": 19.0596, "lng": 72.8295, "area": "Bandra West",       "pop_density": 0.9, "market_score": 0.8},
    {"lat": 19.1136, "lng": 72.8697, "area": "Andheri East",      "pop_density": 0.85, "market_score": 0.9},
    {"lat": 19.1075, "lng": 72.8263, "area": "Juhu Beach",        "pop_density": 0.5, "market_score": 0.3},
    {"lat": 19.0178, "lng": 72.8478, "area": "Dadar Station",     "pop_density": 0.95, "market_score": 0.95},
    {"lat": 19.0002, "lng": 72.8155, "area": "Worli Sea Face",    "pop_density": 0.6, "market_score": 0.4},
    {"lat": 19.0759, "lng": 72.8776, "area": "CST Area",          "pop_density": 0.92, "market_score": 0.85},
    {"lat": 19.0896, "lng": 72.8656, "area": "Sion",              "pop_density": 0.7, "market_score": 0.6},
    {"lat": 19.1334, "lng": 72.9133, "area": "Powai Lake",        "pop_density": 0.55, "market_score": 0.35},
    {"lat": 19.0544, "lng": 72.8406, "area": "Mahim Beach",       "pop_density": 0.65, "market_score": 0.5},
    {"lat": 19.1763, "lng": 72.9486, "area": "Mulund West",       "pop_density": 0.6, "market_score": 0.55},
    {"lat": 19.2183, "lng": 72.9781, "area": "Thane Station",     "pop_density": 0.8, "market_score": 0.75},
    {"lat": 19.0430, "lng": 72.8200, "area": "Prabhadevi",        "pop_density": 0.75, "market_score": 0.7},
    {"lat": 19.1197, "lng": 72.9052, "area": "Kurla West",        "pop_density": 0.78, "market_score": 0.65},
    {"lat": 19.0657, "lng": 72.8370, "area": "Bandra East",       "pop_density": 0.72, "market_score": 0.6},
    {"lat": 19.1550, "lng": 72.8494, "area": "Goregaon East",     "pop_density": 0.68, "market_score": 0.7},
]

# Additional grid points to increase coverage across Mumbai
EXTRA_GRID = [
    {"lat": 19.0300, "lng": 72.8350, "area": "Lower Parel",      "pop_density": 0.82, "market_score": 0.78},
    {"lat": 19.0850, "lng": 72.8900, "area": "Chembur",           "pop_density": 0.65, "market_score": 0.55},
    {"lat": 19.1450, "lng": 72.8350, "area": "Malad",             "pop_density": 0.70, "market_score": 0.65},
    {"lat": 19.2000, "lng": 72.8600, "area": "Borivali",          "pop_density": 0.72, "market_score": 0.60},
    {"lat": 19.0100, "lng": 72.8300, "area": "Mahalaxmi",         "pop_density": 0.60, "market_score": 0.50},
    {"lat": 19.0650, "lng": 72.8700, "area": "Wadala",            "pop_density": 0.68, "market_score": 0.58},
    {"lat": 19.1700, "lng": 72.8500, "area": "Kandivali",         "pop_density": 0.74, "market_score": 0.62},
    {"lat": 19.1000, "lng": 72.8500, "area": "Vile Parle",        "pop_density": 0.76, "market_score": 0.72},
]

ALL_LOCATIONS = KNOWN_LOCATIONS + EXTRA_GRID

# ─── Intensity Calculation Engine ─────────────────────────────


def compute_intensity(lat, lng, hour, day_of_week, pop_density, market_score):
    """
    Compute garbage intensity (0–1) based on multiple factors.

    Logic:
    - Base intensity from population density and market proximity
    - Time modifiers: garbage peaks in morning (6–10 AM) and evening (5–8 PM)
    - Day modifiers: weekends and Fridays generate more waste
    - Festival boost: random spikes simulating festivals
    - Location-specific noise
    """
    # Base: weighted combination of population and market factors
    base = 0.3 * pop_density + 0.25 * market_score

    # ── Time-of-day modifier ──
    if 6 <= hour <= 10:      # Morning rush — high garbage generation
        time_mod = 0.25
    elif 17 <= hour <= 20:   # Evening market hours
        time_mod = 0.20
    elif 11 <= hour <= 16:   # Midday — moderate
        time_mod = 0.10
    elif 21 <= hour <= 23:   # Late night — post-dinner waste
        time_mod = 0.12
    else:                    # Early morning (0–5) — low
        time_mod = 0.02

    # ── Day-of-week modifier ──
    if day_of_week >= 5:     # Weekend (Sat=5, Sun=6)
        day_mod = 0.18
    elif day_of_week == 4:   # Friday
        day_mod = 0.12
    else:                    # Weekday
        day_mod = 0.05

    # ── Combine and add noise ──
    intensity = base + time_mod + day_mod
    noise = np.random.normal(0, 0.06)
    intensity += noise

    # Clamp to [0, 1]
    return float(np.clip(intensity, 0.0, 1.0))


def generate_dataset(n_samples=5000):
    """Generate n_samples rows of synthetic garbage data."""
    rows = []

    for _ in range(n_samples):
        # Pick a random location (with slight jitter)
        loc = ALL_LOCATIONS[np.random.randint(len(ALL_LOCATIONS))]
        lat = loc["lat"] + np.random.normal(0, 0.005)
        lng = loc["lng"] + np.random.normal(0, 0.005)
        pop_density = loc["pop_density"]
        market_score = loc["market_score"]

        # Random time
        hour = np.random.randint(0, 24)
        day_of_week = np.random.randint(0, 7)
        is_weekend = 1 if day_of_week >= 5 else 0

        # Compute target
        intensity = compute_intensity(lat, lng, hour, day_of_week, pop_density, market_score)

        rows.append({
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "hour": hour,
            "day_of_week": day_of_week,
            "is_weekend": is_weekend,
            "population_density": round(pop_density, 3),
            "market_proximity": round(market_score, 3),
            "intensity": round(intensity, 4),
        })

    return pd.DataFrame(rows)


if __name__ == "__main__":
    print("🗑️  Generating synthetic garbage data for Mumbai...")
    df = generate_dataset(5000)

    out_path = os.path.join(os.path.dirname(__file__), "training_data.csv")
    df.to_csv(out_path, index=False)

    print(f"✅ Generated {len(df)} samples → {out_path}")
    print(f"\n📊 Intensity distribution:")
    print(f"   Mean:   {df['intensity'].mean():.3f}")
    print(f"   Median: {df['intensity'].median():.3f}")
    print(f"   Min:    {df['intensity'].min():.3f}")
    print(f"   Max:    {df['intensity'].max():.3f}")
    print(f"\n📋 Sample rows:")
    print(df.head(10).to_string(index=False))
