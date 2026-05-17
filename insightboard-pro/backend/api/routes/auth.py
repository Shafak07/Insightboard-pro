from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import CurrentUser, get_current_user, get_user_from_token
from schemas.common import ApiResponse

router = APIRouter()


class VerifyTokenRequest(BaseModel):
    token: str


@router.post("/verify", response_model=ApiResponse[CurrentUser])
async def verify_token(body: VerifyTokenRequest) -> ApiResponse[CurrentUser]:
    """Verify a Supabase JWT and return the user profile."""
    user = await get_user_from_token(body.token)
    return ApiResponse(success=True, data=user, message="Token is valid")


@router.get("/me", response_model=ApiResponse[CurrentUser])
async def get_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ApiResponse[CurrentUser]:
    """Return the authenticated user's profile."""
    return ApiResponse(success=True, data=current_user)
