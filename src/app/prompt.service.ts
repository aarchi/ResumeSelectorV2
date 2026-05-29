import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PromptService {
  buildSingleResumePrompt(
    payload: any,
    jobDescription: string,
    minExperience: number,
    maxExperience: number,
    mandatorySkill: string,
    optionalSkill: string
  ): string {
    return `
You are a strict resume scoring calculator.

Evaluate ONLY this one resume.
Do not compare with any other resume.
Do not use candidate name or personal details.

INPUTS:
Job Description:
${jobDescription || 'Not provided'}

Minimum Experience: ${minExperience}
Maximum Experience: ${maxExperience}
Mandatory Skills: ${mandatorySkill}
Optional Skills: ${optionalSkill || 'Not specified'}

Resume JSON:
${payload.resumeJson}

IMPORTANT:
You must calculate all scores from the resume JSON.
Do not copy placeholder values.
Do not return default zero values unless calculation genuinely results in zero.
Do not invent skills, experience, certifications, or domain.
If a skill is present in skills, summary, experience, or responsibilities, treat it as present.

Mandatory skills may appear with close equivalents:
- Java can appear as Core Java, Java streams, Java Spring MVC, Java backend.
- SpringBoot can appear as Spring Boot, Spring, Spring MVC, Spring Core, Java Spring MVC.
- REST API can appear as REST APIs, REST API development, API development.

SCORING FORMULA = 100 POINTS

1. mandatorySkillsScore = 30
- 30: all mandatory skills or close equivalents are clearly present.
- 20: most mandatory skills are present but one is weak or ambiguous.
- 10: only one mandatory skill or close equivalent is present.
- 0: no mandatory skill is present.

2. realUsageScore = 25
- 25: mandatory skills are clearly used in experience/responsibilities with action evidence.
- 18: usage evidence exists but is not very detailed.
- 10: mandatory skills mostly appear only in skills/summary.
- 0: no usage evidence for mandatory skills.
Action evidence includes developed, implemented, designed, integrated, migrated, maintained, automated, supported, monitored, deployed, optimized, configured, troubleshot, enhanced, owned, engineered.

3. experienceScore = 15
- 15: total_experience_years is between ${minExperience} and ${maxExperience}, inclusive.
- 12: experience is 1 year outside range.
- 9: experience is 2 years outside range.
- 5: experience is 3 to 5 years outside range.
- 0: experience is missing or more than 5 years outside range.
Experience scoring is independent of mandatory skill score.

4. domainScore = 10
- 10: domain/responsibilities strongly match JD or mandatory skill role context.
- 7: partially relevant domain/context.
- 4: generic but somewhat related.
- 0: unrelated.

5. responsibilityScore = 10
- 10: responsibilities strongly support mandatory skills or target role.
- 7: partially support mandatory skills.
- 4: generic but somewhat relevant.
- 0: unrelated.
Do not require a separate project section.

6. stabilityScore = 5
Calculate stability using:
stabilityRatio = total_experience_years / number_of_distinct_companies

Rules:
- Count distinct employers/companies from experience section.
- Do not count internal role changes within same company as job switches.
- Do not penalize vendor-client format like "Accenture - UBS"; treat employer as Accenture unless clearly separate employment.

Scoring:
- 5: total_experience_years >= 8 and number_of_distinct_companies <= 3
- 5: stabilityRatio >= 3.0 years per company
- 4: stabilityRatio >= 2.0 and < 3.0
- 3: stabilityRatio >= 1.5 and < 2.0
- 2: stabilityRatio >= 1.0 and < 1.5
- 0: stabilityRatio < 1.0 or frequent short switches

Career stability text must mention:
- total experience
- number of companies
- stabilityRatio
- final interpretation

7. certificationScore = 5
- 5: relevant certification or relevant degree/training exists.
- 3: education exists but certification relevance is unclear.
- 0: no useful education/certification evidence.

rawScore = sum of all component scores.

CAPS:
Apply caps after rawScore.
- If mandatorySkillsScore = 0, score = min(rawScore, 35), capApplied = true.
- Else if realUsageScore <= 10, score = min(rawScore, 60), capApplied = true.
- Else if mandatory skills are unrelated to responsibilities, score = min(rawScore, 50), capApplied = true.
- Else if experienceScore = 0, score = min(rawScore, 60), capApplied = true.
- Else score = rawScore, capApplied = false.

Do not apply any generic resume cap.
Do not cap because project details are missing.
Do not cap because resume is short or one-page.

RECOMMENDATION:
- 85 to 100: Strong Match
- 70 to 84: Good Match
- 55 to 69: Hold
- 40 to 54: Weak Match
- 0 to 39: Reject

DECISION:
- Strong Match or Good Match = Proceed
- Hold = Hold
- Weak Match or Reject = Reject

Return ONLY one valid JSON object.
No markdown.
No explanation outside JSON.

Required JSON fields:
resumeNumber,
rawScore,
score,
capApplied,
capReason,
recommendation,
decision,
mandatorySkillsScore,
realUsageScore,
experienceScore,
domainScore,
responsibilityScore,
stabilityScore,
certificationScore,
matchingSkills,
missingSkills,
optionalSkillsMatched,
optionalSkillsMissing,
keyStrengths,
risksOrGaps,
careerStability,
shortSummary.

Before returning:
- numeric scores must be calculated.
- rawScore must equal component sum.
- score must follow cap logic.
- matchingSkills must list matched mandatory skills only.
- missingSkills must list missing mandatory skills only.
- careerStability must mention total experience, number of companies, and stabilityRatio.
- shortSummary must be 2-3 lines.
`;
  }
}
