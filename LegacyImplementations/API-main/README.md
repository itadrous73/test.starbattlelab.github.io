Of course, here is the modified README with the requested changes.

# Star Battle Web App

This is a web-based version of the Star Battle puzzle game with both Python/Flask and JavaScript backend implementations, and a plain HTML/CSS/JS frontend. This project was refactored from an original Pygame application.

## How to Run Locally

You can choose to run either the Python (Flask) or the JavaScript (Node.js) backend. The frontend application connects to the chosen backend.

### 1\. Backend Server Setup

Follow the instructions for the backend of your choice.

-----

#### Python (Flask) Backend

This setup uses a standard Python packaging approach.

**Navigate to the project's ROOT directory (`StarbattlesTools/`).**

First, ensure you have Python 3 installed. Create and activate a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
```

**Install the project in "editable" mode:**
This command reads the `pyproject.toml` file and installs all dependencies.

```bash
pip install -e .
```

*(The `.` refers to the current directory)*

**Run the Python Backend Server:**
Use the provided launcher script to start the server.

```bash
python run.py
```

The backend will now be running at `http://127.0.0.1:5001`. Keep this terminal window open.

-----

#### JavaScript (Node.js) Backend

This setup uses Node.js and npm.

**Navigate to the JavaScript backend directory.**
From the project's ROOT directory (`StarbattlesTools/`), move into the `js_backend` folder.

**Install dependencies:**
First, ensure you have Node.js and npm installed. Then, install the necessary packages.

```bash
npm install
```

**Run the JavaScript Backend Server:**
Start the server using Node.

```bash
node server.js
```

The backend will now be running (e.g., at `http://127.0.0.1:3000`—check the server file for the exact port). Keep this terminal window open.

### 2\. Frontend Application

The frontend is a simple HTML, CSS, and JavaScript application that does not require a dedicated web server.

1.  Navigate to the `frontend` directory in your file explorer.
2.  Open the `index.html` file directly in your web browser (e.g., Chrome, Firefox).
3.  The application will load and connect to the running backend you started in the previous step.