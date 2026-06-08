"""
Local development server — mimics the Lambda handler via HTTP.
Run via Dockerfile.local (docker-compose service: markitdown).
"""
import os
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from markitdown import MarkItDown

app = FastAPI()
md = MarkItDown()

# Must match SUPPORTED_EXTENSIONS in handler.py
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx"}


@app.post("/convert")
async def convert(file: UploadFile = File(...), filename: str = Form(...)):
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}",
        )

    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        result = md.convert(tmp_path)
        markdown = result.text_content or ""
    finally:
        os.unlink(tmp_path)

    return JSONResponse({"markdown": markdown, "filename": filename})


@app.get("/health")
async def health():
    return {"status": "ok"}
