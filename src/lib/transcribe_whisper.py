import json
import sys

from faster_whisper import WhisperModel

model_name, audio_path, language = sys.argv[1:4]
model = WhisperModel(model_name, device="cuda", compute_type="float16")
segments, _info = model.transcribe(audio_path, language=language)
payload = [
    {"start": segment.start, "end": segment.end, "text": segment.text.strip()}
    for segment in segments
    if segment.text.strip()
]
json.dump(payload, sys.stdout, ensure_ascii=False)
