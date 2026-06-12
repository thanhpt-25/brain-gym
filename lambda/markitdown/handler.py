import json
import os
import tempfile
import boto3
from markitdown import MarkItDown

s3_client = boto3.client("s3")
md = MarkItDown()

# Formats supported by this Lambda (must match markitdown extras in requirements.txt).
# Audio/video are excluded because they require the ffmpeg system binary.
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx"}


def lambda_handler(event, context):
    bucket = event["bucket"]
    key = event["key"]
    filename = event.get("filename", key.split("/")[-1])

    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return {
            "error": f"Unsupported file extension '{ext}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}",
            "markdown": "",
        }

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        s3_client.download_fileobj(bucket, key, tmp)
        tmp_path = tmp.name

    try:
        result = md.convert(tmp_path)
        markdown = result.text_content or ""
    finally:
        os.unlink(tmp_path)

    return {"markdown": markdown, "filename": filename}
