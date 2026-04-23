# DevPrep – Complete Coding Interview Tracker

DevPrep is a full-stack web application designed to help developers systematically track, analyze, and improve their preparation for coding interviews across multiple domains.

---

## What is DevPrep?

DevPrep is not limited to frontend questions. It is a **unified tracker** for:

* Data Structures & Algorithms (DSA)
* Frontend Development
* Backend Development
* System Design
* Core CS subjects (DBMS, OS, etc.)

It helps you organize your preparation, identify weak areas, and stay consistent.

---

##  Features

### Question Management

* Add coding/interview questions from any platform (LeetCode, GFG, etc.)
* Categorize by:

  * Topic (Arrays, Graphs, React, APIs, etc.)
  * Domain (DSA / Frontend / Backend / Core CS)
* Status tracking:

  * Solved
  * Unsolved
  * Revising
* Difficulty levels: Easy / Medium / Hard
* Notes for each question

---

### Smart Analytics

* **Weak Topic Detection**

  * Automatically highlights topics with low accuracy
* **Progress Tracking**

  * Total questions solved
  * Topic-wise performance
* **Preparation Insights**

  * Identify neglected areas
  * Improve consistency

---

### Authentication

* User registration & login
* Secure session handling using JWT

---

##  Tech Stack

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* FastAPI
* SQLAlchemy
* SQLite

### Authentication

* JWT (JSON Web Tokens)

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repository

```bash
git clone https://github.com/yourusername/devprep.git
cd devprep
```

---

### 2️⃣ Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

---

### 3️⃣ Frontend

Open directly in browser:

```bash
frontend/index.html
```

---

## API Endpoints

| Method | Endpoint     | Description           |
| ------ | ------------ | --------------------- |
| POST   | /register    | Register user         |
| POST   | /login       | Login user            |
| POST   | /add         | Add question          |
| GET    | /questions   | Get user questions    |
| DELETE | /delete/{id} | Delete question       |
| GET    | /analytics   | Get performance stats |

---

## Example Use Cases

* Track DSA problems for coding interviews
* Manage frontend/backend interview questions
* Monitor weak areas like Graphs, DP, or APIs
* Maintain notes for revision

---

## Future Improvements

* Visual charts (graphs & progress bars)
* Spaced repetition system
* AI-based recommendations
* Tag-based filtering
* Markdown preview for notes

---

## Contributing

Contributions are welcome. Open an issue before making major changes.

---

## License

MIT License