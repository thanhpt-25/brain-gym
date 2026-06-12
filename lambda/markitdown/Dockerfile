FROM public.ecr.aws/lambda/python:3.12

# System dependencies note:
# - PDF/DOCX/PPTX/XLSX converters are pure Python — no system binaries needed.
# - Audio conversion (pydub) requires `ffmpeg`. We intentionally exclude the
#   [audio-transcription] extra so ffmpeg is not needed here.
# - If audio support is added in future, uncomment below and add the extra:
#   RUN dnf install -y ffmpeg-free

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py .

CMD ["handler.lambda_handler"]
