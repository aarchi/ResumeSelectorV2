import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private baseUrl = 'http://localhost:5001';

  constructor(private http: HttpClient) {}

  extractTextFromPDF(file: File, candidateNames: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('candidateNames', candidateNames.trim());

    return this.http.post(`${this.baseUrl}/extract_text`, formData);
  }
}
