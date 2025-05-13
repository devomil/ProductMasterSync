import uvicorn

if __name__ == "__main__":
    # Run FastAPI with uvicorn server
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)