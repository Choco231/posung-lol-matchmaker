import trueskill
import itertools
import json

# Setup Elo-like TrueSkill environment (1500.0 scale)
env = trueskill.TrueSkill(mu=1500.0, sigma=500.0, beta=250.0, tau=5.0, draw_probability=0.0)
env.make_as_global()

def update_ratings(team_a_ratings, team_b_ratings, team_a_won: bool):
    """
    team_a_ratings: list of trueskill.Rating objects
    team_b_ratings: list of trueskill.Rating objects
    """
    if team_a_won:
        new_team_a, new_team_b = trueskill.rate([team_a_ratings, team_b_ratings], ranks=[0, 1])
    else:
        new_team_a, new_team_b = trueskill.rate([team_a_ratings, team_b_ratings], ranks=[1, 0])
    return new_team_a, new_team_b

def get_mmr(rating):
    # Standard formula to expose MMR (mu - 3*sigma is conservative, or just mu)
    # Since we want to show a standard Elo-like number, maybe mu * 100
    # Let's just return mu, or a scaled version
    return rating.mu

def is_valid_team(team, positions, team_name, pinned_positions):
    for i, player in enumerate(team):
        pos = positions[i]
        
        # Check impossible positions
        impossible = json.loads(player.impossible_positions) if player.impossible_positions else []
        if pos in impossible:
            return False
            
        # Check pinned positions for this slot
        pin_key = f"{team_name}_{pos}"
        if pin_key in pinned_positions and player.id != pinned_positions[pin_key]:
            return False
            
    return True

def get_team_mmr(team, positions):
    total = 0
    for i, player in enumerate(team):
        pos = positions[i]
        mu = getattr(player, f"{pos}_mu")
        total += mu
    return total

def find_best_matchups(players, pinned_positions=None, top_n=100):
    if pinned_positions is None:
        pinned_positions = {}
        
    positions = ["top", "jungle", "mid", "adc", "support"]
    seen_splits: dict = {}

    a_pinned_ids = [pid for key, pid in pinned_positions.items() if key.startswith("A_")]
    b_pinned_ids = [pid for key, pid in pinned_positions.items() if key.startswith("B_")]

    for team_a_comb in itertools.combinations(players, 5):
        team_b_comb = tuple(p for p in players if p not in team_a_comb)
        
        # Pruning: ensure team_a_comb contains all A-pinned players
        a_ids = [p.id for p in team_a_comb]
        if any(pid not in a_ids for pid in a_pinned_ids):
            continue
            
        # Pruning: ensure team_b_comb contains all B-pinned players
        b_ids = [p.id for p in team_b_comb]
        if any(pid not in b_ids for pid in b_pinned_ids):
            continue

        ids_a = frozenset(a_ids)
        ids_b = frozenset(b_ids)
        
        # Since pinning breaks symmetry, we should NOT use frozenset([ids_a, ids_b]) as the key if there are pins!
        # If there are pins, (A,B) is NOT the same as (B,A).
        if pinned_positions:
            split_key = (ids_a, ids_b)
        else:
            split_key = frozenset([ids_a, ids_b])

        for perm_a in itertools.permutations(team_a_comb):
            if not is_valid_team(perm_a, positions, "A", pinned_positions):
                continue

            for perm_b in itertools.permutations(team_b_comb):
                if not is_valid_team(perm_b, positions, "B", pinned_positions):
                    continue

                mmr_a = get_team_mmr(perm_a, positions)
                mmr_b = get_team_mmr(perm_b, positions)
                diff = abs(mmr_a - mmr_b)

                existing = seen_splits.get(split_key)
                if existing is None or diff < existing["diff"]:
                    seen_splits[split_key] = {
                        "team_a": [p.id for p in perm_a],
                        "team_b": [p.id for p in perm_b],
                        "mmr_a": mmr_a,
                        "mmr_b": mmr_b,
                        "diff": diff,
                    }

    all_matchups = sorted(seen_splits.values(), key=lambda x: x["diff"])
    return all_matchups[:top_n]
