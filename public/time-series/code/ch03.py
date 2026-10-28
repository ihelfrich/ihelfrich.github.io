"""Lecture 3: executable entry point. See course.py for the complete implementation.

Run from the code folder of time-series-labs.zip, which also holds course files and data.
Python: uv sync --locked, then uv run python ch03.py
"""
from course import run
if __name__ == "__main__":
    run(3, "results/ch03-python.csv")
