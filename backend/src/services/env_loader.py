"""
Centralized environment variable loader for the entire project.

This module ensures all Python scripts load from the same root .env file,
eliminating confusion from multiple .env files in different directories.

Usage:
    from env_loader import load_env
    load_env()  # Loads from root .env file
"""
from pathlib import Path
from dotenv import load_dotenv
import os

_env_loaded = False

def load_env(force_reload: bool = False) -> Path | None:
    """
    Load environment variables from the root .env file.

    Args:
        force_reload: If True, reload even if already loaded

    Returns:
        Path to the .env file that was loaded, or None if no file exists (production)
    """
    global _env_loaded

    if _env_loaded and not force_reload:
        return get_env_path()

    # Find the root .env file (going up from this file's location)
    # backend/src/services/env_loader.py -> root/.env (3 levels up)
    root_dir = Path(__file__).parent.parent.parent.parent
    env_path = root_dir / '.env'

    if not env_path.exists():
        # Fallback to .env.local if .env doesn't exist
        env_local_path = root_dir / '.env.local'
        if env_local_path.exists():
            env_path = env_local_path
        else:
            # In production (e.g., Render), env vars are set directly, no .env file needed
            _env_loaded = True
            return None

    load_dotenv(env_path, override=force_reload)
    _env_loaded = True

    return env_path


def get_env_path() -> Path:
    """Get the path to the root .env file without loading it."""
    root_dir = Path(__file__).parent.parent.parent.parent
    env_path = root_dir / '.env'

    if not env_path.exists():
        env_path = root_dir / '.env.local'

    return env_path


def verify_required_vars(*var_names: str) -> None:
    """
    Verify that required environment variables are set.

    Args:
        *var_names: Names of required environment variables

    Raises:
        RuntimeError: If any required variable is missing
    """
    missing = [var for var in var_names if not os.getenv(var)]

    if missing:
        env_path = get_env_path()
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}\n"
            f"Please add them to {env_path}"
        )


# Auto-load on import (can be disabled by importing specific functions only)
if __name__ != "__main__":
    try:
        load_env()
    except FileNotFoundError:
        # Don't fail on import if no .env exists yet
        pass
