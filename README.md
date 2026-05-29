# AI Resume Shortlister

The AI Resume Shortlister is a web application built using Angular + Python Flask that enables recruiters and hiring managers to upload resumes and automatically evaluate candidates against hiring criteria using OpenAI GPT-4.1.

The application uses a **fair, skill-first scoring model** that evaluates resumes independently, validates mandatory skills, checks real-world usage evidence, analyzes career stability, and provides structured hiring recommendations while maintaining GDPR-safe masking of personal information.

![Application Screenshot](/images/resumeselector.PNG)

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)

   * [Prerequisites](#prerequisites)
   * [Installation](#installation)
4. [Usage](#usage)
5. [Validation Rules](#validation-rules)
6. [Scoring Logic](#scoring-logic)
7. [Configuration](#configuration)
8. [Future Improvements](#future-improvements)

---

## 1. Features

### Resume Upload & Parsing

* Upload up to **10 resumes at once**
* Supported formats:

  * PDF (`.pdf`)
  * Word (`.doc`, `.docx`)
* Automatic text extraction from resumes
* Structured parsing of:

  * Summary
  * Experience
  * Skills
  * Certifications
  * Education
  * Projects
  * Profiles

### GDPR Safe Resume Screening

Before sending resume data to GPT:

* Candidate Name → Masked
* Phone Number → Masked
* Email ID → Masked
* Address / Location → Masked
* LinkedIn / GitHub URLs → Masked

This helps reduce GDPR/privacy concerns while still allowing accurate candidate screening.

### Smart Resume Matching

Each resume is evaluated independently using a **100-point scoring framework**.

### Sequential Resume Processing

To avoid GPT context mixing and improve consistency:

* Every resume is sent to GPT individually
* Results are shown progressively on UI
* Lower token consumption
* Better scoring accuracy
* Reduced hallucination risk

### Professional Candidate Insights

The application provides:

* Selection Percentage
* Recommendation
* Mandatory Skill Match
* Real Usage Evidence
* Experience Match
* Domain Match
* Responsibility Strength
* Career Stability
* Certifications Impact
* Risks & Gaps
* Hiring Decision Summary

### Professional UI

* Product-style responsive design
* Compact scoring cards
* Progressive resume evaluation status
* Collapsible scoring logic section
* Modern recruiter-friendly layout

---

## 2. Architecture

### High Level Architecture

```text
Angular UI
    |
    | HTTP Request
    v
Flask API (Python Backend)
    |
    ├── Resume Upload Validation
    ├── Resume Text Extraction
    ├── GDPR Masking
    ├── Structured Resume Parsing
    ├── Resume-to-Candidate Matching
    |
    v
Prompt Builder Service
    |
    v
OpenAI GPT-4.1
    |
    v
Structured JSON Score Response
    |
    v
Angular UI (Cards + Hiring Decision)
```

### Request Flow

```text
User Uploads Resume
        |
        v
Resume Parsing
        |
        v
Personal Data Masking
        |
        v
Structured Resume JSON
        |
        v
GPT Evaluation (One Resume at a Time)
        |
        v
Score + Recommendation
        |
        v
Rendered in Professional UI
```

---

## 3. Getting Started

Follow these instructions to run the project locally.

### 3.1 Prerequisites

To run this project, install the following:

### Node.js

Download from:

https://nodejs.org/

### Angular CLI

```bash
npm install -g @angular/cli
```

### Python 3.12+

Download from:

https://www.python.org/downloads/

---

### 3.2 Installation

### 1. Clone the repository

```bash
git clone your-repo-url
```

### 2. Navigate to the project directory

```bash
cd your-repo
```

### 3. Install Angular dependencies

```bash
npm install
```

### 4. Install Python backend dependencies

Navigate to python server folder:

```bash
cd python-server
```

Install required packages:

```bash
pip install flask
pip install flask-cors
pip install PyPDF2
pip install docx2txt
```

Start backend:

```bash
python app.py
```

### 5. Run Angular application

Navigate back to Angular root folder and run:

```bash
ng serve
```

Application will run on:

```text
http://localhost:4200
```

---

## 4. Usage

### Step 1: Enter OpenAI API Key

Enter your OpenAI API key.

The key is temporarily saved in browser local storage so that users don't need to enter it repeatedly.

---

### Step 2: Enter Candidate Names

Enter one candidate name per line.

Example:

```text
Bikesh Kumar
Khushboo Bhati
Abir Khan
```

The system automatically matches resumes with names.

---

### Step 3: Upload Resumes

Upload resumes in supported formats:

* PDF
* DOC
* DOCX

Maximum supported:

```text
10 resumes
```

---

### Step 4: Enter Hiring Criteria

Provide:

* Minimum Experience
* Maximum Experience
* Mandatory Skills
* Optional Skills
* Job Description (Optional)

Example:

```text
Mandatory Skills:
Java, Spring Boot

Optional Skills:
Kafka, Microservices
```

---

### Step 5: Click Upload

The system will:

1. Parse resume text
2. Mask personal details
3. Create structured resume JSON
4. Match candidate names
5. Send resumes to GPT individually
6. Calculate score
7. Show structured hiring results

---

## 5. Validation Rules

1. Candidate name count must match uploaded resume count.

2. Each resume is parsed and evaluated separately to avoid GPT context mixing.

3. Candidate names can be entered in any order.

4. Resume upload resets automatically if candidate names are modified.

5. Resume matching happens automatically using extracted resume content.

6. If resume-to-name match fails:

   * Matched resumes are processed
   * Unmatched resumes are skipped
   * User is asked to upload updated resume containing candidate name

7. Maximum supported upload limit:
   **10 resumes**

---

## 6. Scoring Logic

### Total Score = 100 Points

| Criteria                   | Weight |
| -------------------------- | ------ |
| Mandatory Skills Match     | 30%    |
| Real Usage Evidence        | 25%    |
| Experience Match           | 15%    |
| Domain Match               | 10%    |
| Responsibility Strength    | 10%    |
| Career Stability           | 5%     |
| Certifications & Education | 5%     |

### Career Stability Formula

```text
Career Stability = Total Experience / Number of Companies
```

Examples:

* 12 years across 3 companies → Stable
* 8 years across 6 companies → Moderate
* Frequent short switches → Risky

### Recommendation Bands

| Score  | Recommendation |
| ------ | -------------- |
| 85–100 | Strong Match   |
| 70–84  | Good Match     |
| 55–69  | Hold           |
| 40–54  | Weak Match     |
| 0–39   | Reject         |

### Score Protection Rules (Caps)

To avoid keyword stuffing and unfair scoring:

| Condition                                      | Max Score |
| ---------------------------------------------- | --------- |
| Mandatory skills missing                       | 35%       |
| Weak skill usage evidence                      | 60%       |
| Responsibilities unrelated to mandatory skills | 50%       |
| Experience far outside required range          | 60%       |

### Fairness Rules

* One-page resumes are **not penalized**
* Missing project section does **not reduce score**
* Skills are validated against **real experience evidence**
* Generic keyword stuffing is penalized
* Every resume is evaluated independently

---

## 7. Configuration

You need an OpenAI API key.

Create API key here:

https://platform.openai.com/api-keys

Supported AI Model:

```text
GPT-4.1
```

---

## 8. Future Improvements

* Export result to Excel
* ATS compatibility score
* Recruiter dashboard
* Role-based templates
* Bulk JD upload
* Electron Desktop EXE packaging
* Offline AI model support
* Multi-role candidate comparison
