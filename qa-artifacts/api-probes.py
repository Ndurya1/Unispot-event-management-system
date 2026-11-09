"""Bounded HTTP measurements and GET coverage of the isolated QA server."""

import asyncio
import json
import math
import statistics
from pathlib import Path
from time import perf_counter

import httpx

ROOT = Path(__file__).resolve().parent
API = "http://127.0.0.1:18000"


async def main():
    result = {"base_url": API, "route_inventory": [], "get_checks": [], "performance": []}
    async with httpx.AsyncClient(base_url=API, timeout=15) as client:
        schema = (await client.get("/openapi.json")).json()
        login = await client.post("/auth/login", json={"email": "qa-audit-system_admin@example.com", "password": "Local-QA-only-123!"})
        assert login.status_code == 200, login.status_code
        auth = {"Authorization": "Bearer " + login.json()["access_token"]}
        for path, methods in schema["paths"].items():
            for method, operation in methods.items():
                result["route_inventory"].append({"method": method.upper(), "path": path, "protected": bool(operation.get("security"))})
            if "get" not in methods or "{" in path:
                continue
            query = {}
            if path in ("/availability", "/equipment/availability"):
                query = {"starts_at": "2026-11-15T08:00:00Z", "ends_at": "2026-11-15T10:00:00Z"}
            response = await client.get(path, headers=auth, params=query)
            result["get_checks"].append({"path": path, "status": response.status_code, "bytes": len(response.content), "error": response.json().get("error") if response.status_code >= 400 else None})
        for route in ("/health", "/health/readiness", "/venues", "/events", "/providers"):
            # Warm-up, followed by 20 requests at a maximum concurrency of four.
            await client.get(route)
            semaphore = asyncio.Semaphore(4)

            async def measure():
                async with semaphore:
                    start = perf_counter()
                    response = await client.get(route)
                    return (perf_counter() - start) * 1000, response.status_code

            samples = await asyncio.gather(*(measure() for _ in range(20)))
            timings = sorted(row[0] for row in samples)
            result["performance"].append({"path": route, "requests": 20, "concurrency": 4,
                                           "median_ms": round(statistics.median(timings), 2),
                                           "p95_ms": round(timings[math.ceil(len(timings) * .95) - 1], 2),
                                           "max_ms": round(max(timings), 2),
                                           "statuses": {str(code): sum(1 for _, status in samples if status == code) for code in set(s[1] for s in samples)}})
    (ROOT / "api-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"operations": len(result["route_inventory"]), "get_checks": result["get_checks"], "performance": result["performance"]}, indent=2))


asyncio.run(main())
