import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import words_lib
for mod in ('words_a', 'words_b', 'words_c'):
    try: __import__(mod)
    except ModuleNotFoundError as e:
        if e.name != mod: raise
words_lib.run()
