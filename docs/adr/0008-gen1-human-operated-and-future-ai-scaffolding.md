# ADR 0008: Generation 1 Human-Operated Boundary & Future AI Scaffolding

**Status:** Accepted (Amended)  
**Date:** 2026-09-12  
**Deciders:** Lead Systems Architect, Product Management  

---

## Context
RestaurantOS is planned across 5 generational milestones:
- **Gen 1:** Human-Operated RestaurantOS
- **Gen 2:** Smart Automation and Predictions
- **Gen 3:** AI Copilot
- **Gen 4:** Agentic RestaurantOS
- **Gen 5:** Highly Autonomous Restaurant Operations

We must guarantee that Generation 1 remains 100% human-operated and deterministic, with zero autonomous operational surprises or hallucination risks, while establishing clean abstract interfaces that permit seamless transition to Gens 2–5 without architectural rewrites.

## Decision
1. **Gen 1 Operational Principle:**
   - No autonomous AI agents operate in the critical execution path.
   - All batch recommendations, inventory reorders, dynamic pricing, and driver assignments require explicit human manager approval or strictly defined deterministic business rules.
   - Vehicle telematics and GPS geofence events do not autonomously mark deliveries as completed; human/driver confirmation remains mandatory.

2. **Abstract Intelligence Scaffolding Interfaces:**
   - Define canonical interfaces:
     - `IPredictionEngine` (Dynamic ETA, prep times, demand forecasts)
     - `IRecommendationEngine` (Upsell items, delivery clusters, schedule staffing)
     - `IDecisionEngine` (Rule-based & heuristic advisory recommendations)
     - `ILearningEngine` (Ingesting human approval/rejection feedback telemetry)
     - `IAutomationPolicyEngine` (Policy boundaries and guardrails for Gen 4/5)

3. **Supervised Telemetry & Decision Logging:**
   - In Gen 1, all system recommendations, scores, human managerial decisions (`APPROVED`, `REJECTED`, `MODIFIED`, `FORCED`), rejection reason codes, and final operational outcomes are recorded in `intelligence_decision_logs` with `model_version = NULL`.
   - In Gen 2+, these decision logs form the high-fidelity supervised training dataset for machine learning models.

## Consequences
- **Positive:** Maximum operational safety and reliability for live restaurant kitchens; pristine data pipeline for training future AI models.
- **Negative:** Human managers must explicitly tap approval buttons in Gen 1.
