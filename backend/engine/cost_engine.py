"""
PlanWise Cost Estimation Engine

Calculates construction costs based on:
- Built-up area
- Cost tier (economy/standard/premium)
- Number of floors
- Additional items (parking, staircase, boundary wall)
"""

from .space_calculator import load_json


def estimate_cost(
    built_area: float,
    cost_tier: str = "standard",
    floors: int = 1,
    plot_length: float = 0,
    plot_width: float = 0,
    has_parking: bool = False,
) -> dict:
    """Generate a complete cost estimation."""
    cost_data = load_json("cost_data.json")

    # Base cost per sqft
    tier_data = cost_data["construction_cost_per_sqft"].get(cost_tier)
    if not tier_data:
        tier_data = cost_data["construction_cost_per_sqft"]["standard"]

    rate = tier_data["rate"]

    # Total built area across floors
    total_built_area = built_area * floors

    # Base construction cost
    base_cost = total_built_area * rate

    # Additional costs
    additional = cost_data["additional_costs"]
    extra_costs = 0
    extra_details = []

    if has_parking:
        parking_cost = 100 * additional["parking_per_sqft"]  # ~100 sqft parking
        extra_costs += parking_cost
        extra_details.append(f"Car parking: ₹{parking_cost:,.0f}")

    if floors > 1:
        stair_cost = additional["staircase_per_floor"] * (floors - 1)
        extra_costs += stair_cost
        extra_details.append(f"Staircase ({floors - 1} floor(s)): ₹{stair_cost:,.0f}")

    # Boundary wall
    if plot_length > 0 and plot_width > 0:
        perimeter = 2 * (plot_length + plot_width)
        wall_cost = perimeter * additional["boundary_wall_per_rft"]
        extra_costs += wall_cost
        extra_details.append(f"Boundary wall ({perimeter:.0f} rft): ₹{wall_cost:,.0f}")

    # Fixed additional costs
    extra_costs += additional["septic_tank"] + additional["water_tank"]
    extra_details.append(f"Septic tank: ₹{additional['septic_tank']:,.0f}")
    extra_details.append(f"Water tank: ₹{additional['water_tank']:,.0f}")

    total_cost = base_cost + extra_costs

    # Cost breakdown
    breakdown_ratios = cost_data["cost_breakdown_ratio"]
    cost_breakdown = {
        "total_cost": round(total_cost),
        "materials": round(total_cost * breakdown_ratios["materials"]),
        "labor": round(total_cost * breakdown_ratios["labor"]),
        "plumbing_electrical": round(total_cost * breakdown_ratios["plumbing_electrical"]),
        "finishing": round(total_cost * breakdown_ratios["finishing"]),
        "miscellaneous": round(total_cost * breakdown_ratios["miscellaneous"]),
    }

    # Phase-wise breakdown
    phase_ratios = cost_data["phase_wise_ratio"]
    phase_wise = {
        phase: round(total_cost * ratio)
        for phase, ratio in phase_ratios.items()
    }

    return {
        "cost_breakdown": cost_breakdown,
        "phase_wise_cost": phase_wise,
        "rate_per_sqft": rate,
        "cost_tier": cost_tier,
        "tier_description": tier_data["description"],
        "total_built_area": total_built_area,
        "extra_details": extra_details,
    }
