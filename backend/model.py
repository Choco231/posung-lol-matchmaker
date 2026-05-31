import trueskill
import itertools
import json

# Setup default TrueSkill environment (50.0 scale).
INITIAL_SIGMA = 40.0
REAL_MATCH_TAU = 10.0
SETTLED_SIGMA = 9.0
SIGMA_SETTLE_MATCHES = 15
REAL_MATCH_SIGMA_DECAY = (INITIAL_SIGMA - SETTLED_SIGMA) / SIGMA_SETTLE_MATCHES

env = trueskill.TrueSkill(mu=50.0, sigma=INITIAL_SIGMA, beta=8.333, tau=REAL_MATCH_TAU, draw_probability=0.0)
env.make_as_global()

def update_ratings(team_a_ratings, team_b_ratings, team_a_won: bool, tau: float = None):
    """
    team_a_ratings: list of trueskill.Rating objects
    team_b_ratings: list of trueskill.Rating objects
    """
    rating_env = env if tau is None else trueskill.TrueSkill(
        mu=env.mu,
        sigma=env.sigma,
        beta=env.beta,
        tau=tau,
        draw_probability=env.draw_probability,
    )
    if team_a_won:
        new_team_a, new_team_b = rating_env.rate([team_a_ratings, team_b_ratings], ranks=[0, 1])
    else:
        new_team_a, new_team_b = rating_env.rate([team_a_ratings, team_b_ratings], ranks=[1, 0])
    return new_team_a, new_team_b

def get_mmr(rating):
    # Standard formula to expose MMR (mu - 3*sigma is conservative, or just mu)
    # Since we want to show a standard Elo-like number, maybe mu * 100
    # Let's just return mu, or a scaled version
    return rating.mu

def normalize_position_pins(pinned_positions, positions):
    normalized = {pos: [] for pos in positions}
    for pos, player_ids in (pinned_positions or {}).items():
        if pos not in normalized:
            continue
        if player_ids is None:
            continue
        if not isinstance(player_ids, list):
            player_ids = [player_ids]
        unique_ids = []
        for player_id in player_ids:
            if player_id not in unique_ids:
                unique_ids.append(player_id)
        normalized[pos] = unique_ids[:2]
    return normalized

def is_valid_team(team, positions):
    for i, player in enumerate(team):
        pos = positions[i]
        
        # Check impossible positions
        impossible = json.loads(player.impossible_positions) if player.impossible_positions else []
        if pos in impossible:
            return False

    return True

def satisfies_position_pins(team_a, team_b, positions, pinned_positions):
    for i, pos in enumerate(positions):
        pinned_ids = pinned_positions.get(pos, [])
        if not pinned_ids:
            continue
        assigned_ids = {team_a[i].id, team_b[i].id}
        if any(player_id not in assigned_ids for player_id in pinned_ids):
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
    positions = ["top", "jungle", "mid", "adc", "support"]
    pinned_positions = normalize_position_pins(pinned_positions, positions)
    pinned_ids = {
        player_id
        for player_ids in pinned_positions.values()
        for player_id in player_ids
    }
    selected_ids = {player.id for player in players}
    if not pinned_ids.issubset(selected_ids):
        return []

    seen_splits: dict = {}

    for team_a_comb in itertools.combinations(players, 5):
        team_b_comb = tuple(p for p in players if p not in team_a_comb)

        ids_a = frozenset(p.id for p in team_a_comb)
        ids_b = frozenset(p.id for p in team_b_comb)
        split_key = frozenset([ids_a, ids_b])

        for perm_a in itertools.permutations(team_a_comb):
            if not is_valid_team(perm_a, positions):
                continue

            for perm_b in itertools.permutations(team_b_comb):
                if not is_valid_team(perm_b, positions):
                    continue
                if not satisfies_position_pins(perm_a, perm_b, positions, pinned_positions):
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
