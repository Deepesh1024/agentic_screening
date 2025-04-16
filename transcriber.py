import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

transcirber = Groq(api_key=os.getenv("GROQ_TRANSCRIBER_API_KEY"))
filename = os.path.dirname(__file__) + "/audio.m4a"

def transcribe_audio(filename):
    with open(filename, "rb") as file:
        transcription = transcirber.audio.transcriptions.create(
        file=(filename, file.read()),
        model="whisper-large-v3-turbo",
        response_format="verbose_json",
        )
        return transcription.text
    
transcription_text  = transcribe_audio("my_recording.wav")
print(transcription_text)
