@echo off
title Driver Guard
echo.
echo ============================================
echo            DRIVER GUARD
echo ============================================
echo.
python -m pip install -r requirements.txt
echo.
echo Starting dashboard...
echo Open: http://127.0.0.1:5000
echo.
python app.py
pause
