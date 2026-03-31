"""
PlanWise — Pre-Construction Intelligence System
FastAPI Backend
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models.schemas import PlanRequest, PlanResponse, RoomOutput, CostBreakdown, PhaseWiseCost
from engine.layout_generator import LayoutGenerator
from engine.cost_engine import estimate_cost
from engine.explainer import generate_explanations

app = FastAPI(
    title="PlanWise API",
    description="Pre-Construction Intelligence System — Generate realistic house plans with cost estimation",
    version="1.0.0",
)

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "PlanWise",
        "tagline": "Pre-Construction Intelligence System",
        "version": "1.0.0",
        "status": "running",
    }


@app.post("/generate-plan", response_model=PlanResponse)
def generate_plan(request: PlanRequest):
    """Generate a house plan based on plot dimensions and requirements."""

    # Convert request to dict for engine
    req_dict = {
        "plot_length": request.plot_length,
        "plot_width": request.plot_width,
        "house_type": request.house_type.value,
        "floors": request.floors,
        "facing": request.facing.value,
        "vastu_compliant": request.vastu_compliant,
        "parking": request.parking,
    }

    # Generate layout
    generator = LayoutGenerator(req_dict)
    layout_result = generator.generate()

    if not layout_result["success"]:
        raise HTTPException(
            status_code=400,
            detail={
                "error": layout_result.get("error", "Could not generate plan"),
                "warnings": layout_result.get("warnings", []),
            }
        )

    # Calculate costs
    built_area = layout_result["built_area"]
    cost_result = estimate_cost(
        built_area=built_area,
        cost_tier=request.cost_tier.value,
        floors=request.floors,
        plot_length=request.plot_length,
        plot_width=request.plot_width,
        has_parking=request.parking,
    )

    # Generate explanations
    all_explanations = generate_explanations(layout_result, cost_result, req_dict)

    # Build response
    rooms = [RoomOutput(**r) for r in layout_result["rooms"]]

    return PlanResponse(
        success=True,
        plot_area=layout_result["plot_area"],
        buildable_area=layout_result["buildable_area"],
        built_area=layout_result["built_area"],
        rooms=rooms,
        cost=CostBreakdown(**cost_result["cost_breakdown"]),
        phase_wise_cost=PhaseWiseCost(**cost_result["phase_wise_cost"]),
        explanations=all_explanations,
        warnings=layout_result.get("warnings", []),
        vastu_notes=layout_result.get("vastu_notes", []),
    )


@app.get("/house-types")
def get_house_types():
    """Return available house types and their requirements."""
    from engine.space_calculator import load_json
    return load_json("house_templates.json")


@app.get("/cost-tiers")
def get_cost_tiers():
    """Return available cost tiers."""
    from engine.space_calculator import load_json
    data = load_json("cost_data.json")
    return data["construction_cost_per_sqft"]
