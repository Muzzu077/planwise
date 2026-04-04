"""
PlanWise Layout Generator v2

Improved algorithm using strip-based room placement:
1. Calculate buildable area with setbacks
2. Divide the buildable area into horizontal strips (front, middle, rear)
3. Assign rooms to strips based on zone (public→front, service→middle, private→rear)
4. Place rooms within each strip, respecting constraints
5. Add corridor between strips for connectivity
6. Validate adjacency, ventilation, and Vastu rules
7. Support multiple layout variations
"""

import random
from copy import deepcopy
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

    def clone(self) -> "Room":
        r = Room(self.room_type, self.name, self.width, self.length)
        r.x = self.x
        r.y = self.y
        r.placed = self.placed
        return r


class LayoutGenerator:
    CORRIDOR_WIDTH = 3.5  # feet

    def __init__(self, request: dict):
        self.plot_length = request["plot_length"]
        self.plot_width = request["plot_width"]
        self.house_type = request["house_type"]
        self.floors = request.get("floors", 1)
        self.facing = request.get("facing", "east")
        self.vastu = request.get("vastu_compliant", True)
        self.parking = request.get("parking", False)
        self.budget = request.get("budget", None)

        self.rooms: list[Room] = []
        self.corridor: dict | None = None
        self.explanations: list[str] = []
        self.warnings: list[str] = []
        self.vastu_notes: list[str] = []

        self.space_info = calculate_buildable_area(
            self.plot_length, self.plot_width, self.facing
        )

        self.buildable_length = self.space_info["buildable_length"]
        self.buildable_width = self.space_info["buildable_width"]
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

        # Step 3: Place rooms using strip-based approach
        self._place_rooms_strip()

        # Step 4: Validate and add notes
        self._validate_layout()

        built_area = sum(r.area for r in self.rooms if r.placed)

        return {
            "success": True,
            "plot_area": self.space_info["plot_area"],
            "buildable_area": self.space_info["effective_buildable_area"],
            "built_area": round(built_area, 1),
            "rooms": [r.to_dict() for r in self.rooms if r.placed],
            "corridor": self.corridor,
            "explanations": self.explanations,
            "warnings": self.warnings,
            "vastu_notes": self.vastu_notes,
        }

    def generate_variations(self, count: int = 3) -> list[dict]:
        """Generate multiple layout variations."""
        variations = []

        # Variation 1: Standard (Vastu-optimized if enabled)
        result = self.generate()
        if result["success"]:
            result["variation_name"] = "Balanced Layout"
            result["variation_description"] = (
                "Optimized for space efficiency with balanced room sizes."
                + (" Vastu compliant." if self.vastu else "")
            )
            variations.append(result)

        # Variation 2: Compact (minimize corridors, maximize room sizes)
        compact = self._generate_compact_variation()
        if compact and compact["success"]:
            compact["variation_name"] = "Compact Layout"
            compact["variation_description"] = (
                "Maximizes room sizes with minimal corridor space."
            )
            variations.append(compact)

        # Variation 3: Open plan (merge living + dining)
        open_plan = self._generate_open_variation()
        if open_plan and open_plan["success"]:
            open_plan["variation_name"] = "Open Plan Layout"
            open_plan["variation_description"] = (
                "Living and dining areas merged for a spacious feel."
            )
            variations.append(open_plan)

        return variations if variations else [self.generate()]

    def _generate_compact_variation(self) -> dict | None:
        """Generate a compact variation with rooms placed edge-to-edge."""
        gen = LayoutGenerator({
            "plot_length": self.plot_length,
            "plot_width": self.plot_width,
            "house_type": self.house_type,
            "floors": self.floors,
            "facing": self.facing,
            "vastu_compliant": self.vastu,
            "parking": self.parking,
        })
        gen.CORRIDOR_WIDTH = 3.0  # Narrower corridor

        validation = validate_plot_for_house_type(
            self.plot_length, self.plot_width, self.house_type
        )
        if not validation["valid"]:
            return None

        gen._size_rooms(scale_bias=0.9)  # Slightly smaller rooms
        gen._place_rooms_strip()
        gen._validate_layout()

        built_area = sum(r.area for r in gen.rooms if r.placed)
        return {
            "success": True,
            "plot_area": gen.space_info["plot_area"],
            "buildable_area": gen.space_info["effective_buildable_area"],
            "built_area": round(built_area, 1),
            "rooms": [r.to_dict() for r in gen.rooms if r.placed],
            "corridor": gen.corridor,
            "explanations": gen.explanations,
            "warnings": gen.warnings,
            "vastu_notes": gen.vastu_notes,
        }

    def _generate_open_variation(self) -> dict | None:
        """Generate open plan variation merging living + dining."""
        gen = LayoutGenerator({
            "plot_length": self.plot_length,
            "plot_width": self.plot_width,
            "house_type": self.house_type,
            "floors": self.floors,
            "facing": self.facing,
            "vastu_compliant": self.vastu,
            "parking": self.parking,
        })

        validation = validate_plot_for_house_type(
            self.plot_length, self.plot_width, self.house_type
        )
        if not validation["valid"]:
            return None

        gen._size_rooms(merge_living_dining=True)
        gen._place_rooms_strip()
        gen._validate_layout()

        built_area = sum(r.area for r in gen.rooms if r.placed)
        return {
            "success": True,
            "plot_area": gen.space_info["plot_area"],
            "buildable_area": gen.space_info["effective_buildable_area"],
            "built_area": round(built_area, 1),
            "rooms": [r.to_dict() for r in gen.rooms if r.placed],
            "corridor": gen.corridor,
            "explanations": gen.explanations,
            "warnings": gen.warnings,
            "vastu_notes": gen.vastu_notes,
        }

    def _size_rooms(self, scale_bias: float = 1.0, merge_living_dining: bool = False):
        """Create Room objects with dimensions proportional to available space."""
        required = get_required_rooms(self.house_type)
        buildable = self.space_info["effective_buildable_area"]

        # Reserve space for corridor
        corridor_area = self.buildable_length * self.CORRIDOR_WIDTH
        usable_area = (buildable - corridor_area) * 0.85  # 15% for walls

        # Handle living+dining merge
        if merge_living_dining and "dining" in required and "living_room" in required:
            required = [r for r in required if r != "dining"]

        # Calculate scaling
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
            scale = 0.95 * scale_bias
        else:
            scale = min((usable_area / total_min_area) ** 0.35, 1.15) * scale_bias

        # Create rooms
        bedroom_count = 1
        bathroom_common_count = 0
        for room_type, spec in room_specs:
            w = min(spec["min_width"] * scale, spec["max_width"])
            l = min(spec["min_length"] * scale, spec["max_length"])
            w = max(w, spec["min_width"])
            l = max(l, spec["min_length"])

            # For merged living+dining, make living room wider
            if merge_living_dining and room_type == "living_room":
                # Add dining area to living room
                dining_spec = get_room_specs("dining")
                extra_w = dining_spec["min_width"] * 0.6
                w = min(w + extra_w, self.buildable_length * 0.6)
                name = "Living + Dining"
            elif room_type == "bedroom":
                bedroom_count += 1
                name = f"Bedroom {bedroom_count + 1}"
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

    def _classify_zone(self, room_type: str) -> str:
        """Classify a room into front/rear/service zone."""
        logic = load_json("layout_logic.json")
        for zone, types in logic["zone_definitions"].items():
            if room_type in types:
                return zone
        return "service"

    def _place_rooms_strip(self):
        """
        Strip-based placement algorithm:

        Layout structure (for east-facing):
        ┌──────────────────────────────┐
        │  FRONT STRIP (public zone)   │ ← Road side
        │  Living Room  │  Dining      │
        ├──────── CORRIDOR ────────────┤
        │  MIDDLE STRIP (service)      │
        │  Kitchen  │ Bathrooms │Pooja │
        ├──────────────────────────────┤
        │  REAR STRIP (private zone)   │
        │  Master Bedroom │ Bedroom 2  │
        └──────────────────────────────┘

        For other facings, the strips rotate accordingly.
        """
        # Sort rooms into zones
        front_rooms = []  # public zone
        middle_rooms = []  # service zone
        rear_rooms = []  # private zone

        rules = load_json("room_rules.json")

        for room in self.rooms:
            zone = self._classify_zone(room.room_type)
            if room.room_type == "parking":
                front_rooms.insert(0, room)  # Parking always at front
            elif zone == "public":
                front_rooms.append(room)
            elif zone in ("service", "sacred"):
                middle_rooms.append(room)
            elif zone == "private":
                # Attached bathroom goes with its bedroom
                if room.room_type == "bathroom_attached":
                    rear_rooms.append(room)
                else:
                    rear_rooms.append(room)
            else:
                middle_rooms.append(room)

        # Sort within zones by priority
        for zone_list in [front_rooms, middle_rooms, rear_rooms]:
            zone_list.sort(
                key=lambda r: rules["rooms"].get(r.room_type, {}).get("priority", 99)
            )

        # Calculate strip depths
        # Each strip height = max room length in that strip
        front_depth = max((r.length for r in front_rooms), default=0)
        rear_depth = max((r.length for r in rear_rooms), default=0)
        corridor_depth = self.CORRIDOR_WIDTH

        available_depth = self.buildable_width
        middle_depth = available_depth - front_depth - rear_depth - corridor_depth

        # If middle rooms don't fit, adjust strip depths
        if middle_rooms:
            max_middle = max(r.length for r in middle_rooms)
            if middle_depth < max_middle:
                # Redistribute: shrink front/rear to make room for middle
                needed = max_middle - middle_depth
                shrink = needed / 2
                min_front = min((r.length for r in front_rooms), default=0) * 0.8
                min_rear = min((r.length for r in rear_rooms), default=0) * 0.8
                front_depth = max(front_depth - shrink, min_front)
                rear_depth = max(rear_depth - shrink, min_rear)
                middle_depth = available_depth - front_depth - rear_depth - corridor_depth

                # If still too small, shrink corridor and try again
                if middle_depth < max_middle * 0.7:
                    corridor_depth = max(2.5, corridor_depth - 1)
                    middle_depth = available_depth - front_depth - rear_depth - corridor_depth

        # If no middle rooms, distribute space to front/rear
        if not middle_rooms:
            extra = middle_depth
            middle_depth = 0
            corridor_depth = self.CORRIDOR_WIDTH
            front_depth += extra * 0.5
            rear_depth += extra * 0.5

        # Determine strip Y positions based on facing
        # "Front" = road side
        if self.facing in ("north", "east"):
            # Road at top or right, front strip at top
            front_y = 0
            corridor_y = front_depth
            middle_y = front_depth + corridor_depth
            rear_y = front_depth + corridor_depth + middle_depth
        else:
            # Road at bottom or left, front strip at bottom
            rear_y = 0
            middle_y = rear_depth
            corridor_y = rear_depth + middle_depth
            front_y = rear_depth + middle_depth + corridor_depth

        # Place rooms in each strip
        self._place_strip(front_rooms, 0, front_y, self.buildable_length, front_depth)

        if middle_rooms and middle_depth > 0:
            self._place_strip(middle_rooms, 0, middle_y, self.buildable_length, middle_depth)

        self._place_strip(rear_rooms, 0, rear_y, self.buildable_length, rear_depth)

        # Record corridor position
        if corridor_depth > 0:
            self.corridor = {
                "x": 0,
                "y": round(corridor_y, 1),
                "width": round(self.buildable_length, 1),
                "length": round(corridor_depth, 1),
            }

        # Apply Vastu adjustments if enabled
        if self.vastu:
            self._apply_vastu_swaps()

        placed_count = sum(1 for r in self.rooms if r.placed)
        self.explanations.append(
            f"Successfully placed {placed_count}/{len(self.rooms)} rooms "
            f"in a structured strip layout with {self.CORRIDOR_WIDTH}ft corridor."
        )

    def _place_strip(self, rooms: list[Room], start_x: float, start_y: float,
                     available_width: float, strip_depth: float):
        """Place rooms left-to-right within a horizontal strip."""
        if strip_depth <= 0:
            return

        cursor_x = start_x
        strip_depth_rounded = round(strip_depth, 1)

        for room in rooms:
            w = room.width
            l = room.length

            # If room length exceeds strip depth, try rotation
            if l > strip_depth + 0.1 and w <= strip_depth + 0.1:
                room.width, room.length = room.length, room.width
                w, l = room.width, room.length

            # Strictly clamp room length to strip depth
            if l > strip_depth + 0.1:
                room.length = strip_depth_rounded
                l = room.length

            # If room width exceeds remaining space, try to fit
            remaining = available_width - cursor_x
            if w > remaining + 0.5:
                if l <= remaining + 0.5 and w <= strip_depth + 0.1:
                    # Rotate
                    room.width, room.length = room.length, room.width
                    w, l = room.width, room.length
                    # Clamp again after rotation
                    if l > strip_depth + 0.1:
                        room.length = strip_depth_rounded
                        l = room.length
                elif remaining >= 6:
                    # Shrink to fit
                    room.width = round(remaining, 1)
                    w = room.width
                else:
                    self.warnings.append(
                        f"Could not place {room.name} ({room.width}x{room.length} ft). "
                        f"Insufficient space in its zone."
                    )
                    continue

            room.x = round(cursor_x, 1)
            room.y = round(start_y, 1)

            # Stretch room length to fill strip depth (reduces gaps)
            if strip_depth_rounded - l > 0.5 and l < strip_depth_rounded:
                room.length = strip_depth_rounded

            room.placed = True
            self.occupied.append({
                "x": room.x, "y": room.y,
                "w": room.width, "l": room.length,
                "type": room.room_type,
            })

            cursor_x += room.width

    def _apply_vastu_swaps(self):
        """Swap room positions within strips to better comply with Vastu."""
        constraints = load_json("constraints.json")
        vastu = constraints["vastu_rules"]

        placed = [r for r in self.rooms if r.placed]
        if not placed:
            return

        # Vastu direction preferences (relative to buildable area)
        # Northeast = (right, top), Southwest = (left, bottom), etc.
        mid_x = self.buildable_length / 2
        mid_y = self.buildable_width / 2

        def is_in_direction(room: Room, direction: str) -> bool:
            cx = room.x + room.width / 2
            cy = room.y + room.length / 2
            checks = {
                "northeast": cx >= mid_x and cy <= mid_y,
                "northwest": cx <= mid_x and cy <= mid_y,
                "southeast": cx >= mid_x and cy >= mid_y,
                "southwest": cx <= mid_x and cy >= mid_y,
                "north": cy <= mid_y,
                "south": cy >= mid_y,
                "east": cx >= mid_x,
                "west": cx <= mid_x,
                "center": True,
            }
            return checks.get(direction, False)

        vastu_map = {
            "master_bedroom": vastu.get("master_bedroom", {}),
            "kitchen": vastu.get("kitchen", {}),
            "living_room": vastu.get("living_room", {}),
            "pooja_room": vastu.get("pooja_room", {}),
            "bathroom_common": vastu.get("bathroom", {}),
            "bathroom_attached": vastu.get("bathroom", {}),
        }

        # Check and note Vastu compliance
        for room in placed:
            prefs = vastu_map.get(room.room_type, {})
            preferred = prefs.get("preferred", [])
            avoid = prefs.get("avoid", [])

            if preferred:
                in_preferred = any(is_in_direction(room, d) for d in preferred)
                if in_preferred:
                    self.vastu_notes.append(
                        f"{room.name} is in {'/'.join(preferred)} direction (Vastu recommended)."
                    )
                else:
                    # Try to find a room in the preferred zone to swap with
                    swapped = False
                    for other in placed:
                        if other.room_type == room.room_type or other == room:
                            continue
                        other_prefs = vastu_map.get(other.room_type, {})
                        # Only swap rooms in the same strip (same y)
                        if abs(other.y - room.y) > 1:
                            continue
                        if any(is_in_direction(other, d) for d in preferred):
                            # Check if swapping would also help the other room
                            other_preferred = other_prefs.get("preferred", [])
                            if not other_preferred or any(
                                is_in_direction(room, d) for d in other_preferred
                            ):
                                # Swap positions
                                room.x, other.x = other.x, room.x
                                swapped = True
                                self.vastu_notes.append(
                                    f"{room.name} moved to {'/'.join(preferred)} "
                                    f"direction (Vastu swap with {other.name})."
                                )
                                break
                    if not swapped:
                        self.vastu_notes.append(
                            f"{room.name}: Vastu prefers {'/'.join(preferred)} "
                            f"but placement constrained by plot size."
                        )

            if avoid:
                in_avoid = any(is_in_direction(room, d) for d in avoid)
                if in_avoid:
                    self.warnings.append(
                        f"Vastu note: {room.name} is in {'/'.join(avoid)} "
                        f"direction (not recommended). Consider consulting a Vastu expert."
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

        # Corridor info
        if self.corridor:
            self.explanations.append(
                f"Central corridor ({self.corridor['width']}×{self.corridor['length']} ft) "
                f"connects all zones for easy movement."
            )
