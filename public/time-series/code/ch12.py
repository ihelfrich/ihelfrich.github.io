"""Lecture 12: executable entry point. See course.py for the complete implementation.

Run from the code folder of time-series-labs.zip, which also holds course files and data.
Python: uv sync --locked, then uv run python ch12.py
"""
from course import run
if __name__ == "__main__":
    run(12, "results/ch12-python.csv")
