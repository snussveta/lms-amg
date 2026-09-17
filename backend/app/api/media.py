import os
import re
import shutil
import uuid
import mimetypes
from pathlib import Path
from typing import Optional, AsyncGenerator

from fastapi import APIRouter, Depends, Form, HTTPException, Header, Request, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from app.core.config import settings
from app.core.security import get_current_user, require_role
from app.models.user import User

router = APIRouter(tags=["Media"])

# Resolve base media directory
MEDIA_BASE = Path(settings.MEDIA_DIR).resolve()
COURSES_MEDIA = MEDIA_BASE / "courses"
VIDEOS_DIR = COURSES_MEDIA / "videos"
PRESENTATIONS_DIR = COURSES_MEDIA / "presentations"
IMAGES_DIR = COURSES_MEDIA / "images"
TEMP_DIR = MEDIA_BASE / "temp_chunks"

# Ensure storage directories exist
for p in [VIDEOS_DIR, PRESENTATIONS_DIR, IMAGES_DIR, TEMP_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# Register common video/document mimetypes
mimetypes.add_type("video/mp4", ".mp4")
mimetypes.add_type("video/webm", ".webm")
mimetypes.add_type("video/x-matroska", ".mkv")
mimetypes.add_type("application/pdf", ".pdf")


def get_file_path_by_id(file_id: str) -> Optional[Path]:
    """Find file in media storage directories by file_id prefix or exact name."""
    # Sanitize file_id to prevent path traversal
    safe_id = re.sub(r"[^a-zA-Z0-9_\-\.]", "", file_id)
    if not safe_id:
        return None

    # Search in videos, presentations, images
    for search_dir in [VIDEOS_DIR, PRESENTATIONS_DIR, IMAGES_DIR]:
        # Exact match
        exact = search_dir / safe_id
        if exact.is_file():
            return exact
        # Match with extension
        for f in search_dir.glob(f"{safe_id}.*"):
            if f.is_file():
                return f
        # Match if safe_id contains extension
        for f in search_dir.glob(f"{safe_id}"):
            if f.is_file():
                return f

    return None


# Try importing aiofiles, otherwise provide thread-pool async file reader
try:
    import aiofiles

    async def async_file_chunk_generator(file_path: Path, start: int, length: int, chunk_size: int = 256 * 1024) -> AsyncGenerator[bytes, None]:
        remaining = length
        async with aiofiles.open(file_path, mode="rb") as f:
            await f.seek(start)
            while remaining > 0:
                read_bytes = min(remaining, chunk_size)
                data = await f.read(read_bytes)
                if not data:
                    break
                remaining -= len(data)
                yield data
except ImportError:
    import anyio

    async def async_file_chunk_generator(file_path: Path, start: int, length: int, chunk_size: int = 256 * 1024) -> AsyncGenerator[bytes, None]:
        remaining = length
        def read_block(f, n):
            return f.read(n)

        with open(file_path, "rb") as f:
            f.seek(start)
            while remaining > 0:
                read_bytes = min(remaining, chunk_size)
                data = await anyio.to_thread.run_sync(read_block, f, read_bytes)
                if not data:
                    break
                remaining -= len(data)
                yield data


# ==========================================
# 1. CHUNKED UPLOAD ENDPOINTS
# ==========================================

@router.post("/media/upload/chunk")
@router.post("/v1/media/upload/chunk")
async def upload_media_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    chunk_file: UploadFile = Form(...),
    original_filename: str = Form("file.mp4"),
    category: str = Form("video"),  # video, presentation, image
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """
    Chunked upload endpoint for giant media files (5+ hours videos, 2-10 GB).
    Saves chunks directly to disk without loading file into server RAM.
    """
    safe_upload_id = re.sub(r"[^a-zA-Z0-9_\-]", "", upload_id)
    if not safe_upload_id:
        safe_upload_id = str(uuid.uuid4())

    temp_session_dir = TEMP_DIR / safe_upload_id
    temp_session_dir.mkdir(parents=True, exist_ok=True)

    chunk_filename = temp_session_dir / f"chunk_{chunk_index:06d}.part"

    # Write current chunk to disk in blocks of 64KB
    try:
        with open(chunk_filename, "wb") as f_out:
            while True:
                block = await chunk_file.read(64 * 1024)
                if not block:
                    break
                f_out.write(block)
    finally:
        await chunk_file.close()

    # Check if all chunks have arrived
    existing_chunks = list(temp_session_dir.glob("chunk_*.part"))
    if len(existing_chunks) == total_chunks:
        # Sort chunks in strict sequential order
        existing_chunks.sort(key=lambda p: p.name)

        # Determine target directory based on category/file extension
        ext = Path(original_filename).suffix.lower() or ".mp4"
        final_file_id = f"{uuid.uuid4().hex}"
        
        if category == "presentation" or ext in [".pdf", ".ppt", ".pptx"]:
            target_dir = PRESENTATIONS_DIR
            ext = ext if ext else ".pdf"
        elif category == "image" or ext in [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]:
            target_dir = IMAGES_DIR
            ext = ext if ext else ".png"
        else:
            target_dir = VIDEOS_DIR
            ext = ext if ext else ".mp4"

        final_filename = f"{final_file_id}{ext}"
        final_path = target_dir / final_filename

        # Stream-merge all chunk files sequentially into the final file
        total_size = 0
        with open(final_path, "wb") as f_out:
            for chunk_p in existing_chunks:
                with open(chunk_p, "rb") as f_in:
                    while True:
                        block = f_in.read(256 * 1024)
                        if not block:
                            break
                        f_out.write(block)
                        total_size += len(block)

        # Clean up temporary chunks directory
        shutil.rmtree(temp_session_dir, ignore_errors=True)

        return {
            "status": "completed",
            "upload_id": safe_upload_id,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "file_id": final_file_id,
            "filename": final_filename,
            "original_name": original_filename,
            "file_size_bytes": total_size,
            "file_url": f"/api/v1/media/stream/{final_file_id}",
        }

    return {
        "status": "in_progress",
        "upload_id": safe_upload_id,
        "chunk_index": chunk_index,
        "total_chunks": total_chunks,
        "received_chunks": len(existing_chunks),
    }


@router.post("/media/upload/image")
@router.post("/v1/media/upload/image")
async def upload_image_direct(
    file: UploadFile,
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Direct upload for longread images (car components, diagrams, infographics)."""
    ext = Path(file.filename or "image.jpg").suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"]:
        ext = ".jpg"

    file_id = uuid.uuid4().hex
    filename = f"{file_id}{ext}"
    dest_path = IMAGES_DIR / filename

    size = 0
    try:
        with open(dest_path, "wb") as f_out:
            while True:
                block = await file.read(64 * 1024)
                if not block:
                    break
                f_out.write(block)
                size += len(block)
    finally:
        await file.close()

    return {
        "file_id": file_id,
        "filename": filename,
        "file_url": f"/api/v1/media/stream/{file_id}",
        "file_size_bytes": size,
    }


# ==========================================
# 2. HTTP 206 PARTIAL CONTENT RANGE STREAMING
# ==========================================

@router.get("/media/stream/{file_id}")
@router.get("/v1/media/stream/{file_id}")
async def stream_media_range(
    file_id: str,
    request: Request,
    range_header: Optional[str] = Header(None, alias="Range"),
):
    """
    High-performance streaming endpoint with mandatory HTTP 206 Partial Content support.
    Enables instant seeking in 5+ hour video lectures without downloading the full gigabytes.
    """
    file_path = get_file_path_by_id(file_id)
    if not file_path or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Медиафайл {file_id} не найден на сервере.",
        )

    file_size = file_path.stat().st_size
    content_type, _ = mimetypes.guess_type(str(file_path))
    if not content_type:
        content_type = "video/mp4" if file_path.suffix in [".mp4", ".mkv", ".webm"] else "application/octet-stream"

    # If no Range header is sent by client, return standard 200 stream or full file
    if not range_header:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": content_type,
            "Cache-Control": "public, max-age=31536000",
        }
        return StreamingResponse(
            async_file_chunk_generator(file_path, 0, file_size),
            status_code=status.HTTP_200_OK,
            headers=headers,
            media_type=content_type,
        )

    # Parse Range Header: format "bytes=start-end"
    range_match = re.match(r"^bytes=(\d*)-(\d*)$", range_header.strip())
    if not range_match:
        # Malformed range header
        return Response(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    start_str, end_str = range_match.groups()

    if start_str and end_str:
        start = int(start_str)
        end = int(end_str)
    elif start_str:
        start = int(start_str)
        end = file_size - 1
    elif end_str:
        # Suffix range: last N bytes
        suffix_length = int(end_str)
        start = max(0, file_size - suffix_length)
        end = file_size - 1
    else:
        start = 0
        end = file_size - 1

    if start >= file_size or end >= file_size or start > end:
        return Response(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    content_length = end - start + 1

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Type": content_type,
        "Cache-Control": "no-cache",
    }

    return StreamingResponse(
        async_file_chunk_generator(file_path, start, content_length),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type=content_type,
    )
