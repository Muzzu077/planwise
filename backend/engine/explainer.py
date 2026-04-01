"""
PlanWise Explanation Engine

Generates human-readable explanations for why the layout
was designed the way it was. Builds trust with the user.
"""


def generate_explanations(
    layout_result: dict,
    cost_result: dict,
    request: dict,
) -> list[str]:
    """Generate comprehensive explanations for the plan."""
    explanations = list(layout_result.get("explanations", []))

    plot_area = layout_result["plot_area"]
    buildable = layout_result["buildable_area"]
    built = layout_result["built_area"]
    rooms = layout_result["rooms"]

    # Area summary
    explanations.insert(0,
        f"Your plot is {request['plot_length']}×{request['plot_width']} ft "
        f"({plot_area:.0f} sqft). After mandatory setbacks, "
        f"{buildable:.0f} sqft is available for construction."
    )

    # Room summary
    room_summary = ", ".join(
        f"{r['name']} ({r['width']}×{r['length']} ft, {r['area']} sqft)"
        for r in rooms
    )
    explanations.append(f"Rooms planned: {room_summary}.")

    # Cost summary
    total = cost_result["cost_breakdown"]["total_cost"]
    rate = cost_result["rate_per_sqft"]
    tier = cost_result["cost_tier"]
    explanations.append(
        f"Estimated cost: ₹{total:,.0f} at ₹{rate}/sqft ({tier} tier). "
        f"This covers materials, labor, plumbing, electrical, and finishing."
    )

    # Additional cost details
    if cost_result.get("extra_details"):
        extras = "; ".join(cost_result["extra_details"])
        explanations.append(f"Additional costs included: {extras}.")

    # Floor info
    floors = request.get("floors", 1)
    if floors > 1:
        explanations.append(
            f"Plan is for {floors} floors. "
            f"Total built-up area across all floors: "
            f"{cost_result['total_built_area']:.0f} sqft. "
            f"Ground floor: living areas & kitchen. "
            f"Upper floor(s): bedrooms & private spaces."
        )

    # Multi-floor construction notes
    if floors == 2:
        explanations.append(
            "For G+1: Staircase placement should be near the entrance or center. "
            "Upper floor bedrooms benefit from the privacy of being above the living areas."
        )
    elif floors == 3:
        explanations.append(
            "For G+2: Ensure structural walls align across all floors. "
            "Consider placing utility areas (water tank, overhead storage) on the terrace level."
        )

    # Vastu note
    if request.get("vastu_compliant", True):
        explanations.append(
            "Vastu Shastra guidelines have been applied to room placement. "
            "Note: This is a preliminary plan. Consult a professional architect "
            "for structural validation before construction."
        )

    # Disclaimer
    explanations.append(
        "IMPORTANT: This is a pre-construction planning aid, not a certified "
        "architectural plan. Always consult a licensed architect/engineer "
        "before starting construction."
    )

    return explanations
