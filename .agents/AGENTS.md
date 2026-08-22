# Project Rules for Cashpot2

- Agentul are responsabilitatea de a rula și de a reporni serverul (ex: `python3 server.py`) de fiecare dată când se fac modificări pe fișierele backend (ex: `server.py`). 
- **Nu-i cere utilizatorului să repornească serverul manual.** Agentul trebuie să găsească procesul curent, să îi dea kill și să îl repornească pe background (`manage_task` sau `run_command`).
