# PlanWise

A constraint-based house plan generator for the Indian residential market.

Enter your plot dimensions, house type, facing direction, and budget — PlanWise generates a buildable floor plan with room placements, Vastu compliance notes, and a detailed construction cost estimate.

---

## Features

- Generates 2D floor plans from plot constraints (setbacks, FSI, ground coverage)
- Supports 1BHK, 2BHK, 3BHK with and without Pooja room
- Vastu-compliant room placement (optional)
- 3 layout variations per request (Balanced, Compact, Open Plan)
- Construction cost estimate with phase-wise breakdown (Economy / Standard / Premium)
- Budget analysis — shows surplus or deficit against your budget
- Multi-floor support (G, G+1, G+2)
- All facing directions: North, South, East, West

---

## Tech Stack

| Layer    | Technology               |
|----------|--------------------------|
| Frontend | Next.js 16, Tailwind CSS |
| Backend  | FastAPI, Python 3.12     |
| Engine   | Pure Python (no ML/AI)   |

---

## Project Structure

```
planwise/
├── backend/
│   ├── main.py                  # FastAPI app, /generate-plan endpoint
│   ├── engine/
│   │   ├── layout_generator.py  # Core strip-based room placement
│   │   ├── space_calculator.py  # Setbacks, FSI, buildable area
│   │   ├── cost_engine.py       # Construction cost estimation
│   │   └── explainer.py         # Human-readable explanations
│   ├── data/
│   │   ├── room_rules.json      # Room specs, zones, Vastu rules
│   │   └── setbacks.json        # Municipal setback rules by plot size
│   ├── models/
│   │   └── schemas.py           # Pydantic request/response models
│   ├── tests/
│   │   ├── test_api.py
│   │   ├── test_layout_generator.py
│   │   ├── test_space_calculator.py
│   │   └── test_cost_engine.py
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Main UI with form and floor plan SVG
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── package.json
├── package.json                 # Root scripts for running both servers
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- pip

### Install dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..

# Root (for running both together)
npm install
```

### Run (both servers in one command)

```bash
npm start
```

This starts:
- Backend at `http://localhost:8000`
- Frontend at `http://localhost:3000`

### Run separately

```bash
# Backend only
cd backend
uvicorn main:app --reload --reload-dir backend --port 8000

# Frontend only
cd frontend
npm run dev
```

---

## API

### `POST /generate-plan`

Request body:

```json
{
  "plot_length": 50,
  "plot_width": 30,
  "house_type": "2BHK",
  "floors": 1,
  "facing": "east",
  "vastu_compliant": true,
  "cost_tier": "standard",
  "parking": false,
  "budget": 1500000
}
```

`house_type` options: `1BHK`, `2BHK`, `3BHK`, `2BHK_with_pooja`, `3BHK_with_pooja`

`cost_tier` options: `economy` (~1200/sqft), `standard` (~1600/sqft), `premium` (~2200/sqft)

Response includes rooms, corridor, 3 layout variations, cost breakdown, and budget analysis.

### `GET /house-types`

Returns supported house types with room lists.

### `GET /cost-tiers`

Returns cost tier details and rates.

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

67 tests covering layout generation, space calculation, cost estimation, and API endpoints.

---

## Disclaimer

PlanWise is a pre-planning tool only. Generated plans are indicative, not structurally certified. Always engage a licensed architect and structural engineer before construction.
