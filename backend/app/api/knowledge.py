import os
import re
import uuid
import mimetypes
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.knowledge import KnowledgeFile
from app.models.user import User
from app.schemas.knowledge import (
    KnowledgeFileResponse,
    KnowledgeFileUpdate,
    KnowledgeStatsResponse,
)

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])

MEDIA_BASE = Path(settings.MEDIA_DIR).resolve()
COURSES_MEDIA = MEDIA_BASE / "courses"
VIDEOS_DIR = COURSES_MEDIA / "videos"
PRESENTATIONS_DIR = COURSES_MEDIA / "presentations"
IMAGES_DIR = COURSES_MEDIA / "images"
DOCUMENTS_DIR = COURSES_MEDIA / "documents"

for d in [VIDEOS_DIR, PRESENTATIONS_DIR, IMAGES_DIR, DOCUMENTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def detect_category_and_dir(filename: str, override_type: Optional[str] = None):
    """Determine category and storage directory based on file extension or override."""
    ext = Path(filename).suffix.lower()
    if override_type and override_type in ["video", "presentation", "document", "image"]:
        cat = override_type
    elif ext in [".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".wmv"]:
        cat = "video"
    elif ext in [".pdf", ".ppt", ".pptx"]:
        cat = "presentation"
    elif ext in [".doc", ".docx", ".xls", ".xlsx", ".txt", ".odt", ".csv"]:
        cat = "document"
    elif ext in [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"]:
        cat = "image"
    else:
        cat = "document"

    dir_map = {
        "video": (VIDEOS_DIR, "videos"),
        "presentation": (PRESENTATIONS_DIR, "presentations"),
        "document": (DOCUMENTS_DIR, "documents"),
        "image": (IMAGES_DIR, "images"),
    }
    target_dir, cat_subdir = dir_map.get(cat, (DOCUMENTS_DIR, "documents"))
    return cat, target_dir, cat_subdir, ext


# ==========================================
# 1. LIST & SEARCH KNOWLEDGE BASE FILES
# ==========================================

@router.get("", response_model=List[KnowledgeFileResponse])
async def get_knowledge_files(
    search: Optional[str] = None,
    file_type: Optional[str] = None,
    department: Optional[str] = None,
    sort_by: Optional[str] = "newest",  # newest, name, size
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all Knowledge Base files with search and filtering.
    Available to all authenticated users (employees, methodists, admins).
    """
    stmt = select(KnowledgeFile).options(selectinload(KnowledgeFile.uploaded_by))

    # Search filter
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                KnowledgeFile.title.ilike(term),
                KnowledgeFile.description.ilike(term),
                KnowledgeFile.file_name.ilike(term),
            )
        )

    # Category filter
    if file_type and file_type != "all":
        stmt = stmt.where(KnowledgeFile.file_type == file_type)

    # Department filter
    if department and department != "all":
        stmt = stmt.where(KnowledgeFile.department == department)

    # Sorting
    if sort_by == "name":
        stmt = stmt.order_by(KnowledgeFile.title.asc())
    elif sort_by == "size":
        stmt = stmt.order_by(KnowledgeFile.file_size_bytes.desc())
    else:
        stmt = stmt.order_by(KnowledgeFile.created_at.desc())

    res = await db.execute(stmt)
    files = res.scalars().all()

    out = []
    for f in files:
        out.append(
            KnowledgeFileResponse(
                id=f.id,
                title=f.title,
                description=f.description or "",
                file_name=f.file_name,
                file_url=f.file_url,
                file_type=f.file_type,
                file_size_bytes=f.file_size_bytes,
                mime_type=f.mime_type,
                department=f.department,
                uploaded_by_id=f.uploaded_by_id,
                uploaded_by_name=f.uploaded_by.full_name if f.uploaded_by else None,
                downloads_count=f.downloads_count,
                views_count=f.views_count,
                created_at=f.created_at,
                updated_at=f.updated_at,
            )
        )
    return out


# ==========================================
# 2. STATS OVERVIEW
# ==========================================

@router.get("/stats", response_model=KnowledgeStatsResponse)
async def get_knowledge_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate stats for knowledge base dashboard."""
    files_stmt = select(KnowledgeFile)
    res = await db.execute(files_stmt)
    files = res.scalars().all()

    total_files = len(files)
    total_size = sum(f.file_size_bytes for f in files)
    videos = sum(1 for f in files if f.file_type == "video")
    presentations = sum(1 for f in files if f.file_type == "presentation")
    documents = sum(1 for f in files if f.file_type == "document")
    images = sum(1 for f in files if f.file_type == "image")

    return KnowledgeStatsResponse(
        total_files=total_files,
        total_size_bytes=total_size,
        videos_count=videos,
        presentations_count=presentations,
        documents_count=documents,
        images_count=images,
    )


# ==========================================
# 3. DIRECT UPLOAD (METHODIST / ADMIN)
# ==========================================

@router.post("/upload", response_model=KnowledgeFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_knowledge_file(
    file: UploadFile,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(""),
    department: Optional[str] = Form("Общий"),
    file_type: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """
    Direct upload for videos, presentations, documents and images into the Knowledge Base.
    Saves file to server storage without memory overhead.
    """
    original_name = file.filename or "uploaded_file"
    cat, target_dir, cat_subdir, ext = detect_category_and_dir(original_name, file_type)

    final_file_id = uuid.uuid4().hex
    final_filename = f"{final_file_id}{ext}"
    dest_path = target_dir / final_filename

    total_size = 0
    try:
        with open(dest_path, "wb") as f_out:
            while True:
                chunk = await file.read(64 * 1024)
                if not chunk:
                    break
                f_out.write(chunk)
                total_size += len(chunk)
    finally:
        await file.close()

    mime_type, _ = mimetypes.guess_type(original_name)
    if not mime_type:
        mime_type = "video/mp4" if cat == "video" else "application/octet-stream"

    file_title = (title.strip() if title and title.strip() else Path(original_name).stem)

    final_file_url = f"/media/courses/{cat_subdir}/{final_filename}"

    new_file = KnowledgeFile(
        title=file_title,
        description=description or "",
        file_name=original_name,
        file_url=final_file_url,
        file_type=cat,
        file_size_bytes=total_size,
        mime_type=mime_type,
        department=department or "Общий",
        uploaded_by_id=current_user.id,
    )
    db.add(new_file)
    await db.commit()
    await db.refresh(new_file)

    return KnowledgeFileResponse(
        id=new_file.id,
        title=new_file.title,
        description=new_file.description or "",
        file_name=new_file.file_name,
        file_url=new_file.file_url,
        file_type=new_file.file_type,
        file_size_bytes=new_file.file_size_bytes,
        mime_type=new_file.mime_type,
        department=new_file.department,
        uploaded_by_id=new_file.uploaded_by_id,
        uploaded_by_name=current_user.full_name,
        downloads_count=0,
        views_count=0,
        created_at=new_file.created_at,
        updated_at=new_file.updated_at,
    )


# ==========================================
# 4. VIEW & DOWNLOAD ACTIONS
# ==========================================

@router.post("/{file_id}/view")
async def record_file_view(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Increment views counter when a user watches or opens a file."""
    stmt = select(KnowledgeFile).where(KnowledgeFile.id == file_id)
    res = await db.execute(stmt)
    kfile = res.scalar_one_or_none()
    if kfile:
        kfile.views_count += 1
        await db.commit()
    return {"status": "success", "views": kfile.views_count if kfile else 0}


@router.get("/download/{file_id}")
async def download_knowledge_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Download a file from Knowledge Base with download counter increment
    and proper Content-Disposition attachment header.
    """
    stmt = select(KnowledgeFile).where(KnowledgeFile.id == file_id)
    res = await db.execute(stmt)
    kfile = res.scalar_one_or_none()
    if not kfile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    # Increment downloads count
    kfile.downloads_count += 1
    await db.commit()

    # Locate physical file
    file_rel = kfile.file_url.replace("/media/", "")
    actual_path = MEDIA_BASE / file_rel

    if not actual_path.is_file():
        # Search in subdirectories
        filename = Path(kfile.file_url).name
        for sdir in [VIDEOS_DIR, PRESENTATIONS_DIR, IMAGES_DIR, DOCUMENTS_DIR]:
            candidate = sdir / filename
            if candidate.is_file():
                actual_path = candidate
                break

    if not actual_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Физический файл не найден на сервере",
        )

    # Encode filename for header
    from urllib.parse import quote
    safe_name = quote(kfile.file_name)

    return FileResponse(
        path=actual_path,
        filename=kfile.file_name,
        media_type=kfile.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}",
        },
    )


# ==========================================
# 5. UPDATE & DELETE (METHODIST / ADMIN)
# ==========================================

@router.put("/{file_id}", response_model=KnowledgeFileResponse)
async def update_knowledge_file(
    file_id: int,
    payload: KnowledgeFileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Edit metadata of a knowledge file."""
    stmt = (
        select(KnowledgeFile)
        .options(selectinload(KnowledgeFile.uploaded_by))
        .where(KnowledgeFile.id == file_id)
    )
    res = await db.execute(stmt)
    kfile = res.scalar_one_or_none()
    if not kfile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    if payload.title is not None:
        kfile.title = payload.title
    if payload.description is not None:
        kfile.description = payload.description
    if payload.department is not None:
        kfile.department = payload.department
    if payload.file_type is not None:
        kfile.file_type = payload.file_type

    kfile.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(kfile)

    return KnowledgeFileResponse(
        id=kfile.id,
        title=kfile.title,
        description=kfile.description or "",
        file_name=kfile.file_name,
        file_url=kfile.file_url,
        file_type=kfile.file_type,
        file_size_bytes=kfile.file_size_bytes,
        mime_type=kfile.mime_type,
        department=kfile.department,
        uploaded_by_id=kfile.uploaded_by_id,
        uploaded_by_name=kfile.uploaded_by.full_name if kfile.uploaded_by else None,
        downloads_count=kfile.downloads_count,
        views_count=kfile.views_count,
        created_at=kfile.created_at,
        updated_at=kfile.updated_at,
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Delete file from knowledge base and remove physical file from disk."""
    stmt = select(KnowledgeFile).where(KnowledgeFile.id == file_id)
    res = await db.execute(stmt)
    kfile = res.scalar_one_or_none()
    if not kfile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    # Try removing physical file
    try:
        file_rel = kfile.file_url.replace("/media/", "")
        actual_path = MEDIA_BASE / file_rel
        if actual_path.is_file():
            actual_path.unlink()
        else:
            filename = Path(kfile.file_url).name
            for sdir in [VIDEOS_DIR, PRESENTATIONS_DIR, IMAGES_DIR, DOCUMENTS_DIR]:
                candidate = sdir / filename
                if candidate.is_file():
                    candidate.unlink()
                    break
    except Exception as e:
        print(f"Warning: could not delete physical file for knowledge file {file_id}: {e}")

    await db.delete(kfile)
    await db.commit()
    return None
