import os
import re

def fix_file(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        c = f.read()
    
    # Fix corrupted emoji sequences back to original characters
    # This is a heuristic fix for the most common garbled UTF-8
    c = re.sub(r'ðŸ“', '📝', c)
    c = re.sub(r'ðŸŽ™', '🎙️', c)
    c = re.sub(r'ðŸŽ🎙', '🎙️', c)
    c = re.sub(r'ðŸ“📹', '📹', c)
    c = re.sub(r'ðŸ§', '🧠', c)
    c = re.sub(r'ðŸš€', '🚀', c)
    c = re.sub(r'ðŸ“📚', '📚', c)
    c = re.sub(r'ðŸ🃏', '🃏', c)
    c = re.sub(r'ðŸ📊', '📊', c)
    c = re.sub(r'ðŸŽ🎯', '🎯', c)
    c = re.sub(r'ðŸ📋', '📋', c)
    c = re.sub(r'ðŸ”', '🔍', c)
    
    # Fix the broken JS function call syntax if it happened
    c = re.sub(r'switchTab\(\\"(.*?)\\"\)', r"switchTab('\1')", c)
    c = re.sub(r'switchTab\(\\\\\"(.*?)\\\\\"\)', r"switchTab('\1')", c)
    
    # Fix the broken logo sub
    c = c.replace('AI A INTERVIEW A MASTERY', 'AI • INTERVIEW • CRACK')
    c = c.replace('CrackInterviewAI AI', 'CrackInterviewAI')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

files = ['index.html', 'app.js', 'features.js', 'styles.css', 'career-ops.js']
for f in files:
    if os.path.exists(f):
        fix_file(f)

print("Restoration complete.")
