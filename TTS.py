import os
from groq import Groq
from dotenv import load_dotenv
import subprocess

load_dotenv()

api_key = os.getenv("GROQ_TTS_API_KEY")
if not api_key:
    raise ValueError("GROQ_TTS_API_KEY not found in .env file")

speech_bot = Groq(api_key=api_key)

def text_to_speech(text, output_file="output.wav"):
    try:
        response = speech_bot1.audio.speech.create(
            model="playai-tts",  
            voice="Atlas-PlayAI", 
            response_format="wav",
            input=text
        )
        response.write_to_file(output_file)
        print(f"Audio saved as {output_file}")
        play_audio(output_file)
    except Exception as e:
        print(f"Error generating TTS: {e}")
        try:
            response = speech_bot1.audio.speech.create(
                    model="playai-tts",  
                    voice="Atlas-PlayAI", 
                    response_format="wav",
                    input=text
            )
            response.write_to_file(output_file)
            print(f"Audio saved as {output_file}")
            play_audio(output_file)
        except Exception as e:
            print(f"Error generating TTS: {e}")
            

def play_audio(output_file):
    try:
        subprocess.run(["afplay", output_file], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error playing audio: {e}")

if __name__ == "__main__":
    text_to_speech("Hello, my name is Dipesh and today I am talking to my interviewer. Hello sir, it's nice to meet you. Thank you.")