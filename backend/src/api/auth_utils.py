"""
Shared authentication and authorization utilities
"""
from typing import Dict
from fastapi import Depends, HTTPException

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


async def get_current_mlg_recruiter(
    current_user: Dict = Depends(get_current_user)
) -> Dict:
    """Combined dependency: authenticate + verify mlg-recruiter role."""
    verify_mlg_recruiter_role(current_user)
    return current_user
