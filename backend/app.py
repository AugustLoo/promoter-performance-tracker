"""
Hugging Face Spaces entry point — Free Gradio SDK.

Runs the existing FastAPI app mounted inside a Gradio Blocks interface,
so all existing API endpoints (/api/upload, /api/leaderboard, etc.)
work exactly the same, just served through HF's Gradio runtime.
"""

import gradio as gr
import threading
import sys
import os

# Ensure CLOUD_DEPLOY is set for HF Spaces
os.environ.setdefault("CLOUD_DEPLOY", "true")

# Import the FastAPI app (lazy import so Gradio starts first)
from main import app as fastapi_app

# Create a minimal Gradio Blocks interface
with gr.Blocks(title="Promoter Tracker API") as demo:
    gr.Markdown("# 🏆 Promoter Performance Tracker")
    gr.Markdown("Backend API is running. Use the frontend to upload and track.")

# Mount the FastAPI app on the Gradio server
# This exposes all /api/* routes alongside the Gradio UI
demo.mount_app(fastapi_app, "/")

# HF Spaces expects the app to listen on 0.0.0.0:7860
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    demo.queue()
    demo.launch(
        server_name="0.0.0.0",
        server_port=port,
        show_api=False,
    )
