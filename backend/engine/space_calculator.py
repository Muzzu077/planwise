import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"


def load_json(filename: str) -> dict:
    with open(DATA_DIR / filename) as f:
        return json.load(f)


def calculate_buildable_area(
    plot_length: float,
    plot_width: float,
    facing: str,
) -> dict:
    """Calculate the buildable area after applying setback rules."""
    constraints = load_json("constraints.json")
    setbacks = constraints["setback_rules"]["default"]
    building_rules = constraints["building_rules"]

    # The 'front' setback is on the road-facing side
    # Determine which dimension the setbacks reduce
    # For north/south facing: front/rear reduce the width (depth from road)
    # For east/west facing: front/rear reduce the length

    if facing in ("north", "south"):
        buildable_length = plot_length - setbacks["left"] - setbacks["right"]
        buildable_width = plot_width - setbacks["front"] - setbacks["rear"]
    else:  # east or west
        buildable_length = plot_length - setbacks["front"] - setbacks["rear"]
        buildable_width = plot_width - setbacks["left"] - setbacks["right"]

    plot_area = plot_length * plot_width
    buildable_area = buildable_length * buildable_width

    # Apply ground coverage limit
    max_coverage = plot_area * building_rules["max_ground_coverage"]
    effective_buildable = min(buildable_area, max_coverage)

    return {
        "plot_area": plot_area,
        "plot_length": plot_length,
        "plot_width": plot_width,
        "setbacks": setbacks,
        "buildable_length": buildable_length,
        "buildable_width": buildable_width,
        "buildable_area": buildable_area,
        "max_ground_coverage": max_coverage,
        "effective_buildable_area": effective_buildable,
        "max_fsi": building_rules["max_fsi"],
        "max_total_built_area": plot_area * building_rules["max_fsi"],
    }


def get_required_rooms(house_type: str) -> list[str]:
    """Get the list of rooms needed for a house type."""
    templates = load_json("house_templates.json")
    if house_type not in templates:
        raise ValueError(f"Unknown house type: {house_type}")
    return templates[house_type]["rooms"]


def get_room_specs(room_type: str) -> dict:
    """Get min/max dimensions for a room type."""
    rules = load_json("room_rules.json")
    if room_type not in rules["rooms"]:
        raise ValueError(f"Unknown room type: {room_type}")
    return rules["rooms"][room_type]


def validate_plot_for_house_type(
    plot_length: float, plot_width: float, house_type: str
) -> dict:
    """Check if a plot is large enough for the requested house type."""
    templates = load_json("house_templates.json")
    if house_type not in templates:
        return {"valid": False, "reason": f"Unknown house type: {house_type}"}

    template = templates[house_type]
    plot_area = plot_length * plot_width

    if plot_area < template["min_area"]:
        return {
            "valid": False,
            "reason": (
                f"Plot area ({plot_area} sqft) is too small for {house_type}. "
                f"Minimum required: {template['min_area']} sqft. "
                f"Typical range: {template['typical_area']}."
            ),
        }

    return {"valid": True, "reason": "Plot size is adequate"}
