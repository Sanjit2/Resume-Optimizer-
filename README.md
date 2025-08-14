#  Resume Optimizer

The **Resume Optimizer** is a smart tool that analyzes and enhances resumes to improve their chances of passing through Applicant Tracking Systems (ATS) and impressing recruiters. It offers personalized feedback, keyword optimization, and actionable suggestions to make your resume stand out.

##  Features

-  **ATS Compatibility Check**  
  Scans your resume for formatting, keywords, and structure issues that may affect parsing by ATS.

- **Keyword Optimization**  
  Compares your resume with job descriptions and recommends industry-relevant keywords to include.

-  **Multiple Format Support**  
  Supports PDF and DOCX uploads for analysis.

-  **AI-Powered Suggestions**  
  Generates feedback on content clarity, action verbs, quantifiable metrics, and skills alignment.

-  **Custom Job Description Matching**  
  Tailors optimization suggestions based on the job description you provide.

##  API Key Setup

> ⚠ Before running the program, you **must insert your Google API Key ** inside `resume-optimizer-frontend/.env` and **your Firbase API Key ** inside `resume-optimizer-frontend/App.js`.

Open the file and update the following variable:
```python
REACT_APP_GEMINI_API_KEY = "YOUR_GOOGLE_API_KEY"
