from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.tests import router as tests_router
from app.api.attempts import router as attempts_router
from app.api.public import router as public_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(tests_router)
api_router.include_router(attempts_router)
api_router.include_router(public_router)
