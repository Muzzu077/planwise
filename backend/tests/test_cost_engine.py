"""Tests for the cost engine module."""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.cost_engine import estimate_cost


class TestEstimateCost:
    def test_basic_cost(self):
        result = estimate_cost(built_area=500, cost_tier="standard", floors=1)
        assert result["cost_breakdown"]["total_cost"] > 0
        assert result["rate_per_sqft"] == 1600

    def test_economy_cheaper_than_premium(self):
        economy = estimate_cost(built_area=500, cost_tier="economy", floors=1)
        premium = estimate_cost(built_area=500, cost_tier="premium", floors=1)
        assert economy["cost_breakdown"]["total_cost"] < premium["cost_breakdown"]["total_cost"]

    def test_cost_tiers(self):
        for tier in ["economy", "standard", "premium"]:
            result = estimate_cost(built_area=500, cost_tier=tier, floors=1)
            assert result["cost_tier"] == tier
            assert result["cost_breakdown"]["total_cost"] > 0

    def test_multi_floor_costs_more(self):
        single = estimate_cost(built_area=500, cost_tier="standard", floors=1)
        double = estimate_cost(built_area=500, cost_tier="standard", floors=2)
        assert double["cost_breakdown"]["total_cost"] > single["cost_breakdown"]["total_cost"]
        assert double["total_built_area"] == 1000

    def test_parking_adds_cost(self):
        without = estimate_cost(built_area=500, cost_tier="standard", floors=1, has_parking=False)
        with_parking = estimate_cost(built_area=500, cost_tier="standard", floors=1, has_parking=True)
        assert with_parking["cost_breakdown"]["total_cost"] > without["cost_breakdown"]["total_cost"]

    def test_boundary_wall_cost(self):
        without = estimate_cost(built_area=500, cost_tier="standard", floors=1)
        with_wall = estimate_cost(
            built_area=500, cost_tier="standard", floors=1,
            plot_length=50, plot_width=30
        )
        assert with_wall["cost_breakdown"]["total_cost"] > without["cost_breakdown"]["total_cost"]

    def test_cost_breakdown_sums(self):
        result = estimate_cost(built_area=500, cost_tier="standard", floors=1)
        breakdown = result["cost_breakdown"]
        parts_sum = (
            breakdown["materials"] + breakdown["labor"] +
            breakdown["plumbing_electrical"] + breakdown["finishing"] +
            breakdown["miscellaneous"]
        )
        # Parts should approximately sum to total (rounding differences)
        assert abs(parts_sum - breakdown["total_cost"]) < breakdown["total_cost"] * 0.02

    def test_phase_wise_sums(self):
        result = estimate_cost(built_area=500, cost_tier="standard", floors=1)
        phase_sum = sum(result["phase_wise_cost"].values())
        total = result["cost_breakdown"]["total_cost"]
        assert abs(phase_sum - total) < total * 0.02

    def test_extra_details_with_parking(self):
        result = estimate_cost(
            built_area=500, cost_tier="standard", floors=2,
            plot_length=50, plot_width=30, has_parking=True
        )
        assert len(result["extra_details"]) >= 3  # parking + staircase + wall + tanks

    def test_invalid_tier_defaults_standard(self):
        result = estimate_cost(built_area=500, cost_tier="invalid_tier", floors=1)
        assert result["rate_per_sqft"] == 1600  # standard rate


class TestCostRealism:
    """Sanity checks that costs are in realistic ranges for Indian construction."""

    def test_1bhk_economy_range(self):
        # 400 sqft 1BHK economy should be roughly 5-8 lakh
        result = estimate_cost(
            built_area=400, cost_tier="economy", floors=1,
            plot_length=25, plot_width=20
        )
        total = result["cost_breakdown"]["total_cost"]
        assert 400_000 < total < 1_200_000

    def test_2bhk_standard_range(self):
        # 800 sqft 2BHK standard should be roughly 12-20 lakh
        result = estimate_cost(
            built_area=800, cost_tier="standard", floors=1,
            plot_length=50, plot_width=30
        )
        total = result["cost_breakdown"]["total_cost"]
        assert 1_000_000 < total < 2_500_000

    def test_3bhk_premium_range(self):
        # 1200 sqft 3BHK premium should be roughly 25-40 lakh
        result = estimate_cost(
            built_area=1200, cost_tier="premium", floors=1,
            plot_length=60, plot_width=40
        )
        total = result["cost_breakdown"]["total_cost"]
        assert 2_000_000 < total < 5_000_000
