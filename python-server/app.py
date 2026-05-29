from flask import Flask, request, jsonify
from flask_cors import CORS
from PyPDF2 import PdfReader
import docx2txt
import tempfile
import os
import re

app = Flask(__name__)
CORS(app)


SECTION_HEADERS = {
    "summary": [
        "summary", "profile summary", "professional summary", "career summary",
        "executive summary", "personal summary", "candidate summary",
        "overview", "professional overview", "career overview",
        "profile", "about", "about me", "objective", "career objective",
        "professional objective", "employment objective", "introduction",
        "synopsis", "professional synopsis"
    ],
    "experience": [
        "experience", "work experience", "professional experience",
        "employment history", "employment experience", "career history",
        "work history", "relevant experience", "professional background",
        "work background", "career profile", "employment profile",
        "professional career", "work profile", "career experience",
        "industry experience", "previous experience", "experience summary",
        "roles and responsibilities", "responsibilities", "job responsibilities",
        "employment details", "work details", "professional details"
    ],
    "skills": [
        "skills", "key skills", "technical skills", "core skills",
        "primary skills", "secondary skills", "skill set", "skillset",
        "core competencies", "competencies", "professional skills",
        "functional skills", "domain skills", "technical competencies",
        "technical expertise", "technical proficiencies", "technical strengths",
        "areas of expertise", "expertise", "technologies", "technology stack",
        "tech stack", "tools and technologies", "tools & technologies",
        "tools", "software skills", "programming skills", "languages and tools",
        "languages & tools", "it skills", "computer skills"
    ],
    "education": [
        "education", "educational details", "education details",
        "academic details", "academics", "academic background",
        "educational background", "academic qualification",
        "academic qualifications", "educational qualification",
        "educational qualifications", "education qualification",
        "qualifications", "qualification", "degree", "degrees",
        "scholastic record", "academic record", "educational record"
    ],
    "certifications": [
        "certifications", "certification", "professional certifications",
        "technical certifications", "licenses", "licences",
        "licenses & certifications", "licences & certifications",
        "courses", "training", "trainings", "professional training",
        "technical training", "workshops", "certified courses",
        "credentials", "accreditations", "badges"
    ],
    "projects": [
        "projects", "project", "project details", "key projects",
        "major projects", "professional projects", "academic projects",
        "client projects", "project experience", "project summary",
        "selected projects", "notable projects", "assignments",
        "case studies", "portfolio", "project portfolio"
    ],
    "profiles": [
        "profiles", "profile links", "profile", "links", "social profiles",
        "online profiles", "web profiles", "professional profiles",
        "linkedin", "github", "gitlab", "bitbucket", "portfolio links",
        "websites", "website", "blog", "blogs", "personal website",
        "online presence"
    ],
    "contact": [
        "contact", "contact details", "contact information",
        "personal details", "personal information", "basic details",
        "candidate details", "applicant details", "personal profile",
        "address", "communication address", "current address",
        "permanent address", "email", "phone", "mobile", "mobile number"
    ],
    "achievements": [
        "achievements", "accomplishments", "awards", "honors", "honours",
        "recognitions", "recognition", "awards and achievements",
        "achievements and awards", "key achievements", "career achievements",
        "professional achievements", "notable achievements", "highlights",
        "career highlights"
    ],
    "languages": [
        "languages", "language", "language proficiency", "languages known",
        "known languages", "linguistic skills"
    ],
    "interests": [
        "interests", "hobbies", "hobbies and interests", "personal interests",
        "activities", "extra curricular", "extracurricular",
        "extra-curricular activities"
    ],
    "publications": [
        "publications", "publication", "papers", "research papers",
        "research", "articles", "journals", "patents", "whitepapers",
        "white papers"
    ],
    "references": [
        "references", "reference", "professional references", "referees"
    ]
}

ALL_HEADERS = []
for values in SECTION_HEADERS.values():
    ALL_HEADERS.extend(values)


def clean_text(text):
    if not text:
        return ""

    text = text.replace("\xa0", " ")
    text = text.replace("\r", "\n")
    text = re.sub(r'#HRJ#.*?#', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def parse_candidate_names(candidate_names_raw):
    if not candidate_names_raw:
        return []

    names = re.split(r',|\n|;', candidate_names_raw)
    cleaned_names = []

    for name in names:
        name = name.strip()
        name = re.sub(r'\s+', ' ', name)

        if len(name) >= 3:
            cleaned_names.append(name)

    return list(dict.fromkeys(cleaned_names))


def normalize_for_name(value):
    if not value:
        return ""

    value = value.lower()
    value = re.sub(r'[^a-z\s]', ' ', value)
    value = re.sub(r'\s+', ' ', value)

    return value.strip()


def find_matched_candidate_name(text, candidate_names):
    if not text or not candidate_names:
        return None

    normalized_text = normalize_for_name(text)

    full_matches = []
    first_name_matches = []

    for candidate_name in candidate_names:
        normalized_name = normalize_for_name(candidate_name)
        name_parts = normalized_name.split()

        if not name_parts:
            continue

        if len(name_parts) >= 2:
            full_name = " ".join(name_parts)
            first_last = f"{name_parts[0]} {name_parts[-1]}"

            if re.search(r'\b' + re.escape(full_name) + r'\b', normalized_text):
                full_matches.append(candidate_name)
                continue

            if re.search(r'\b' + re.escape(first_last) + r'\b', normalized_text):
                full_matches.append(candidate_name)
                continue

        first_name = name_parts[0]

        if len(first_name) > 2:
            if re.search(r'\b' + re.escape(first_name) + r'\b', normalized_text):
                first_name_matches.append(candidate_name)

    if len(full_matches) == 1:
        return full_matches[0]

    if len(full_matches) > 1:
        return full_matches[0]

    if len(first_name_matches) == 1:
        return first_name_matches[0]

    return None


def mask_single_candidate_name(text, candidate_name):
    if not text or not candidate_name:
        return text

    normalized_name = normalize_for_name(candidate_name)

    if not normalized_name:
        return text

    name_parts = normalized_name.split()

    if not name_parts:
        return text

    patterns = []

    if len(name_parts) >= 2:
        full_name_pattern = r'\s+'.join([re.escape(part) for part in name_parts])
        first_last_pattern = re.escape(name_parts[0]) + r'\s+' + re.escape(name_parts[-1])

        patterns.append(full_name_pattern)
        patterns.append(first_last_pattern)

        if len(name_parts[0]) > 2:
            patterns.append(re.escape(name_parts[0]))

    else:
        if len(name_parts[0]) > 3:
            patterns.append(re.escape(name_parts[0]))

    for pattern in sorted(set(patterns), key=len, reverse=True):
        text = re.sub(
            r'\b' + pattern + r'\b',
            '[NAME_MASKED]',
            text,
            flags=re.IGNORECASE
        )

    return text


def mask_candidate_names(text, candidate_names):
    if not text or not candidate_names:
        return text

    for candidate_name in candidate_names:
        text = mask_single_candidate_name(text, candidate_name)

    return text


def mask_contact_section_location(text):
    lines = text.splitlines()
    result = []

    inside_contact = False

    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()

        if lower in SECTION_HEADERS["contact"]:
            inside_contact = True
            result.append(line)
            continue

        if inside_contact and lower in ALL_HEADERS and lower not in SECTION_HEADERS["contact"]:
            inside_contact = False

        if inside_contact:
            if not stripped:
                result.append(line)
                continue

            if "MASKED" in stripped:
                result.append(line)
                continue

            if re.match(r'^[A-Za-z\s,.-]{4,80}$', stripped):
                result.append("[LOCATION_MASKED]")
                continue

        result.append(line)

    return "\n".join(result)


def mask_personal_details(text, candidate_names=None):
    if not text:
        return text

    text = re.sub(r'#HRJ#.*?#', '', text, flags=re.IGNORECASE | re.DOTALL)

    text = mask_candidate_names(text, candidate_names or [])

    text = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b',
        '[EMAIL_MASKED]',
        text
    )

    text = re.sub(
        r'(?<![A-Za-z0-9])(?:\+91[-\s]?)?[6-9]\d{9}(?![A-Za-z0-9])',
        '[PHONE_MASKED]',
        text
    )

    text = re.sub(
        r'(https?://)?(www\.)?(linkedin\.com|github\.com|gitlab\.com|bitbucket\.org)/[^\s]+',
        '[PROFILE_URL_MASKED]',
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r'(https?://|www\.)[^\s]+',
        '[URL_MASKED]',
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r'\b\d{6}\b',
        '[PINCODE_MASKED]',
        text
    )

    text = mask_contact_section_location(text)

    return text.strip()


def normalize_resume_lines(text):
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line and line not in [".", "-", "•"]]

    normalized = []
    current = ""

    for line in lines:
        lower = line.lower().strip()

        if lower in ALL_HEADERS:
            if current:
                normalized.append(current.strip())
                current = ""

            normalized.append(lower.upper())
            continue

        if line.startswith("•") or line.startswith("- "):
            if current:
                normalized.append(current.strip())

            current = line
            continue

        if current.startswith("•") or current.startswith("- "):
            current += " " + line
        else:
            if current:
                normalized.append(current.strip())

            current = line

    if current:
        normalized.append(current.strip())

    return normalized


def get_section_lines(lines, start_keywords, end_keywords):
    start_keywords = [x.lower() for x in start_keywords]
    end_keywords = [x.lower() for x in end_keywords]

    collecting = False
    result = []

    for line in lines:
        lower = line.strip().lower()

        if lower in start_keywords:
            collecting = True
            continue

        if collecting and lower in end_keywords:
            break

        if collecting:
            result.append(line.strip())

    return result


def extract_personal_details(cleaned_text, candidate_names=None):
    email = re.search(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b',
        cleaned_text
    )

    phone = re.search(
        r'(?<![A-Za-z0-9])(?:\+91[-\s]?)?[6-9]\d{9}(?![A-Za-z0-9])',
        cleaned_text
    )

    linkedin = re.search(
        r'(https?://)?(www\.)?linkedin\.com/[^\s]+',
        cleaned_text,
        re.IGNORECASE
    )

    github = re.search(
        r'(https?://)?(www\.)?github\.com/[^\s]+',
        cleaned_text,
        re.IGNORECASE
    )

    return {
        "name": "[NAME_MASKED]" if candidate_names else None,
        "email": "[EMAIL_MASKED]" if email else None,
        "phone": "[PHONE_MASKED]" if phone else None,
        "location": "[LOCATION_MASKED]",
        "linkedin": "[LINKEDIN_MASKED]" if linkedin else None,
        "github": "[GITHUB_MASKED]" if github else None
    }


def extract_total_experience(text):
    patterns = [
        r'(\d+)\+?\s*(years|yrs|year)\s+of\s+experience',
        r'over\s+(\d+)\+?\s*(years|yrs|year)',
        r'(\d+)\+?\s*(years|yrs|year)\s+experience'
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)

        if match:
            return int(match.group(1))

    return None


def extract_summary(lines):
    section = get_section_lines(
        lines,
        SECTION_HEADERS["summary"],
        ALL_HEADERS
    )

    summary = " ".join(section)
    summary = summary.replace("•", "").strip()

    return summary[:1200]


def extract_skills(lines):
    section = get_section_lines(
        lines,
        SECTION_HEADERS["skills"],
        ALL_HEADERS
    )

    skills = []

    for line in section:
        line = line.replace("•", "").replace("- ", "").strip()

        if not line:
            continue

        parts = re.split(r',|\||;', line)

        for part in parts:
            skill = part.strip()

            if skill and len(skill) <= 80:
                skills.append(skill)

    return list(dict.fromkeys(skills))


def split_company_location_duration(line):
    parts = [part.strip() for part in line.split("|")]

    if len(parts) >= 3:
        return {
            "company": parts[0],
            "location": "[LOCATION_MASKED]",
            "duration": " | ".join(parts[2:]),
            "raw_header": line
        }

    return None


def is_experience_header(line):
    date_words = (
        "current", "present",
        "jan", "january", "feb", "february", "mar", "march",
        "apr", "april", "may", "jun", "june", "jul", "july",
        "aug", "august", "sep", "sept", "september",
        "oct", "october", "nov", "november", "dec", "december"
    )

    lower = line.lower()

    if "|" in line and any(word in lower for word in date_words):
        return True

    if re.search(
        r'(\d{2}/\d{4}|\d{1,2}/\d{4}|[A-Za-z]{3,9}\s+\d{4}|\d{4})\s*[-–]\s*(current|present|\d{2}/\d{4}|\d{1,2}/\d{4}|[A-Za-z]{3,9}\s+\d{4}|\d{4})',
        line,
        re.IGNORECASE
    ):
        return True

    return False


def extract_experience(lines):
    section = get_section_lines(
        lines,
        SECTION_HEADERS["experience"],
        ALL_HEADERS
    )

    jobs = []
    current_job = None

    for line in section:
        clean_line = line.replace("•", "").strip()

        if not clean_line:
            continue

        if is_experience_header(clean_line):
            if current_job:
                jobs.append(current_job)

            pipe_data = split_company_location_duration(clean_line)

            if pipe_data:
                current_job = {
                    "company": pipe_data["company"],
                    "location": pipe_data["location"],
                    "duration": pipe_data["duration"],
                    "title": "",
                    "responsibilities": []
                }
            else:
                current_job = {
                    "company": "",
                    "location": "",
                    "duration": clean_line,
                    "title": clean_line,
                    "responsibilities": []
                }

            continue

        if current_job:
            current_job["responsibilities"].append(clean_line)

    if current_job:
        jobs.append(current_job)

    return jobs


def extract_education(lines):
    section = get_section_lines(
        lines,
        SECTION_HEADERS["education"],
        ALL_HEADERS
    )

    education = []

    for line in section:
        clean_line = line.strip()

        if clean_line:
            education.append(clean_line)

    return education[:12]


def extract_certifications(lines):
    section = get_section_lines(
        lines,
        SECTION_HEADERS["certifications"],
        ALL_HEADERS
    )

    certifications = []

    for line in section:
        clean_line = line.replace("•", "").replace("- ", "").strip()

        if clean_line:
            certifications.append(clean_line)

    return certifications[:20]


def extract_projects(lines):
    section = get_section_lines(
        lines,
        SECTION_HEADERS["projects"],
        ALL_HEADERS
    )

    projects = []

    for line in section:
        clean_line = line.replace("•", "").replace("- ", "").strip()

        if clean_line:
            projects.append(clean_line)

    return projects[:20]


def calculate_parser_confidence(structured_resume, candidate_names=None, matched_candidate_name=None):
    return {
        "name_masked": bool(candidate_names),
        "candidate_name_matched": bool(matched_candidate_name),
        "summary_found": bool(structured_resume.get("summary")),
        "skills_found": bool(structured_resume.get("skills")),
        "experience_found": bool(structured_resume.get("experience")),
        "education_found": bool(structured_resume.get("education")),
        "certifications_found": bool(structured_resume.get("certifications")),
        "projects_found": bool(structured_resume.get("projects"))
    }


def build_structured_resume(raw_text, candidate_names=None):
    cleaned_text = clean_text(raw_text)

    matched_candidate_name = find_matched_candidate_name(cleaned_text, candidate_names or [])
    masked_text = mask_personal_details(cleaned_text, candidate_names)

    normalized_lines = normalize_resume_lines(masked_text)

    structured_resume = {
        "candidate": extract_personal_details(cleaned_text, candidate_names),
        "total_experience_years": extract_total_experience(cleaned_text),
        "summary": extract_summary(normalized_lines),
        "skills": extract_skills(normalized_lines),
        "experience": extract_experience(normalized_lines),
        "education": extract_education(normalized_lines),
        "certifications": extract_certifications(normalized_lines),
        "projects": extract_projects(normalized_lines)
    }

    return {
        "matched_candidate_name": matched_candidate_name,
        "candidate_match_status": "MATCHED" if matched_candidate_name else "NOT_MATCHED",
        "structured_resume": structured_resume,
        "parser_confidence": calculate_parser_confidence(
            structured_resume,
            candidate_names,
            matched_candidate_name
        ),
        "masked_text": masked_text
    }


def extract_text_from_file(file, filename):
    text = ""

    if filename.endswith(".pdf"):
        pdf_reader = PdfReader(file)

        for page in pdf_reader.pages:
            page_text = page.extract_text()

            if page_text:
                text += page_text + "\n"

    elif filename.endswith((".docx", ".doc")):
        suffix = os.path.splitext(filename)[1]

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name

        text = docx2txt.process(temp_path)

        os.remove(temp_path)

    elif filename.endswith(".txt"):
        text = file.read().decode("utf-8", errors="ignore")

    else:
        raise ValueError("Unsupported file format")

    return text


@app.route("/extract_text", methods=["POST"])
@app.route("/parse_resume", methods=["POST"])
def extract_text():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        candidate_names_raw = request.form.get("candidateNames", "").strip()
        candidate_names = parse_candidate_names(candidate_names_raw)

        if not candidate_names:
            return jsonify({"error": "Candidate names are required"}), 400

        file = request.files["file"]
        filename = file.filename.lower()

        raw_text = extract_text_from_file(file, filename)
        result = build_structured_resume(raw_text, candidate_names)

        return jsonify(result), 200

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400

    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(port=5001, debug=True)
