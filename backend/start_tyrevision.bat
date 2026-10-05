@echo off
cd /d E:\Hiruni\TyreDefectSystem\backend
call E:\Hiruni\TyreDefectSystem\backend\.venv\Scripts\activate.bat
E:\Hiruni\TyreDefectSystem\backend\.venv\Scripts\waitress-serve.exe --host=0.0.0.0 --port=5005 app:app