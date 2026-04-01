"""Tests for the FastAPI endpoints."""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestRootEndpoint:
    def test_root(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "PlanWise"
        assert data["status"] == "running"


class TestGeneratePlan:
    def test_basic_2bhk(self):
        response = client.post("/generate-plan", json={
            "plot_length": 50,
            "plot_width": 30,
            "house_type": "2BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": True,
            "cost_tier": "standard",
            "parking": False,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["rooms"]) > 0
        assert data["cost"]["total_cost"] > 0
        assert len(data["explanations"]) > 0

    def test_with_budget_within(self):
        response = client.post("/generate-plan", json={
            "plot_length": 50,
            "plot_width": 30,
            "house_type": "2BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": True,
            "cost_tier": "economy",
            "parking": False,
            "budget": 5000000,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["budget_analysis"] is not None
        assert data["budget_analysis"]["within_budget"] is True

    def test_with_budget_exceeded(self):
        response = client.post("/generate-plan", json={
            "plot_length": 50,
            "plot_width": 30,
            "house_type": "3BHK",
            "floors": 2,
            "facing": "east",
            "vastu_compliant": True,
            "cost_tier": "premium",
            "parking": True,
            "budget": 500000,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["budget_analysis"] is not None
        assert data["budget_analysis"]["within_budget"] is False

    def test_variations_returned(self):
        response = client.post("/generate-plan", json={
            "plot_length": 50,
            "plot_width": 30,
            "house_type": "2BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": True,
            "cost_tier": "standard",
            "parking": False,
        })
        assert response.status_code == 200
        data = response.json()
        assert "variations" in data
        assert len(data["variations"]) >= 1

    def test_too_small_plot_returns_400(self):
        response = client.post("/generate-plan", json={
            "plot_length": 15,
            "plot_width": 15,
            "house_type": "3BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": True,
            "cost_tier": "standard",
            "parking": False,
        })
        assert response.status_code == 400

    def test_invalid_plot_dimensions(self):
        response = client.post("/generate-plan", json={
            "plot_length": 5,
            "plot_width": 30,
            "house_type": "2BHK",
        })
        assert response.status_code == 422  # Validation error

    def test_corridor_in_response(self):
        response = client.post("/generate-plan", json={
            "plot_length": 50,
            "plot_width": 30,
            "house_type": "2BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": True,
            "cost_tier": "standard",
            "parking": False,
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("corridor") is not None

    def test_all_house_types(self):
        for ht in ["1BHK", "2BHK", "3BHK", "2BHK_with_pooja", "3BHK_with_pooja"]:
            response = client.post("/generate-plan", json={
                "plot_length": 60,
                "plot_width": 40,
                "house_type": ht,
                "floors": 1,
                "facing": "east",
                "vastu_compliant": True,
                "cost_tier": "standard",
                "parking": False,
            })
            assert response.status_code == 200, f"Failed for {ht}"
            assert response.json()["success"] is True


class TestHouseTypesEndpoint:
    def test_house_types(self):
        response = client.get("/house-types")
        assert response.status_code == 200
        data = response.json()
        assert "2BHK" in data
        assert "rooms" in data["2BHK"]


class TestCostTiersEndpoint:
    def test_cost_tiers(self):
        response = client.get("/cost-tiers")
        assert response.status_code == 200
        data = response.json()
        assert "economy" in data
        assert "standard" in data
        assert "premium" in data
