from recorder import record_audio 
from transcriber import transcribe_audio
from TTS import text_to_speech
from bot import groq_chatbot
from TTS2 import text_to_speech1

while True: 
    record_audio("my_recording.wav")
    transcription_text = transcribe_audio("my_recording.wav")
    print(transcription_text)
    response = groq_chatbot(prompt=transcription_text)
    print(f"Chatbot response: {response}")
    text_to_speech1(response)