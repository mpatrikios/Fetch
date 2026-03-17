# API routes for dashboard statistics
from fastapi import APIRouter, HTTPException, Depends
import logging

from src.database.connection import mongo_connection
from src.api.models import DashboardStatsResponse, CandidateStats, JobStats, ClientStats
from src.api.auth_utils import get_current_mlg_recruiter

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats():
    """Get aggregated statistics for the MLG dashboard."""
    try:
        # Candidate stats using aggregation
        pending_match = {
            "$or": [
                {"status": {"$nin": ["rejected", "accepted"]}},
                {"status": {"$exists": False}},
                {"status": None}
            ]
        }
        candidate_pipeline = [
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "pending": [
                        {"$match": pending_match},
                        {"$count": "count"}
                    ],
                    "accepted": [
                        {"$match": {"status": "accepted"}},
                        {"$count": "count"}
                    ],
                    "rejected": [
                        {"$match": {"status": "rejected"}},
                        {"$count": "count"}
                    ],
                    "onboarding": [
                        {"$match": {"assessment_sent": True, "status": {"$nin": ["accepted", "rejected"]}}},
                        {"$count": "count"}
                    ]
                }
            }
        ]

        candidate_result = list(mongo_connection.candidates_collection.aggregate(candidate_pipeline))

        # Parse candidate stats
        total_candidates = 0
        pending = 0
        accepted = 0
        rejected = 0
        onboarding = 0

        if candidate_result:
            facets = candidate_result[0]
            if facets.get("total"):
                total_candidates = facets["total"][0].get("count", 0)
            if facets.get("pending"):
                pending = facets["pending"][0].get("count", 0)
            if facets.get("accepted"):
                accepted = facets["accepted"][0].get("count", 0)
            if facets.get("rejected"):
                rejected = facets["rejected"][0].get("count", 0)
            if facets.get("onboarding"):
                onboarding = facets["onboarding"][0].get("count", 0)

        # Job stats using aggregation
        job_pipeline = [
            {"$match": {"profile_embedding": {"$exists": True}}},
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "withMatches": [
                        {"$match": {"last_match_generated_at": {"$exists": True}}},
                        {"$count": "count"}
                    ]
                }
            }
        ]

        job_result = list(mongo_connection.job_descriptions_collection.aggregate(job_pipeline))

        total_jobs = 0
        jobs_with_matches = 0

        if job_result:
            facets = job_result[0]
            if facets.get("total") and len(facets["total"]) > 0:
                total_jobs = facets["total"][0].get("count", 0)
            if facets.get("withMatches") and len(facets["withMatches"]) > 0:
                jobs_with_matches = facets["withMatches"][0].get("count", 0)

        # Client stats from clients collection
        clients_collection = mongo_connection.clients_collection
        total_clients = clients_collection.count_documents({})
        clients_onboarding = clients_collection.count_documents({"status": {"$regex": "^onboarding$", "$options": "i"}})

        return DashboardStatsResponse(
            success=True,
            candidates=CandidateStats(
                total=total_candidates,
                pending=pending,
                accepted=accepted,
                rejected=rejected,
                onboarding=onboarding
            ),
            jobs=JobStats(
                total=total_jobs,
                with_matches=jobs_with_matches
            ),
            clients=ClientStats(
                total=total_clients,
                onboarding=clients_onboarding
            )
        )

    except HTTPException:
        # Re-raise HTTPExceptions (like auth failures) without masking them
        raise
    except Exception as e:
        logger.error(f"Failed to fetch dashboard stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard statistics")
