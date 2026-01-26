# API routes for dashboard statistics
from fastapi import APIRouter, HTTPException, Depends
import logging
from typing import Dict

from src.database.connection import mongo_connection
from src.api.models import DashboardStatsResponse, CandidateStats, JobStats, ClientStats
from src.api.routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def verify_mlg_recruiter_role(current_user: Dict):
    """Verify that the current user has the mlg-recruiter role."""
    if current_user.get("role") != "mlg-recruiter":
        raise HTTPException(
            status_code=403,
            detail="Access denied. MLG recruiter role required."
        )


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(current_user: Dict = Depends(get_current_user)):
    """Get aggregated statistics for the MLG dashboard."""
    verify_mlg_recruiter_role(current_user)
    try:
        # Candidate stats using aggregation (exclude mlg-recruiters)
        candidate_pipeline = [
            {
                "$match": {"role": {"$ne": "mlg-recruiter"}}
            },
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "byStatus": [
                        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
                    ],
                    "onboarding": [
                        {"$match": {"assessment_sent": True}},
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

            # Total count
            if facets.get("total") and len(facets["total"]) > 0:
                total_candidates = facets["total"][0].get("count", 0)

            # Status breakdown
            for status_group in facets.get("byStatus", []):
                status = status_group.get("_id")
                count = status_group.get("count", 0)
                if status == "pending" or status is None:
                    pending += count
                elif status == "accepted":
                    accepted = count
                elif status == "rejected":
                    rejected = count

            # Onboarding (assessment sent)
            if facets.get("onboarding") and len(facets["onboarding"]) > 0:
                onboarding = facets["onboarding"][0].get("count", 0)

        # Job stats using aggregation
        job_pipeline = [
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "withEmbeddings": [
                        {"$match": {"profile_embedding": {"$exists": True}}},
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
            if facets.get("withEmbeddings") and len(facets["withEmbeddings"]) > 0:
                jobs_with_matches = facets["withEmbeddings"][0].get("count", 0)

        # Client stats from clients collection
        clients_collection = mongo_connection.clients_collection
        total_clients = clients_collection.count_documents({})
        clients_onboarding = clients_collection.count_documents({"status": "onboarding"})

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
                intake_phase=clients_onboarding
            )
        )

    except HTTPException:
        # Re-raise HTTPExceptions (like auth failures) without masking them
        raise
    except Exception as e:
        logger.error(f"Failed to fetch dashboard stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard statistics")
