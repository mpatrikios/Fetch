"""
Shared authentication and authorization utilities
"""
from typing import Dict
from fastapi import Depends, HTTPException, Path

from src.api.routes.auth_routes import get_current_user


def verify_mlg_recruiter_role(current_user: Dict) -> None:
    """
    Verify that the current user has the mlg-recruiter role.

    Args:
        current_user: The authenticated user dictionary

    Raises:
        HTTPException: 403 if user doesn't have mlg-recruiter role
    """
    if current_user.get("role") != "mlg-recruiter":
        raise HTTPException(
            status_code=403,
            detail="Access denied. MLG recruiter role required."
        )


def is_mlg_recruiter(current_user: Dict) -> bool:
    """Check if the current user has the mlg-recruiter role."""
    return current_user.get("role") == "mlg-recruiter"


async def get_current_mlg_recruiter(
    current_user: Dict = Depends(get_current_user)
) -> Dict:
    """Combined dependency: authenticate + verify mlg-recruiter role."""
    verify_mlg_recruiter_role(current_user)
    return current_user


async def get_candidate_or_recruiter(
    candidate_id: str = Path(...),
    current_user: Dict = Depends(get_current_user),
) -> Dict:
    """
    Authorize access to a candidate's resources.
    Allows the candidate themselves or any MLG recruiter.
    Returns the authenticated user.
    """
    is_own = str(current_user["_id"]) == candidate_id
    if not is_own and not is_mlg_recruiter(current_user):
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only access your own documents or must be an MLG recruiter."
        )
    return current_user
