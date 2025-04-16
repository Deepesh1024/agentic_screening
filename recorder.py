import pyaudio
import wave
import threading
import sys

def record_audio(audio_filename="output.wav"):
    CHUNK = 1024
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 16000
    stop_flag = threading.Event()

    def audio_recording_thread():
        try:
            p = pyaudio.PyAudio()
            stream = p.open(format=FORMAT,
                            channels=CHANNELS,
                            rate=RATE,
                            input=True,
                            frames_per_buffer=CHUNK)
            frames = []
            print(f"Recording audio to {audio_filename}... Type 'q' and press Enter to stop.")

            while not stop_flag.is_set():
                try:
                    data = stream.read(CHUNK, exception_on_overflow=False)
                    frames.append(data)
                except Exception as e:
                    print(f"Error during recording: {e}")
                    break

        except Exception as e:
            print(f"Failed to initialize audio stream: {e}")
            return

        finally:
            print("Stopping audio recording...")
            try:
                stream.stop_stream()
                stream.close()
                p.terminate()
            except NameError:
                pass

            try:
                with wave.open(audio_filename, 'wb') as wf:
                    wf.setnchannels(CHANNELS)
                    wf.setsampwidth(p.get_sample_size(FORMAT))
                    wf.setframerate(RATE)
                    wf.writeframes(b''.join(frames))
                print(f"Audio saved to {audio_filename}")
            except Exception as e:
                print(f"Error saving audio file: {e}")

    # Start recording in a separate thread
    recording_thread = threading.Thread(target=audio_recording_thread)
    recording_thread.start()

    # Wait for user to type 'q' and press Enter
    while True:
        user_input = input().strip().lower()
        if user_input == 'q':
            stop_flag.set()
            break

    recording_thread.join()

# Example usage
if __name__ == "__main__":
    record_audio("my_recording.wav")