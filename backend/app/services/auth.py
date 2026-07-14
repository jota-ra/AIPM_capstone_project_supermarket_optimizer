"""
Authentication (E1) — replaces the anonymous X-Session-Id scoping.

The frontend signs in via Supabase Auth (email+password or Google) and
sends the resulting access token as `Authorization: Bearer <jwt>`.

Supabase can sign these access tokens two ways:
  - legacy: HS256, using the project's shared JWT secret;
  - current: asymmetric (ES256/RS256) using rotating signing keys exposed
    at the project's JWKS endpoint.
This project uses the asymmetric keys (the legacy keys are still valid as
API keys, but user tokens are ES256). We verify BOTH: pick the branch
from the token header's `alg`, so it keeps working through/after the key
migration either way.

`get_current_user` returns the authenticated user's id (token `sub`,
i.e. Supabase `auth.users.id`). All per-user data is scoped to this id
in the DB layer (app-enforced), with RLS policies as defense-in-depth.
"""

from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException, status

from backend.app.core.config import settings

# Supabase access tokens carry this audience once a user is signed in.
_AUDIENCE = "authenticated"
_ASYMMETRIC_ALGS = ["ES256", "RS256", "EdDSA"]

# Lazily-initialised JWKS client (network fetch happens on first use and is
# cached by the client). Points at the project's public signing keys.
_jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
_jwk_client: Optional[PyJWKClient] = None


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = PyJWKClient(_jwks_url)
    return _jwk_client


def get_current_user(authorization: Optional[str] = Header(default=None)) -> str:
    """
    Verify the Supabase bearer token and return the user's id (`sub`).

    Fails closed:
      - 401 for a missing/malformed/invalid/expired token,
      - 503 only if an HS256 token arrives but no JWT secret is configured.
    """

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1].strip()

    try:
        alg = jwt.get_unverified_header(token).get("alg")

        if alg == "HS256":
            # Legacy shared-secret signing.
            if not settings.SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="HS256 token received but SUPABASE_JWT_SECRET is not configured.",
                )
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience=_AUDIENCE,
            )
        else:
            # Current asymmetric signing: fetch the public key by `kid`.
            signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=_ASYMMETRIC_ALGS,
                audience=_AUDIENCE,
            )
    except HTTPException:
        raise
    except Exception as exc:  # jwt errors + JWKS fetch/key errors
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing a subject (user id).",
        )
    return user_id
