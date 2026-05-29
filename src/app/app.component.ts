import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { PdfService } from './pdf.service';
import { PromptService } from './prompt.service';

interface ResumeCandidateMap {
  originalIndex: number;
  resumeNumber: number;
  fileName: string;
  matchedCandidateName: string;
  matchStatus: string;
  parseStatus: 'MATCHED' | 'NOT_MATCHED' | 'PARSING' | 'FAILED';
  errorMessage?: string;
}

interface ParsedResumePayload {
  resumeNumber: number;
  originalIndex: number;
  fileName: string;
  candidateName: string;
  resumeJson: string;
  structuredResume: any;
}

interface AiResumeResult {
  resumeNumber: number;
  candidateName?: string;
  status?: 'DONE' | 'FAILED';

  rawScore: number;
  score: number;
  capApplied: boolean;
  capReason: string;

  recommendation: string;
  decision: string;

  mandatorySkillsScore: number;
  realUsageScore: number;
  experienceScore: number;
  domainScore: number;
  responsibilityScore: number;
  stabilityScore: number;
  certificationScore: number;

  matchingSkills: string[];
  missingSkills: string[];
  optionalSkillsMatched: string[];
  optionalSkillsMissing: string[];

  keyStrengths: string[];
  risksOrGaps: string[];
  careerStability: string;
  shortSummary: string;
  expanded?: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'ResumeSelection';

  readonly maxResumeUploadLimit = 10;
  readonly apiKeyStorageKey = 'resume_shortlister_openai_api_key';

  resumeFiles: File[] = [];
  fileContents: string[] = [];
  resumeCandidateMap: ResumeCandidateMap[] = [];
  parsedResumePayloads: ParsedResumePayload[] = [];

  chatGptResponse: any;
  parsedAiResults: AiResumeResult[] = [];

  errorMessage: string | null = null;
  successMessage: string | null = null;
  candidateNameError: string | null = null;

  jobDescription = '';
  apiKey = '';

  minExperience = 0;
  maxExperience = 10;
  mandatorySkill = '';
  optionalSkill = '';
  candidateNames = '';

  loading = false;
  parsing = false;
  fileCountExceeded = false;

  evaluatedCount = 0;
  totalToEvaluate = 0;
  currentEvaluatingCandidate = '';

  constructor(
    private http: HttpClient,
    private pdfService: PdfService,
    private promptService: PromptService
  ) {}

  ngOnInit(): void {
    const savedApiKey = localStorage.getItem(this.apiKeyStorageKey);
    if (savedApiKey) {
      this.apiKey = savedApiKey;
    }
  }

  onApiKeyChanged(): void {
    if (this.apiKey.trim()) {
      localStorage.setItem(this.apiKeyStorageKey, this.apiKey.trim());
    } else {
      localStorage.removeItem(this.apiKeyStorageKey);
    }
  }

  clearSavedApiKey(): void {
    this.apiKey = '';
    localStorage.removeItem(this.apiKeyStorageKey);
  }

  getCandidateNameList(): string[] {
    if (!this.candidateNames.trim()) {
      return [];
    }

    return this.candidateNames
      .split(/,|;|\n/)
      .map(name => name.trim())
      .filter(name => name.length >= 3);
  }

  resetUploadData(message?: string): void {
    const fileInput = document.getElementById('resumeFiles') as HTMLInputElement;

    if (fileInput) {
      fileInput.value = '';
    }

    this.resumeFiles = [];
    this.fileContents = [];
    this.resumeCandidateMap = [];
    this.parsedResumePayloads = [];
    this.fileCountExceeded = false;
    this.successMessage = null;

    if (message) {
      this.errorMessage = message;
    }
  }

  resetAfterAiResponse(): void {
    const fileInput = document.getElementById('resumeFiles') as HTMLInputElement;

    if (fileInput) {
      fileInput.value = '';
    }

    this.candidateNames = '';
    this.candidateNameError = null;
    this.resumeFiles = [];
    this.fileContents = [];
    this.resumeCandidateMap = [];
    this.parsedResumePayloads = [];
    this.fileCountExceeded = false;
    this.currentEvaluatingCandidate = '';
    this.successMessage = 'Evaluation completed. Candidate names and uploaded files have been reset.';
  }

  onCandidateNamesChanged(): void {
    this.candidateNameError = null;
    this.errorMessage = null;
    this.successMessage = null;

    if (this.resumeFiles.length > 0 || this.parsedResumePayloads.length > 0) {
      this.resetUploadData('Candidate names changed. Please upload resumes again.');
    }

    const names = this.getCandidateNameList();

    if (!this.candidateNames.trim()) {
      this.candidateNameError = 'Candidate names are required.';
      return;
    }

    if (names.length === 0) {
      this.candidateNameError = 'Please enter at least one valid candidate name.';
      return;
    }

    const hasOnlySpacesNoSeparator =
      names.length === 1 &&
      this.candidateNames.trim().split(/\s+/).length > 2 &&
      !this.candidateNames.includes(',') &&
      !this.candidateNames.includes(';') &&
      !this.candidateNames.includes('\n');

    if (hasOnlySpacesNoSeparator) {
      this.candidateNameError =
        'Multiple names detected. Please separate candidate names using comma or new line.';
    }
  }

  getFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  getDisplayNameForResume(index: number): string {
    const mapping = this.resumeCandidateMap[index];

    if (!mapping) {
      return 'Waiting...';
    }

    if (mapping.parseStatus === 'PARSING') {
      return 'Matching candidate...';
    }

    if (mapping.parseStatus === 'NOT_MATCHED') {
      return 'Name not found in resume';
    }

    if (mapping.parseStatus === 'FAILED') {
      return 'Parsing failed';
    }

    return mapping.matchedCandidateName || `Unknown Candidate - Resume ${index + 1}`;
  }

  getMatchedResumeCount(): number {
    return this.parsedResumePayloads.length;
  }

  getRejectedResumeCount(): number {
    return this.resumeCandidateMap.filter(item => item.parseStatus === 'NOT_MATCHED').length;
  }

  canSubmit(): boolean {
    return (
      !!this.apiKey.trim() &&
      !!this.candidateNames.trim() &&
      !this.candidateNameError &&
      this.parsedResumePayloads.length > 0 &&
      this.minExperience <= this.maxExperience &&
      !!this.mandatorySkill.trim() &&
      !this.loading &&
      !this.parsing
    );
  }

  onFileSelected(event: any): void {
    this.errorMessage = null;
    this.successMessage = null;
    this.chatGptResponse = null;
    this.parsedAiResults = [];
    this.fileContents = [];
    this.resumeCandidateMap = [];
    this.parsedResumePayloads = [];

    this.onCandidateNamesChanged();

    if (this.candidateNameError) {
      event.target.value = null;
      return;
    }

    const files = event.target.files;

    if (!files || files.length === 0) {
      this.resumeFiles = [];
      return;
    }

    if (files.length > this.maxResumeUploadLimit) {
      this.fileCountExceeded = true;
      this.resumeFiles = [];
      event.target.value = null;
      this.errorMessage = `Please select no more than ${this.maxResumeUploadLimit} resumes.`;
      return;
    }

    const candidateNameList = this.getCandidateNameList();

    if (candidateNameList.length !== files.length) {
      this.errorMessage =
        `Validation failed: You entered ${candidateNameList.length} candidate name(s) but uploaded ${files.length} resume(s). Please keep candidate name count and resume count same.`;
      this.resumeFiles = [];
      event.target.value = null;
      return;
    }

    this.fileCountExceeded = false;
    this.resumeFiles = Array.from(files);
    this.parsing = true;

    let completedRequests = 0;

    this.resumeFiles.forEach((resumeFile, index) => {
      const isSupportedFile =
        resumeFile.type === 'application/pdf' ||
        resumeFile.type === 'application/msword' ||
        resumeFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        resumeFile.type === 'text/plain' ||
        resumeFile.name.toLowerCase().endsWith('.pdf') ||
        resumeFile.name.toLowerCase().endsWith('.doc') ||
        resumeFile.name.toLowerCase().endsWith('.docx') ||
        resumeFile.name.toLowerCase().endsWith('.txt');

      this.resumeCandidateMap[index] = {
        originalIndex: index,
        resumeNumber: index + 1,
        fileName: resumeFile.name,
        matchedCandidateName: '',
        matchStatus: 'PARSING',
        parseStatus: 'PARSING'
      };

      if (!isSupportedFile) {
        this.resumeCandidateMap[index] = {
          ...this.resumeCandidateMap[index],
          matchStatus: 'FAILED',
          parseStatus: 'FAILED',
          errorMessage: 'Unsupported file type.'
        };

        completedRequests++;
        this.checkParsingCompleted(completedRequests);
        return;
      }

      this.pdfService.extractTextFromPDF(resumeFile, this.candidateNames).subscribe(
        (response) => {
          const matchedCandidateName = response.matched_candidate_name || '';
          const matchStatus = response.candidate_match_status || 'UNKNOWN';

          if (matchStatus === 'MATCHED' && matchedCandidateName) {
            const resumeNumberForGpt = this.parsedResumePayloads.length + 1;
            const structuredResume = response.structured_resume || {};
            const resumeData = JSON.stringify(structuredResume, null, 2);

            this.fileContents[index] = resumeData;

            this.resumeCandidateMap[index] = {
              originalIndex: index,
              resumeNumber: resumeNumberForGpt,
              fileName: resumeFile.name,
              matchedCandidateName,
              matchStatus,
              parseStatus: 'MATCHED'
            };

            this.parsedResumePayloads.push({
              resumeNumber: resumeNumberForGpt,
              originalIndex: index,
              fileName: resumeFile.name,
              candidateName: matchedCandidateName,
              resumeJson: resumeData,
              structuredResume
            });
          } else {
            this.resumeCandidateMap[index] = {
              originalIndex: index,
              resumeNumber: index + 1,
              fileName: resumeFile.name,
              matchedCandidateName: '',
              matchStatus: 'NOT_MATCHED',
              parseStatus: 'NOT_MATCHED',
              errorMessage:
                'Candidate name was not found in this resume. Please update the resume with candidate name and upload again.'
            };
          }

          completedRequests++;
          this.checkParsingCompleted(completedRequests);
        },
        (error) => {
          console.error(`Error parsing Resume ${index + 1}:`, error);

          this.resumeCandidateMap[index] = {
            originalIndex: index,
            resumeNumber: index + 1,
            fileName: resumeFile.name,
            matchedCandidateName: '',
            matchStatus: 'FAILED',
            parseStatus: 'FAILED',
            errorMessage: `Error extracting text from Resume ${index + 1}.`
          };

          completedRequests++;
          this.checkParsingCompleted(completedRequests);
        }
      );
    });
  }

  checkParsingCompleted(completedRequests: number): void {
    if (completedRequests !== this.resumeFiles.length) {
      return;
    }

    this.parsing = false;

    if (this.parsedResumePayloads.length === 0) {
      this.errorMessage =
        'No candidate names matched any uploaded resume. Please update the resume with candidate name and upload again. Nothing will be sent to GPT.';
      return;
    }

    const rejectedCount = this.getRejectedResumeCount();

    if (rejectedCount > 0) {
      this.errorMessage =
        `${this.parsedResumePayloads.length} resume(s) matched and will be evaluated. ${rejectedCount} resume(s) were skipped because candidate name was not found in resume.`;
      return;
    }

    this.successMessage =
      `${this.parsedResumePayloads.length} resume(s) parsed successfully. Ready for AI evaluation.`;
  }

  onSubmit(): void {
    this.errorMessage = null;
    this.successMessage = null;
    this.parsedAiResults = [];
    this.evaluatedCount = 0;
    this.totalToEvaluate = this.parsedResumePayloads.length;
    this.currentEvaluatingCandidate = '';

    if (!this.canSubmit()) {
      this.errorMessage = 'Please complete all required fields and ensure at least one resume matched a candidate name.';
      return;
    }

    this.loading = true;
    this.evaluateResumesSequentially(0);
  }

  evaluateResumesSequentially(index: number): void {
    if (index >= this.parsedResumePayloads.length) {
      this.loading = false;
      this.resetAfterAiResponse();
      return;
    }

    const payload = this.parsedResumePayloads[index];
    this.currentEvaluatingCandidate = payload.candidateName;
    const requestString = this.promptService.buildSingleResumePrompt(
      payload,
      this.jobDescription,
      this.minExperience,
      this.maxExperience,
      this.mandatorySkill,
      this.optionalSkill
    );
    this.makeSingleResumeGptRequest(requestString, payload, () => {
      this.evaluatedCount++;
      this.evaluateResumesSequentially(index + 1);
    });
  }

  makeSingleResumeGptRequest(
    requestString: string,
    payload: ParsedResumePayload,
    onComplete: () => void
  ): void {
    const chatGptApiEndpoint = 'https://api.openai.com/v1/chat/completions';

    const chatGptRequest = {
      model: 'gpt-4.1',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a strict JSON scoring calculator. Follow the scoring rules exactly. Return only calculated JSON.'
        },
        {
          role: 'user',
          content: requestString
        }
      ],
      temperature: 0,
      top_p: 0
    };

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    this.http.post(chatGptApiEndpoint, chatGptRequest, { headers }).subscribe(
      (response: any) => {
        this.chatGptResponse = response;
        this.parseSingleAiJsonResponse(response, payload);
        onComplete();
      },
      (errorResponse: HttpErrorResponse) => {
        console.error(`Error evaluating Resume ${payload.resumeNumber}:`, errorResponse);

        this.parsedAiResults.push({
          resumeNumber: payload.resumeNumber,
          candidateName: payload.candidateName,
          status: 'FAILED',
          rawScore: 0,
          score: 0,
          capApplied: true,
          capReason: 'AI evaluation failed.',
          recommendation: 'Reject',
          decision: 'Reject',
          mandatorySkillsScore: 0,
          realUsageScore: 0,
          experienceScore: 0,
          domainScore: 0,
          responsibilityScore: 0,
          stabilityScore: 0,
          certificationScore: 0,
          matchingSkills: [],
          missingSkills: [],
          optionalSkillsMatched: [],
          optionalSkillsMissing: [],
          keyStrengths: [],
          risksOrGaps: ['AI evaluation failed for this resume.'],
          careerStability: 'Not assessed',
          shortSummary: 'AI evaluation failed for this resume.'
        });

        if (errorResponse.status === 429) {
          this.errorMessage = 'Rate limit exceeded. Some resumes may not be evaluated.';
        } else if (errorResponse.status === 401) {
          this.errorMessage = 'Invalid OpenAI API key.';
        } else {
          this.errorMessage = 'An error occurred while communicating with GPT.';
        }

        onComplete();
      }
    );
  }

  parseSingleAiJsonResponse(response: any, payload: ParsedResumePayload): void {
    try {
      const content = response?.choices?.[0]?.message?.content || '';
      const result = JSON.parse(content);

      this.parsedAiResults.push({
        ...result,
        candidateName: payload.candidateName,
        status: 'DONE',
        matchingSkills: result.matchingSkills || [],
        missingSkills: result.missingSkills || [],
        optionalSkillsMatched: result.optionalSkillsMatched || [],
        optionalSkillsMissing: result.optionalSkillsMissing || [],
        keyStrengths: result.keyStrengths || [],
        risksOrGaps: result.risksOrGaps || [],
        capApplied: result.capApplied || false,
        capReason: result.capReason || '',
        rawScore: result.rawScore ?? this.calculateRawScore(result),
        expanded: false
      });
    } catch (error) {
      console.error('Failed to parse AI JSON response:', error);

      this.parsedAiResults.push({
        resumeNumber: payload.resumeNumber,
        candidateName: payload.candidateName,
        status: 'FAILED',
        rawScore: 0,
        score: 0,
        capApplied: true,
        capReason: 'AI response could not be parsed.',
        recommendation: 'Reject',
        decision: 'Reject',
        mandatorySkillsScore: 0,
        realUsageScore: 0,
        experienceScore: 0,
        domainScore: 0,
        responsibilityScore: 0,
        stabilityScore: 0,
        certificationScore: 0,
        matchingSkills: [],
        missingSkills: [],
        optionalSkillsMatched: [],
        optionalSkillsMissing: [],
        keyStrengths: [],
        risksOrGaps: ['AI response could not be parsed.'],
        careerStability: 'Not assessed',
        shortSummary: 'AI response could not be parsed for this resume.',
        expanded: false
      });
    }
  }

  calculateRawScore(result: AiResumeResult): number {
    return (
      (result.mandatorySkillsScore || 0) +
      (result.realUsageScore || 0) +
      (result.experienceScore || 0) +
      (result.domainScore || 0) +
      (result.responsibilityScore || 0) +
      (result.stabilityScore || 0) +
      (result.certificationScore || 0)
    );
  }

  toggleResult(result: AiResumeResult): void {
    result.expanded = !result.expanded;
  }

  getRecommendationClass(recommendation: string): string {
    const value = (recommendation || '').toLowerCase();

    if (value.includes('strong')) {
      return 'strong-match';
    }

    if (value.includes('good')) {
      return 'good-match';
    }

    if (value.includes('hold') || value.includes('pending')) {
      return 'borderline-match';
    }

    if (value.includes('weak')) {
      return 'weak-match';
    }

    return 'reject-match';
  }
}
