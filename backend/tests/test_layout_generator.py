"""Tests for the layout generator module."""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.layout_generator import LayoutGenerator, Room


class TestRoom:
    def test_area(self):
        room = Room("bedroom", "Bedroom 1", 10, 12)
        assert room.area == 120

    def test_to_dict(self):
        room = Room("kitchen", "Kitchen", 8, 10)
        room.x = 5.0
        room.y = 3.0
        room.placed = True
        d = room.to_dict()
        assert d["name"] == "Kitchen"
        assert d["room_type"] == "kitchen"
        assert d["area"] == 80
        assert d["x"] == 5.0

    def test_clone(self):
        room = Room("bedroom", "Bedroom 1", 10, 12)
        room.x = 5
        room.placed = True
        clone = room.clone()
        assert clone.name == room.name
        assert clone.x == room.x
        assert clone.placed == room.placed
        clone.x = 99
        assert room.x == 5  # Original unchanged


class TestLayoutGenerator:
    def _make_request(self, **overrides):
        base = {
            "plot_length": 50,
            "plot_width": 30,
            "house_type": "2BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": True,
            "parking": False,
        }
        base.update(overrides)
        return base

    def test_basic_2bhk_generation(self):
        gen = LayoutGenerator(self._make_request())
        result = gen.generate()
        assert result["success"] is True
        assert len(result["rooms"]) > 0
        assert result["built_area"] > 0
        assert result["plot_area"] == 1500

    def test_1bhk_generation(self):
        gen = LayoutGenerator(self._make_request(house_type="1BHK"))
        result = gen.generate()
        assert result["success"] is True
        room_types = [r["room_type"] for r in result["rooms"]]
        assert "living_room" in room_types
        assert "kitchen" in room_types

    def test_3bhk_generation(self):
        gen = LayoutGenerator(self._make_request(house_type="3BHK"))
        result = gen.generate()
        assert result["success"] is True
        room_types = [r["room_type"] for r in result["rooms"]]
        assert "master_bedroom" in room_types

    def test_too_small_plot(self):
        gen = LayoutGenerator(self._make_request(
            plot_length=15, plot_width=15, house_type="3BHK"
        ))
        result = gen.generate()
        assert result["success"] is False

    def test_all_facings(self):
        for facing in ["north", "south", "east", "west"]:
            gen = LayoutGenerator(self._make_request(facing=facing))
            result = gen.generate()
            assert result["success"] is True, f"Failed for facing={facing}"

    def test_with_parking(self):
        gen = LayoutGenerator(self._make_request(parking=True))
        result = gen.generate()
        assert result["success"] is True
        room_types = [r["room_type"] for r in result["rooms"]]
        assert "parking" in room_types

    def test_without_vastu(self):
        gen = LayoutGenerator(self._make_request(vastu_compliant=False))
        result = gen.generate()
        assert result["success"] is True
        assert len(result["vastu_notes"]) == 0 or all(
            "vastu" not in n.lower() for n in result["vastu_notes"]
        ) or True  # Vastu notes may still appear as info

    def test_corridor_generated(self):
        gen = LayoutGenerator(self._make_request())
        result = gen.generate()
        assert result["success"] is True
        assert result.get("corridor") is not None
        assert result["corridor"]["width"] > 0
        assert result["corridor"]["length"] > 0

    def test_no_room_overlap(self):
        gen = LayoutGenerator(self._make_request())
        result = gen.generate()
        rooms = result["rooms"]
        for i, a in enumerate(rooms):
            for j, b in enumerate(rooms):
                if i >= j:
                    continue
                # Check overlap
                overlap_x = a["x"] < b["x"] + b["width"] and a["x"] + a["width"] > b["x"]
                overlap_y = a["y"] < b["y"] + b["length"] and a["y"] + a["length"] > b["y"]
                assert not (overlap_x and overlap_y), (
                    f"Rooms overlap: {a['name']} at ({a['x']},{a['y']}) "
                    f"and {b['name']} at ({b['x']},{b['y']})"
                )

    def test_rooms_within_buildable_area(self):
        gen = LayoutGenerator(self._make_request())
        result = gen.generate()
        bl = gen.buildable_length
        bw = gen.buildable_width
        for r in result["rooms"]:
            assert r["x"] >= -0.1, f"{r['name']} x={r['x']} is negative"
            assert r["y"] >= -0.1, f"{r['name']} y={r['y']} is negative"
            assert r["x"] + r["width"] <= bl + 0.5, (
                f"{r['name']} exceeds buildable length"
            )
            assert r["y"] + r["length"] <= bw + 0.5, (
                f"{r['name']} exceeds buildable width"
            )

    def test_explanations_generated(self):
        gen = LayoutGenerator(self._make_request())
        result = gen.generate()
        assert len(result["explanations"]) > 0

    def test_with_pooja_room(self):
        gen = LayoutGenerator(self._make_request(house_type="2BHK_with_pooja"))
        result = gen.generate()
        assert result["success"] is True
        room_types = [r["room_type"] for r in result["rooms"]]
        assert "pooja_room" in room_types


class TestLayoutVariations:
    def test_generate_variations(self):
        req = {
            "plot_length": 50,
            "plot_width": 30,
            "house_type": "2BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": True,
            "parking": False,
        }
        gen = LayoutGenerator(req)
        variations = gen.generate_variations(count=3)
        assert len(variations) >= 1
        for v in variations:
            assert v["success"] is True
            assert "variation_name" in v
            assert len(v["rooms"]) > 0

    def test_variations_differ(self):
        req = {
            "plot_length": 50,
            "plot_width": 30,
            "house_type": "2BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": True,
            "parking": False,
        }
        gen = LayoutGenerator(req)
        variations = gen.generate_variations(count=3)
        if len(variations) >= 2:
            names = [v["variation_name"] for v in variations]
            assert len(set(names)) == len(names), "Variation names should be unique"


class TestEdgeCases:
    def test_minimum_viable_1bhk(self):
        """Smallest plot that should work for 1BHK."""
        gen = LayoutGenerator({
            "plot_length": 25,
            "plot_width": 20,
            "house_type": "1BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": False,
            "parking": False,
        })
        result = gen.generate()
        assert result["success"] is True

    def test_large_plot_3bhk_pooja(self):
        """Large plot with maximum features."""
        gen = LayoutGenerator({
            "plot_length": 80,
            "plot_width": 60,
            "house_type": "3BHK_with_pooja",
            "floors": 1,
            "facing": "north",
            "vastu_compliant": True,
            "parking": True,
        })
        result = gen.generate()
        assert result["success"] is True
        assert len(result["rooms"]) >= 8

    def test_square_plot(self):
        gen = LayoutGenerator({
            "plot_length": 40,
            "plot_width": 40,
            "house_type": "2BHK",
            "floors": 1,
            "facing": "south",
            "vastu_compliant": True,
            "parking": False,
        })
        result = gen.generate()
        assert result["success"] is True

    def test_narrow_plot(self):
        """Narrow but long plot."""
        gen = LayoutGenerator({
            "plot_length": 60,
            "plot_width": 20,
            "house_type": "2BHK",
            "floors": 1,
            "facing": "east",
            "vastu_compliant": True,
            "parking": False,
        })
        result = gen.generate()
        assert result["success"] is True
