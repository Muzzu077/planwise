"""Tests for the space calculator module."""
import pytest
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.space_calculator import (
    calculate_buildable_area,
    get_required_rooms,
    get_room_specs,
    validate_plot_for_house_type,
)


class TestCalculateBuildableArea:
    def test_standard_plot_east_facing(self):
        result = calculate_buildable_area(50, 30, "east")
        assert result["plot_area"] == 1500
        # East facing: length reduced by front(5)+rear(3), width by left(3)+right(3)
        assert result["buildable_length"] == 42  # 50 - 5 - 3
        assert result["buildable_width"] == 24   # 30 - 3 - 3
        assert result["buildable_area"] == 42 * 24

    def test_standard_plot_north_facing(self):
        result = calculate_buildable_area(50, 30, "north")
        # North facing: length reduced by left(3)+right(3), width by front(5)+rear(3)
        assert result["buildable_length"] == 44  # 50 - 3 - 3
        assert result["buildable_width"] == 22   # 30 - 5 - 3

    def test_ground_coverage_limit(self):
        result = calculate_buildable_area(50, 30, "east")
        # Max ground coverage = 65%
        max_coverage = 1500 * 0.65
        assert result["effective_buildable_area"] <= max_coverage

    def test_small_plot(self):
        result = calculate_buildable_area(20, 20, "east")
        assert result["plot_area"] == 400
        assert result["buildable_length"] > 0
        assert result["buildable_width"] > 0

    def test_large_plot(self):
        result = calculate_buildable_area(100, 80, "south")
        assert result["plot_area"] == 8000
        assert result["buildable_length"] > 0
        assert result["buildable_width"] > 0

    def test_setbacks_returned(self):
        result = calculate_buildable_area(50, 30, "east")
        assert "setbacks" in result
        assert result["setbacks"]["front"] == 5
        assert result["setbacks"]["rear"] == 3

    def test_fsi_limit(self):
        result = calculate_buildable_area(50, 30, "east")
        assert result["max_fsi"] == 1.5
        assert result["max_total_built_area"] == 1500 * 1.5


class TestGetRequiredRooms:
    def test_1bhk(self):
        rooms = get_required_rooms("1BHK")
        assert "living_room" in rooms
        assert "bedroom" in rooms
        assert "kitchen" in rooms
        assert "bathroom_common" in rooms

    def test_2bhk(self):
        rooms = get_required_rooms("2BHK")
        assert "master_bedroom" in rooms
        assert "bedroom" in rooms
        assert "dining" in rooms
        assert "bathroom_attached" in rooms

    def test_3bhk(self):
        rooms = get_required_rooms("3BHK")
        bedroom_count = rooms.count("bedroom")
        assert bedroom_count == 2

    def test_2bhk_with_pooja(self):
        rooms = get_required_rooms("2BHK_with_pooja")
        assert "pooja_room" in rooms

    def test_invalid_type(self):
        with pytest.raises(ValueError):
            get_required_rooms("5BHK")


class TestGetRoomSpecs:
    def test_living_room(self):
        spec = get_room_specs("living_room")
        assert spec["min_length"] == 12
        assert spec["min_width"] == 12
        assert spec["max_length"] == 20

    def test_bedroom(self):
        spec = get_room_specs("bedroom")
        assert spec["min_length"] >= 10
        assert spec["min_width"] >= 10

    def test_kitchen(self):
        spec = get_room_specs("kitchen")
        assert spec["min_length"] >= 8
        assert spec["min_width"] >= 7

    def test_invalid_room(self):
        with pytest.raises(ValueError):
            get_room_specs("swimming_pool")


class TestValidatePlotForHouseType:
    def test_valid_2bhk(self):
        result = validate_plot_for_house_type(50, 30, "2BHK")
        assert result["valid"] is True

    def test_too_small_for_2bhk(self):
        result = validate_plot_for_house_type(20, 20, "2BHK")
        assert result["valid"] is False
        assert "too small" in result["reason"].lower()

    def test_valid_1bhk_small_plot(self):
        result = validate_plot_for_house_type(25, 20, "1BHK")
        assert result["valid"] is True

    def test_too_small_for_3bhk(self):
        result = validate_plot_for_house_type(30, 30, "3BHK")
        assert result["valid"] is False

    def test_large_plot_any_type(self):
        for ht in ["1BHK", "2BHK", "3BHK", "2BHK_with_pooja", "3BHK_with_pooja"]:
            result = validate_plot_for_house_type(100, 80, ht)
            assert result["valid"] is True

    def test_invalid_house_type(self):
        result = validate_plot_for_house_type(50, 30, "10BHK")
        assert result["valid"] is False
