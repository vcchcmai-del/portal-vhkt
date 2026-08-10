"""Single-process production launcher for CNCT HCM Portal."""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        reload=False,
        log_level=os.getenv("LOG_LEVEL", "info"),
    )
