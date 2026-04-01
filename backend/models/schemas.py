from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class FacingDirection(str, Enum):
    NORTH = "north"
    SOUTH = "south"
    EAST = "east"
    WEST = "west"


class HouseType(str, Enum):
    BHK_1 = "1BHK"
    BHK_2 = "2BHK"
    BHK_3 = "3BHK"
    BHK_2_POOJA = "2BHK_with_pooja"
    BHK_3_POOJA = "3BHK_with_pooja"


class CostTier(str, Enum):
    ECONOMY = "economy"
    STANDARD = "standard"
    PREMIUM = "premium"


class PlanRequest(BaseModel):
    plot_length: float = Field(..., gt=10, le=200, description="Plot length in feet")
    plot_width: float = Field(..., gt=10, le=200, description="Plot width in feet")
    house_type: HouseType = Field(..., description="Type of house (1BHK, 2BHK, etc.)")
    floors: int = Field(default=1, ge=1, le=3, description="Number of floors")
    facing: FacingDirection = Field(default=FacingDirection.EAST, description="Road-facing direction")
    vastu_compliant: bool = Field(default=True, description="Follow Vastu guidelines")
    cost_tier: CostTier = Field(default=CostTier.STANDARD, description="Construction quality tier")
    parking: bool = Field(default=False, description="Include car parking")
    budget: Optional[float] = Field(default=None, gt=0, description="Optional budget in INR")


class RoomOutput(BaseModel):
    name: str
    room_type: str
    x: float
    y: float
    width: float
    length: float
    area: float


class CorridorOutput(BaseModel):
    x: float
    y: float
    width: float
    length: float


class CostBreakdown(BaseModel):
    total_cost: float
    materials: float
    labor: float
    plumbing_electrical: float
    finishing: float
    miscellaneous: float


class PhaseWiseCost(BaseModel):
    foundation: float
    structure: float
    brickwork_plastering: float
    plumbing_electrical: float
    flooring: float
    doors_windows: float
    painting_finishing: float
    miscellaneous: float


class BudgetAnalysis(BaseModel):
    budget: float
    estimated_cost: float
    within_budget: bool
    difference: float
    suggestion: str


class VariationResult(BaseModel):
    variation_name: str
    variation_description: str
    success: bool
    plot_area: float
    buildable_area: float
    built_area: float
    rooms: list[RoomOutput]
    corridor: Optional[CorridorOutput] = None
    cost: CostBreakdown
    phase_wise_cost: PhaseWiseCost
    explanations: list[str]
    warnings: list[str]
    vastu_notes: list[str]
    budget_analysis: Optional[BudgetAnalysis] = None


class PlanResponse(BaseModel):
    success: bool
    plot_area: float
    buildable_area: float
    built_area: float
    rooms: list[RoomOutput]
    corridor: Optional[CorridorOutput] = None
    cost: CostBreakdown
    phase_wise_cost: PhaseWiseCost
    explanations: list[str]
    warnings: list[str]
    vastu_notes: list[str]
    budget_analysis: Optional[BudgetAnalysis] = None
    variations: list[VariationResult] = []
