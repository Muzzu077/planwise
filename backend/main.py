"""
PlanWise — Pre-Construction Intelligence System
FastAPI Backend
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models.schemas import (
    PlanRequest, PlanResponse, VariationResult,
    RoomOutput, CorridorOutput, CostBreakdown, PhaseWiseCost, BudgetAnalysis,
)
from engine.layout_generator import LayoutGenerator
from engine.cost_engine import estimate_cost
from engine.explainer import generate_explanations

app = FastAPI(
    title="PlanWise API",
    description="Pre-Construction Intelligence System — Generate realistic house plans with cost estimation",
    version="2.0.0",
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
        "version": "2.0.0",
        "status": "running",
    }


def _build_variation(layout_result: dict, request: PlanRequest) -> VariationResult | None:
    """Build a VariationResult from a layout result."""
    if not layout_result.get("success"):
        return None

    built_area = layout_result["built_area"]
    cost_result = estimate_cost(
        built_area=built_area,
        cost_tier=request.cost_tier.value,
        floors=request.floors,
        plot_length=request.plot_length,
        plot_width=request.plot_width,
        has_parking=request.parking,
    )

    req_dict = {
        "plot_length": request.plot_length,
        "plot_width": request.plot_width,
        "house_type": request.house_type.value,
        "floors": request.floors,
        "facing": request.facing.value,
        "vastu_compliant": request.vastu_compliant,
        "parking": request.parking,
    }
    all_explanations = generate_explanations(layout_result, cost_result, req_dict)

    rooms = [RoomOutput(**r) for r in layout_result["rooms"]]
    corridor = CorridorOutput(**layout_result["corridor"]) if layout_result.get("corridor") else None

    # Budget analysis
    budget_analysis = None
    if request.budget:
        total_cost = cost_result["cost_breakdown"]["total_cost"]
        within = total_cost <= request.budget
        diff = request.budget - total_cost
        if within:
            suggestion = f"Your plan is within budget with ₹{abs(diff):,.0f} to spare."
        else:
            suggestion = (
                f"Plan exceeds budget by ₹{abs(diff):,.0f}. "
                f"Consider: reducing floors, choosing economy tier, "
                f"or a smaller house type."
            )
        budget_analysis = BudgetAnalysis(
            budget=request.budget,
            estimated_cost=total_cost,
            within_budget=within,
            difference=round(diff),
            suggestion=suggestion,
        )

    return VariationResult(
        variation_name=layout_result.get("variation_name", "Standard Layout"),
        variation_description=layout_result.get("variation_description", ""),
        success=True,
        plot_area=layout_result["plot_area"],
        buildable_area=layout_result["buildable_area"],
        built_area=layout_result["built_area"],
        rooms=rooms,
        corridor=corridor,
        cost=CostBreakdown(**cost_result["cost_breakdown"]),
        phase_wise_cost=PhaseWiseCost(**cost_result["phase_wise_cost"]),
        explanations=all_explanations,
        warnings=layout_result.get("warnings", []),
        vastu_notes=layout_result.get("vastu_notes", []),
        budget_analysis=budget_analysis,
    )


@app.post("/generate-plan", response_model=PlanResponse)
def generate_plan(request: PlanRequest):
    """Generate house plan(s) based on plot dimensions and requirements."""

    req_dict = {
        "plot_length": request.plot_length,
        "plot_width": request.plot_width,
        "house_type": request.house_type.value,
        "floors": request.floors,
        "facing": request.facing.value,
        "vastu_compliant": request.vastu_compliant,
        "parking": request.parking,
        "budget": request.budget,
    }

    # Generate primary layout
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

    # Generate variations
    variation_results = generator.generate_variations(count=3)
    variations = []
    for vr in variation_results:
        vr_copy = dict(vr)  # It's already a dict from generate_variations
        v = _build_variation(vr_copy, request)
        if v:
            variations.append(v)

    # Build primary response from first variation or main result
    built_area = layout_result["built_area"]
    cost_result = estimate_cost(
        built_area=built_area,
        cost_tier=request.cost_tier.value,
        floors=request.floors,
        plot_length=request.plot_length,
        plot_width=request.plot_width,
        has_parking=request.parking,
    )

    all_explanations = generate_explanations(layout_result, cost_result, req_dict)
    rooms = [RoomOutput(**r) for r in layout_result["rooms"]]
    corridor = CorridorOutput(**layout_result["corridor"]) if layout_result.get("corridor") else None

    # Budget analysis
    budget_analysis = None
    if request.budget:
        total_cost = cost_result["cost_breakdown"]["total_cost"]
        within = total_cost <= request.budget
        diff = request.budget - total_cost
        if within:
            suggestion = f"Your plan is within budget with ₹{abs(diff):,.0f} to spare."
        else:
            suggestion = (
                f"Plan exceeds budget by ₹{abs(diff):,.0f}. "
                f"Consider: reducing floors, choosing economy tier, "
                f"or a smaller house type."
            )
        budget_analysis = BudgetAnalysis(
            budget=request.budget,
            estimated_cost=total_cost,
            within_budget=within,
            difference=round(diff),
            suggestion=suggestion,
        )

    return PlanResponse(
        success=True,
        plot_area=layout_result["plot_area"],
        buildable_area=layout_result["buildable_area"],
        built_area=layout_result["built_area"],
        rooms=rooms,
        corridor=corridor,
        cost=CostBreakdown(**cost_result["cost_breakdown"]),
        phase_wise_cost=PhaseWiseCost(**cost_result["phase_wise_cost"]),
        explanations=all_explanations,
        warnings=layout_result.get("warnings", []),
        vastu_notes=layout_result.get("vastu_notes", []),
        budget_analysis=budget_analysis,
        variations=variations,
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
