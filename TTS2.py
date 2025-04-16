from kokoro import KPipeline
from IPython.display import display, Audio
import soundfile as sf
import torch
import subprocess

text = '''
    Let me know if you'd like a ready-made Dockerfile or requirements.txt tailored to your current project (e.g., with mediapipe, kfp, etc.) to keep everything stable.
    '''
    
def text_to_speech1(text):
    pipeline = KPipeline(lang_code='a')
    generator = pipeline(text, voice='am_adam')
    for i, (gs, ps, audio) in enumerate(generator):
        print(i, gs, ps)
        display(Audio(data=audio, rate=24000, autoplay=i==0))
        sf.write('out.wav', audio, 24000)
        play_audio('out.wav')
        
def play_audio(output_file):
    try:
        subprocess.run(["afplay", output_file], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error playing audio: {e}")
        
