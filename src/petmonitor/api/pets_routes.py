"""Pets CRUD routes — user-defined pet identity (ADR 0006)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from petmonitor.api.deps import get_db
from petmonitor.storage.database import Database

router = APIRouter(prefix="/pets")

_REF_MAX = 10
_VALID_SPECIES = {"dog", "cat"}
_DATA_DIR = Path("data/pet_references")


class PetCreate(BaseModel):
    name: str
    species: str
    color: str | None = None
    breed: str | None = None
    notes: str | None = None


class PetUpdate(BaseModel):
    name: str | None = None
    species: str | None = None
    color: str | None = None
    breed: str | None = None
    notes: str | None = None


def _pet_with_stats(pet: dict, db: Database) -> dict:
    stats = {r["identity"]: r for r in db.get_identity_stats()}
    s = stats.get(pet["name"], {"track_count": 0, "clip_count": 0})
    return {
        **pet,
        "track_count": s["track_count"],
        "clip_count": s["clip_count"],
    }


@router.get("")
def list_pets(db: Database = Depends(get_db)) -> list:
    pets = db.list_pets(active_only=True)
    stats = {r["identity"]: r for r in db.get_identity_stats()}
    result = []
    for p in pets:
        s = stats.get(p["name"], {"track_count": 0, "clip_count": 0})
        result.append({**p, "track_count": s["track_count"], "clip_count": s["clip_count"]})
    return result


@router.post("", status_code=201)
def create_pet(body: PetCreate, db: Database = Depends(get_db)) -> dict:
    if body.species not in _VALID_SPECIES:
        raise HTTPException(status_code=422, detail=f"species must be one of {_VALID_SPECIES}")
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="name is required")
    pet_id = db.insert_pet(
        name=body.name.strip(),
        species=body.species,
        color=body.color,
        breed=body.breed,
        notes=body.notes,
    )
    pet = db.get_pet(pet_id)
    if pet is None:
        raise HTTPException(status_code=500, detail="Failed to create pet")
    return _pet_with_stats(pet, db)


@router.put("/{pet_id}")
def update_pet(pet_id: int, body: PetUpdate, db: Database = Depends(get_db)) -> dict:
    pet = db.get_pet(pet_id)
    if pet is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    if body.species is not None and body.species not in _VALID_SPECIES:
        raise HTTPException(status_code=422, detail=f"species must be one of {_VALID_SPECIES}")
    db.update_pet(
        pet_id,
        name=body.name,
        species=body.species,
        color=body.color,
        breed=body.breed,
        notes=body.notes,
    )
    updated = db.get_pet(pet_id)
    assert updated is not None
    return _pet_with_stats(updated, db)


@router.delete("/{pet_id}", status_code=204)
def archive_pet(pet_id: int, db: Database = Depends(get_db)) -> None:
    pet = db.get_pet(pet_id)
    if pet is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    db.archive_pet(pet_id)


@router.get("/{pet_id}/references")
def list_references(pet_id: int, db: Database = Depends(get_db)) -> list:
    if db.get_pet(pet_id) is None:
        raise HTTPException(status_code=404, detail="Pet not found")
    return db.list_pet_references(pet_id)


@router.delete("/references/{ref_id}", status_code=204)
def delete_reference(ref_id: int, db: Database = Depends(get_db)) -> None:
    ref = db.get_pet_reference(ref_id)
    if ref is None:
        raise HTTPException(status_code=404, detail="Reference not found")
    # Remove file if it exists
    img_path = Path(ref.get("image_path", ""))
    if img_path.exists():
        try:
            img_path.unlink()
        except OSError:
            pass
    db.delete_pet_reference(ref_id)
