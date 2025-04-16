from groq import Groq
import base64
import os
from pathlib import Path
import sys
import json
from dotenv import load_dotenv
import os

load_dotenv()
transcriber = Groq(api_key=os.getenv("GROQ_TRANSCRIBER_API_KEY"))
chat_bot = Groq(api_key=os.getenv("GROQ_CHATBOT_API_KEY"))
tts_client = Groq(api_key=os.getenv("GROQ_TTS_API_KEY"))

def transcribe_and_respond(audio_file_path, session_id):
    try:
        with open(audio_file_path, "rb") as audio_file:
            transcription = transcriber.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3-turbo",
                response_format="verbose_json"
            )
        transcription_text = transcription["text"]
        print(f"Transcription for session {session_id}: {transcription_text}")

        response_chunks = []
        completion = chat_bot.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {"role": "system", "content": "You are an interviewer that asks questions"},
                {"role": "user", "content": transcription_text}
            ],
            temperature=1,
            max_completion_tokens=1024,
            top_p=1,
            stream=True,
            stop=None
        )
        for chunk in completion:
            content = chunk.choices[0].delta.content or ""
            response_chunks.append(content)
            print(content, end="")
        reply = "".join(response_chunks)
        print(f"\nFull response for session {session_id}: {reply}")

        speech_file_path = Path(__file__).parent / f"response_{session_id}.wav"
        response = tts_client.audio.speech.create(
            model="playai-tts",
            voice="Atlas-PlayAI",
            response_format="wav",
            input=reply
        )
        response.stream_to_file(speech_file_path)

        with open(speech_file_path, "rb") as speech_file:
            audio_data = base64.b64encode(speech_file.read()).decode('utf-8')

        if os.path.exists(speech_file_path):
            os.remove(speech_file_path)
        if os.path.exists(audio_file_path):
            os.remove(audio_file_path)

        result = {
            "session_id": session_id,
            "transcription": transcription_text,
            "response_text": reply,
            "audio": audio_data
        }
        print(f"Emitting result to session {session_id}: {json.dumps(result)}")

    except Exception as e:
        print(f"Error in transcribe_and_respond: {e}")
        result = {"session_id": session_id, "error": str(e)}
        print(f"Emitting error to session {session_id}: {json.dumps(result)}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python transcribe_and_respond.py <audio_file_path> <session_id>")
        sys.exit(1)
    audio_file_path = sys.argv[1]
    session_id = sys.argv[2]
    transcribe_and_respond(audio_file_path, session_id)