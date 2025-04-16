import os
from groq import Groq
from dotenv import load_dotenv

def groq_chatbot(
    prompt,
    model="meta-llama/llama-4-maverick-17b-128e-instruct",
    system_prompt="You are a comedian and you have to humiliate the person talking to you.",
    temperature=1.0,
    max_tokens=1024,
    top_p=1.0,
    stream=True):
    load_dotenv()
    api_key = os.getenv("GROQ_CHATBOT_API_KEY")
    if not api_key:
        raise ValueError("GROQ_CHATBOT_API_KEY not found in .env file")
    bot = Groq(api_key=api_key)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]
    try:
        completion = bot.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            top_p=top_p,
            stream=stream,
            stop=None
        )
        if stream:
            full_response = ""
            for chunk in completion:
                content = chunk.choices[0].delta.content or ""
                full_response += content
            return full_response
        else:
            return completion.choices[0].message.content

    except Exception as e:
        print(f"Error interacting with Groq API: {e}")
        return None


if __name__ == "__main__":
    prompt = "You are an interviewer and I am a candidate."
    user_prompt = "Hello, my name is Dipesh and today I am talking to my interviewer. Hello sir, it's nice to meet you. Thank you."
    response = groq_chatbot(prompt=user_prompt)
    print(f"\nFull response: {response}")