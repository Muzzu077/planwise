"""
PlanWise Layout Generator

Core algorithm:
1. Calculate buildable area with setbacks
2. Determine required rooms from house type
3. Size each room proportionally within constraints
4. Place rooms on a grid using zone-based logic
5. Validate adjacency, ventilation, and Vastu rules
"""

from .space_calculator import (
    calculate_buildable_area,
    get_required_rooms,
    get_room_specs,
    load_json,
    validate_plot_for_house_type,
)


class Room:
    def __init__(self, room_type: str, name: str, width: float, length: float):
        self.room_type = room_type
        self.name = name
        self.width = width
        self.length = length
        self.x = 0.0
        self.y = 0.0
        self.placed = False

    @property
    def area(self) -> float:
        return self.width * self.length

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "room_type": self.room_type,
            "x": round(self.x, 1),
            "y": round(self.y, 1),
            "width": round(self.width, 1),
            "length": round(self.length, 1),
            "area": round(self.area, 1),
        }


class LayoutGenerator:
    def __init__(self, request: dict):
        self.plot_length = request["plot_length"]
        self.plot_width = request["plot_width"]
        self.house_type = request["house_type"]
        self.floors = request.get("floors", 1)
        self.facing = request.get("facing", "east")
        self.vastu = request.get("vastu_compliant", True)
        self.parking = request.get("parking", False)

        self.rooms: list[Room] = []
        self.explanations: list[str] = []
        self.warnings: list[str] = []
        self.vastu_notes: list[str] = []

        self.space_info = calculate_buildable_area(
            self.plot_length, self.plot_width, self.facing
        )

        self.buildable_length = self.space_info["buildable_length"]
        self.buildable_width = self.space_info["buildable_width"]

        # The origin (0,0) is the top-left corner of the buildable area
        # We track occupied rectangles to prevent overlap
        self.occupied: list[dict] = []

    def generate(self) -> dict:
        """Main entry point: generates a complete layout."""
        # Step 1: Validate
        validation = validate_plot_for_house_type(
            self.plot_length, self.plot_width, self.house_type
        )
        if not validation["valid"]:
            return {
                "success": False,
                "error": validation["reason"],
                "rooms": [],
                "explanations": [],
                "warnings": [validation["reason"]],
                "vastu_notes": [],
            }

        # Step 2: Create rooms with appropriate sizes
        self._size_rooms()

        # Step 3: Place rooms on the grid
        self._place_rooms()

        # Step 4: Validate and add notes
        self._validate_layout()

        built_area = sum(r.area for r in self.rooms if r.placed)

        return {
            "success": True,
            "plot_area": self.space_info["plot_area"],
            "buildable_area": self.space_info["effective_buildable_area"],
            "built_area": round(built_area, 1),
            "rooms": [r.to_dict() for r in self.rooms if r.placed],
            "explanations": self.explanations,
            "warnings": self.warnings,
            "vastu_notes": self.vastu_notes,
        }

    def _size_rooms(self):
        """Create Room objects with dimensions proportional to available space."""
        required = get_required_rooms(self.house_type)
        buildable = self.space_info["effective_buildable_area"]
        wall_thickness = 0.75

        # Account for walls: ~15% area loss for internal walls + corridors
        usable_area = buildable * 0.82

        # Calculate total minimum area needed
        room_specs = []
        for room_type in required:
            spec = get_room_specs(room_type)
            room_specs.append((room_type, spec))

        total_min_area = sum(
            s["min_length"] * s["min_width"] for _, s in room_specs
        )

        if total_min_area > usable_area:
            self.warnings.append(
                f"Tight fit: rooms need {total_min_area:.0f} sqft minimum "
                f"but only {usable_area:.0f} sqft usable. Rooms will be at minimum sizes."
            )
            scale = 0.95
        else:
            # Scale rooms up proportionally but conservatively to ensure all fit
            scale = min((usable_area / total_min_area) ** 0.4, 1.2)

        # Add corridor area
        corridor_width = 3.5

        # Create rooms
        bedroom_count = 0
        bathroom_common_count = 0
        for room_type, spec in room_specs:
            w = min(spec["min_width"] * scale, spec["max_width"])
            l = min(spec["min_length"] * scale, spec["max_length"])

            # Ensure minimums
            w = max(w, spec["min_width"])
            l = max(l, spec["min_length"])

            # Generate display name
            if room_type == "bedroom":
                bedroom_count += 1
                name = f"Bedroom {bedroom_count + 1}"  # +1 because master is bedroom 1
            elif room_type == "master_bedroom":
                name = "Master Bedroom"
            elif room_type == "bathroom_common":
                bathroom_common_count += 1
                suffix = f" {bathroom_common_count}" if bathroom_common_count > 1 else ""
                name = f"Common Bathroom{suffix}"
            elif room_type == "bathroom_attached":
                name = "Attached Bathroom"
            elif room_type == "pooja_room":
                name = "Pooja Room"
            elif room_type == "living_room":
                name = "Living Room"
            else:
                name = room_type.replace("_", " ").title()

            self.rooms.append(Room(room_type, name, round(w, 1), round(l, 1)))

        # Add parking if requested
        if self.parking:
            self.rooms.append(Room("parking", "Car Parking", 10, 10))

        self.explanations.append(
            f"Rooms sized to fit {self.space_info['effective_buildable_area']:.0f} sqft "
            f"buildable area (after setbacks from {self.space_info['plot_area']:.0f} sqft plot)."
        )

    def _get_zone(self, room_type: str) -> str:
        """Determine which zone a room belongs to."""
        logic = load_json("layout_logic.json")
        for zone, types in logic["zone_definitions"].items():
            if room_type in types:
                return zone
        return "service"

    def _get_vastu_quadrant(self, room_type: str) -> tuple[str, str]:
        """Get preferred Vastu placement for a room type.
        Returns (preferred_position, avoid_position)."""
        constraints = load_json("constraints.json")
        vastu = constraints["vastu_rules"]

        # Map room types to Vastu keys
        vastu_key_map = {
            "living_room": "living_room",
            "master_bedroom": "master_bedroom",
            "bedroom": "master_bedroom",  # same general rules
            "kitchen": "kitchen",
            "bathroom_attached": "bathroom",
            "bathroom_common": "bathroom",
            "pooja_room": "pooja_room",
            "staircase": "staircase",
        }

        key = vastu_key_map.get(room_type)
        if key and key in vastu:
            return vastu[key].get("preferred", []), vastu[key].get("avoid", [])
        return [], []

    def _direction_to_position(self, direction: str) -> tuple[float, float]:
        """Convert a cardinal direction to approximate (x, y) position
        within the buildable area. (0,0) is top-left (northwest corner).

        Layout orientation:
            North = top
            South = bottom
            West = left
            East = right
        """
        mid_x = self.buildable_length / 2
        mid_y = self.buildable_width / 2

        positions = {
            "north": (mid_x, 0),
            "south": (mid_x, self.buildable_width),
            "east": (self.buildable_length, mid_y),
            "west": (0, mid_y),
            "northeast": (self.buildable_length, 0),
            "northwest": (0, 0),
            "southeast": (self.buildable_length, self.buildable_width),
            "southwest": (0, self.buildable_width),
            "center": (mid_x, mid_y),
        }
        return positions.get(direction, (mid_x, mid_y))

    def _overlaps(self, x: float, y: float, w: float, l: float) -> bool:
        """Check if a rectangle overlaps any already-placed room."""
        for occ in self.occupied:
            if (
                x < occ["x"] + occ["w"]
                and x + w > occ["x"]
                and y < occ["y"] + occ["l"]
                and y + l > occ["y"]
            ):
                return True
        return False

    def _fits(self, x: float, y: float, w: float, l: float) -> bool:
        """Check if rectangle fits within buildable area and doesn't overlap."""
        if x < 0 or y < 0:
            return False
        if x + w > self.buildable_length + 0.1:  # small tolerance
            return False
        if y + l > self.buildable_width + 0.1:
            return False
        return not self._overlaps(x, y, w, l)

    def _place_room(self, room: Room, x: float, y: float):
        """Place a room at the given coordinates."""
        room.x = round(x, 1)
        room.y = round(y, 1)
        room.placed = True
        self.occupied.append({
            "x": room.x, "y": room.y,
            "w": room.width, "l": room.length,
            "type": room.room_type,
        })

    def _find_placement(self, room: Room, preferred_positions: list[tuple[float, float]]) -> bool:
        """Try to place a room at preferred positions, then scan for any valid spot."""
        w, l = room.width, room.length

        # Try preferred positions first
        for px, py in preferred_positions:
            # Try centering on preferred point
            for dx in [0, -w/2, -w]:
                for dy in [0, -l/2, -l]:
                    x = max(0, min(px + dx, self.buildable_length - w))
                    y = max(0, min(py + dy, self.buildable_width - l))
                    if self._fits(x, y, w, l):
                        self._place_room(room, x, y)
                        return True

        # Scan grid for any valid position (1ft steps)
        step = 1.0
        for y in self._frange(0, self.buildable_width - l, step):
            for x in self._frange(0, self.buildable_length - w, step):
                if self._fits(x, y, w, l):
                    self._place_room(room, x, y)
                    return True

        # Try rotated (swap width and length)
        room.width, room.length = room.length, room.width
        w, l = room.width, room.length
        for y in self._frange(0, self.buildable_width - l, step):
            for x in self._frange(0, self.buildable_length - w, step):
                if self._fits(x, y, w, l):
                    self._place_room(room, x, y)
                    return True

        # Revert rotation if failed
        room.width, room.length = room.length, room.width
        return False

    def _frange(self, start: float, stop: float, step: float):
        """Float range generator."""
        vals = []
        v = start
        while v <= stop + 0.01:
            vals.append(round(v, 1))
            v += step
        return vals

    def _place_rooms(self):
        """Place all rooms using zone-based logic with Vastu consideration."""
        logic = load_json("layout_logic.json")

        # Determine entrance position based on facing direction
        entrance_positions = {
            "north": ("north", (self.buildable_length / 2, 0)),
            "south": ("south", (self.buildable_length / 2, self.buildable_width)),
            "east": ("east", (self.buildable_length, self.buildable_width / 2)),
            "west": ("west", (0, self.buildable_width / 2)),
        }
        entrance_dir, entrance_pos = entrance_positions[self.facing]

        # Sort rooms by priority
        rules = load_json("room_rules.json")
        self.rooms.sort(key=lambda r: rules["rooms"].get(r.room_type, {}).get("priority", 99))

        for room in self.rooms:
            preferred = []
            zone = self._get_zone(room.room_type)
            zone_side = logic["zone_placement"].get(zone, "center")

            # Build preferred positions based on zone + Vastu
            if room.room_type in ("living_room", "dining"):
                # Public zone: near entrance
                preferred.append(entrance_pos)
                if self.facing == "east":
                    preferred.append((self.buildable_length - room.width, 0))
                elif self.facing == "west":
                    preferred.append((0, 0))
                elif self.facing == "north":
                    preferred.append((0, 0))
                elif self.facing == "south":
                    preferred.append((0, self.buildable_width - room.length))

            elif room.room_type == "master_bedroom":
                # Private zone: rear corners, Vastu prefers southwest
                if self.vastu:
                    preferred.append((0, self.buildable_width - room.length))  # SW
                    self.vastu_notes.append("Master Bedroom placed in southwest (Vastu recommended).")
                else:
                    preferred.append((0, self.buildable_width - room.length))
                    preferred.append((self.buildable_length - room.width, self.buildable_width - room.length))

            elif room.room_type == "bedroom":
                # Other bedrooms: rear area
                preferred.append((self.buildable_length - room.width, self.buildable_width - room.length))
                preferred.append((0, self.buildable_width - room.length))

            elif room.room_type == "kitchen":
                # Vastu: southeast
                if self.vastu:
                    preferred.append((self.buildable_length - room.width, self.buildable_width - room.length))
                    # Adjust for facing
                    preferred.append((self.buildable_length - room.width, 0))
                    self.vastu_notes.append("Kitchen placed in southeast direction (Vastu recommended).")
                else:
                    preferred.append((self.buildable_length - room.width, 0))

            elif room.room_type == "bathroom_attached":
                # Adjacent to master bedroom
                master = next((r for r in self.rooms if r.room_type == "master_bedroom" and r.placed), None)
                if master:
                    # Try placing next to master bedroom
                    preferred.append((master.x + master.width, master.y))
                    preferred.append((master.x, master.y + master.length))
                    preferred.append((master.x - room.width, master.y))

            elif room.room_type == "bathroom_common":
                # Central, accessible
                preferred.append((self.buildable_length / 2, self.buildable_width / 2))
                if self.vastu:
                    # Vastu prefers northwest/west for bathrooms
                    preferred.append((0, 0))
                    self.vastu_notes.append("Common Bathroom placed toward northwest (Vastu recommended).")

            elif room.room_type == "pooja_room":
                # Vastu: northeast
                if self.vastu:
                    preferred.append((self.buildable_length - room.width, 0))
                    self.vastu_notes.append("Pooja Room placed in northeast (Vastu recommended).")
                else:
                    preferred.append((0, 0))

            elif room.room_type == "parking":
                # Near entrance/road
                preferred.append(entrance_pos)
                preferred.append((0, 0))

            else:
                # Default: center
                preferred.append((self.buildable_length / 2, self.buildable_width / 2))

            success = self._find_placement(room, preferred)
            if not success:
                self.warnings.append(
                    f"Could not place {room.name} ({room.width}x{room.length} ft). "
                    f"Plot may be too small or too many rooms requested."
                )

        placed_count = sum(1 for r in self.rooms if r.placed)
        self.explanations.append(
            f"Successfully placed {placed_count}/{len(self.rooms)} rooms."
        )

    def _validate_layout(self):
        """Post-placement validation and explanation generation."""
        placed = [r for r in self.rooms if r.placed]
        total_room_area = sum(r.area for r in placed)
        buildable = self.space_info["effective_buildable_area"]
        efficiency = (total_room_area / buildable * 100) if buildable > 0 else 0

        self.explanations.append(
            f"Space efficiency: {efficiency:.1f}% of buildable area used for rooms."
        )

        if efficiency > 85:
            self.warnings.append(
                "Layout is very tight. Consider reducing room count or increasing plot size."
            )
        elif efficiency < 50:
            self.explanations.append(
                "Good space available for corridors, utility areas, and future expansion."
            )

        # Check ventilation: habitable rooms need exterior walls
        for room in placed:
            if room.room_type in ("living_room", "master_bedroom", "bedroom", "kitchen"):
                touches_exterior = (
                    room.x <= 0.5
                    or room.y <= 0.5
                    or room.x + room.width >= self.buildable_length - 0.5
                    or room.y + room.length >= self.buildable_width - 0.5
                )
                if not touches_exterior:
                    self.warnings.append(
                        f"{room.name} does not touch an exterior wall. "
                        f"Natural ventilation may be insufficient."
                    )

        # Entrance explanation
        self.explanations.append(
            f"Layout designed for {self.facing}-facing plot. "
            f"Entrance and public areas oriented toward {self.facing} side."
        )

        if self.vastu and not self.vastu_notes:
            self.vastu_notes.append("Basic Vastu guidelines applied to room placement.")

        # Setback info
        setbacks = self.space_info["setbacks"]
        self.explanations.append(
            f"Setbacks applied: Front {setbacks['front']}ft, Rear {setbacks['rear']}ft, "
            f"Sides {setbacks['left']}ft each."
        )
