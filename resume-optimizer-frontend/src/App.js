import React, { useState, useEffect } from "react";
// Import Firebase modules directly for local development compatibility
// These imports are crucial for running the app outside the Canvas environment
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Assuming Firestore will be used for persistence later

// Helper component to render AI suggestions as a list
const AiSuggestionsDisplay = ({ suggestions }) => {
  if (!suggestions) return null;

  // Split by lines and filter out empty ones
  const lines = suggestions.split("\n").filter((line) => line.trim() !== "");

  const renderLine = (line) => {
    // Regex to find bolded text like **this** or *this*
    const boldRegex = /\*\*(.*?)\*\*|\*(.*?)\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(line)) !== null) {
      // Push text before the match
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      // Push the bolded text, taking the first non-null capture group
      parts.push(<strong key={lastIndex}>{match[1] || match[2]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }

    // Push any remaining text after the last match
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return parts;
  };

  return (
    <ul className="space-y-3">
      {lines.map((line, index) => {
        // Check for bullet points (*, -, or numbered list like 1.)
        const isListItem = line.match(/^(\s*(\*|-|\d+\.)\s+)/);
        const content = isListItem
          ? line.replace(/^(\s*(\*|-|\d+\.)\s+)/, "")
          : line;

        if (isListItem) {
          return (
            <li key={index} className="flex items-start">
              <svg
                className="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-1"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                ></path>
              </svg>
              <span className="text-slate-700">{renderLine(content)}</span>
            </li>
          );
        } else {
          // It's a regular paragraph or heading, render it with more emphasis
          return (
            <li key={index} className="mt-4 first:mt-0">
              <p className="font-semibold text-lg text-slate-800">
                {renderLine(content)}
              </p>
            </li>
          );
        }
      })}
    </ul>
  );
};

// Main App component
export default function App() {
  // State variables for resume and job description text
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");

  // State variables for keyword comparison results
  const [matchedKeywords, setMatchedKeywords] = useState([]);
  const [missingKeywords, setMissingKeywords] = useState([]);

  // State variables for AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [bulletPointToRewrite, setBulletPointToRewrite] = useState("");
  const [rewrittenBulletPoint, setRewrittenBulletPoint] = useState("");

  // Loading states for API calls
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingRewrite, setIsLoadingRewrite] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingParsing, setIsLoadingParsing] = useState(false); // New loading state for parsing

  // File names for display
  const [resumeFileName, setResumeFileName] = useState("");
  const [jdFileName, setJdFileName] = useState("");

  // Backend URL
  // Make sure this matches your Flask backend URL if you are running it locally
  const BACKEND_URL = "http://127.0.0.1:5000";

  // Firestore state variables
  // These are set in useEffect and can be used for database operations
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);

  // Initialize Firebase and authenticate
  useEffect(() => {
    let app;
    let firestoreDb;
    let firebaseAuth;

    // Determine if the app is running in the Canvas environment
    // Canvas injects global variables like __app_id, __firebase_config, etc.
    const isCanvasEnvironment =
      typeof window !== "undefined" && typeof window.__app_id !== "undefined";

    if (isCanvasEnvironment) {
      // Running in Canvas environment: use the globally provided Firebase
      try {
        const appId = window.__app_id; // Canvas-provided app ID
        const firebaseConfig = JSON.parse(window.__firebase_config); // Canvas-provided Firebase config

        // Initialize Firebase app using the global 'firebase' object
        app = window.firebase.initializeApp(firebaseConfig);
        firestoreDb = window.firebase.firestore.getFirestore(app);
        firebaseAuth = window.firebase.auth.getAuth(app);

        setDb(firestoreDb);
        setAuth(firebaseAuth);

        // Authenticate with custom token provided by Canvas
        const authenticateCanvas = async () => {
          try {
            if (
              window.__initial_auth_token !== "undefined" &&
              window.__initial_auth_token
            ) {
              await window.firebase.auth.signInWithCustomToken(
                firebaseAuth,
                window.__initial_auth_token
              );
            } else {
              await window.firebase.auth.signInAnonymously(firebaseAuth);
            }
            console.log(
              "Firebase initialized and authenticated in Canvas environment."
            );
          } catch (error) {
            console.error("Firebase authentication error (Canvas):", error);
            setErrorMessage(
              "Failed to authenticate with Firebase (Canvas). Some features might not work."
            );
          }
        };
        authenticateCanvas();

        // Listen for auth state changes to get the user ID
        const unsubscribe = window.firebase.auth.onAuthStateChanged(
          firebaseAuth,
          (user) => {
            if (user) {
              setUserId(user.uid);
            } else {
              setUserId(null); // User signed out
            }
          }
        );
        return () => unsubscribe(); // Cleanup function for Canvas environment
      } catch (error) {
        console.error("Firebase initialization error (Canvas):", error);
        setErrorMessage(
          "Failed to initialize Firebase (Canvas). Some features might not work."
        );
      }
    } else {
      // Running in a local development environment: use directly imported Firebase modules
      // IMPORTANT: For local development, replace these placeholder values with your actual Firebase project config.
      // You can get this from your Firebase project settings -> Project settings -> General -> Your apps -> Firebase SDK snippet (Config).
      const localFirebaseConfig = {
        apiKey: "AIzaSyBU_6pOesSKNIZfN_hfV0J43uRn_VCEbrA",
        authDomain: "resume-8a2e3.firebaseapp.com",
        projectId: "resume-8a2e3",
        storageBucket: "resume-8a2e3.firebasestorage.app",
        messagingSenderId: "185514811995",
        appId: "1:185514811995:web:7022106d9767b70ab4157e",
        measurementId: "G-9051J42JJ7",
      };

      try {
        // Initialize Firebase app with local config
        app = initializeApp(localFirebaseConfig);
        firestoreDb = getFirestore(app);
        firebaseAuth = getAuth(app);

        setDb(firestoreDb);
        setAuth(firebaseAuth);

        // For local testing, we'll sign in anonymously
        const authenticateLocal = async () => {
          try {
            await signInAnonymously(firebaseAuth);
            console.log("Signed in anonymously for local development.");
          } catch (error) {
            console.error("Firebase authentication error (Local):", error);
            setErrorMessage(
              "Failed to authenticate with Firebase (Local). Some features might not work."
            );
          }
        };
        authenticateLocal();

        // Listen for auth state changes to get the user ID
        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(null);
          }
        });
        return () => unsubscribe(); // Cleanup function for local environment
      } catch (error) {
        console.error("Firebase initialization error (Local):", error);
        setErrorMessage(
          "Failed to initialize Firebase (Local). Some features might not work."
        );
      }
    }
  }, []); // Empty dependency array ensures this runs once on mount

  // Generic function to handle file upload and parsing
  const handleFileUpload = async (
    event,
    setTextFunction,
    setFileNameFunction
  ) => {
    const file = event.target.files[0];
    if (file) {
      setFileNameFunction(file.name);
      setErrorMessage("");
      setIsLoadingParsing(true); // Set parsing loading state

      // If it's a plain text file, read it directly
      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          setTextFunction(e.target.result);
          setIsLoadingParsing(false);
        };
        reader.readAsText(file);
      } else if (
        file.type === "application/pdf" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        // For PDF/DOCX, send to backend for parsing
        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch(`${BACKEND_URL}/parse_document`, {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (response.ok) {
            setTextFunction(data.parsedText);
          } else {
            setErrorMessage(
              `Error parsing file: ${data.error || "Unknown error"}`
            );
            setTextFunction(""); // Clear text on error
          }
        } catch (error) {
          setErrorMessage(`Network error or backend issue: ${error.message}`);
          setTextFunction(""); // Clear text on error
          console.error("Backend communication error:", error);
        } finally {
          setIsLoadingParsing(false); // Clear parsing loading state
        }
      } else {
        setErrorMessage(
          "Unsupported file type. Please upload a .txt, .pdf, or .docx file."
        );
        setTextFunction(""); // Clear text if file type not supported
        setIsLoadingParsing(false);
      }
    }
  };

  // Function to process text and extract keywords
  const processKeywords = () => {
    if (!resumeText || !jdText) {
      setErrorMessage(
        "Please enter or upload both Resume and Job Description text."
      );
      return;
    }
    setErrorMessage("");

    // Simple tokenization and normalization
    const cleanText = (text) => text.toLowerCase().match(/\b\w+\b/g) || [];

    const resumeWords = new Set(cleanText(resumeText));
    const jdWords = new Set(cleanText(jdText));

    const matches = new Set();
    const missing = new Set();

    jdWords.forEach((word) => {
      if (resumeWords.has(word)) {
        matches.add(word);
      } else {
        missing.add(word);
      }
    });

    setMatchedKeywords(Array.from(matches));
    setMissingKeywords(Array.from(missing));
  };

  // Function to get AI suggestions for gap analysis
  const getAiSuggestions = async () => {
    if (!resumeText || !jdText) {
      setErrorMessage(
        "Please enter or upload both Resume and Job Description text for AI suggestions."
      );
      return;
    }
    setIsLoadingSuggestions(true);
    setErrorMessage("");
    setAiSuggestions("");

    const prompt = `Given the following Resume and Job Description, identify key skills from the Job Description that are missing or weakly represented in the Resume. Also, suggest general improvements for making the resume more impactful.
    
    Resume:
    "${resumeText}"

    Job Description:
    "${jdText}"

    Provide suggestions in a concise, bulleted format.`;

    try {
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY; // Read from environment variable
      if (!apiKey) {
        setErrorMessage(
          "API key is not configured. Please set up your .env file."
        );
        setIsLoadingSuggestions(false);
        return;
      }
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const text = result.candidates[0].content.parts[0].text;
        setAiSuggestions(text);
      } else {
        setErrorMessage(
          "Failed to get AI suggestions: Unexpected API response structure."
        );
        console.error("AI Suggestions API response error:", result);
      }
    } catch (error) {
      setErrorMessage(`Error fetching AI suggestions: ${error.message}`);
      console.error("Error fetching AI suggestions:", error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Function to rewrite a resume bullet point using AI
  const rewriteBulletPoint = async () => {
    if (!bulletPointToRewrite) {
      setErrorMessage("Please enter a bullet point to rewrite.");
      return;
    }
    setIsLoadingRewrite(true);
    setErrorMessage("");
    setRewrittenBulletPoint("");

    const prompt = `Rewrite this resume bullet point to be more impactful, concise, and ATS-friendly, incorporating strong action verbs and quantifiable achievements if applicable. Focus on the impact and results.

    Bullet Point: "${bulletPointToRewrite}"

    Rewritten point:`;

    try {
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY; // Read from environment variable
      if (!apiKey) {
        setErrorMessage(
          "API key is not configured. Please set up your .env file."
        );
        setIsLoadingRewrite(false);
        return;
      }
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const text = result.candidates[0].content.parts[0].text;
        setRewrittenBulletPoint(text.trim());
      } else {
        setErrorMessage(
          "Failed to rewrite bullet point: Unexpected API response structure."
        );
        console.error("Rewrite API response error:", result);
      }
    } catch (error) {
      setErrorMessage(`Error rewriting bullet point: ${error.message}`);
      console.error("Error rewriting bullet point:", error);
    } finally {
      setIsLoadingRewrite(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      <style>
        {`
        body {
          font-family: 'Inter', sans-serif;
        }
        .text-area-scroll {
          height: 250px;
          overflow-y: auto;
        }
        .file-input-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .file-input {
          display: none; /* Hide default file input */
        }
        .file-input-label {
          background-color: #f1f5f9; /* slate-100 */
          color: #475569; /* slate-600 */
          padding: 0.5rem 1rem;
          border-radius: 0.5rem; /* rounded-lg */
          cursor: pointer;
          transition: all 0.3s ease;
          border: 1px solid #cbd5e1; /* slate-300 */
        }
        .file-input-label:hover {
          background-color: #e2e8f0; /* slate-200 */
          border-color: #94a3b8; /* slate-400 */
        }
        `}
      </style>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <header className="w-full max-w-5xl text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-3">
          AI-Powered Resume Optimizer
        </h1>
        <p className="text-lg text-slate-600">
          Get an instant, data-driven analysis to land more interviews.
        </p>
      </header>

      {errorMessage && (
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-4 w-full max-w-5xl"
          role="alert"
        >
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{errorMessage}</span>
        </div>
      )}

      {isLoadingParsing && (
        <div
          className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 px-4 py-3 rounded relative mb-4 w-full max-w-5xl"
          role="status"
        >
          <span className="block sm:inline ml-2">
            Parsing document... Please wait.
          </span>
        </div>
      )}

      <main className="w-full max-w-5xl bg-white shadow-md rounded-2xl p-6 sm:p-8 mb-8">
        <section className="mb-10">
          <h2 className="text-3xl font-semibold text-slate-800 mb-2 flex items-center">
            <span className="bg-indigo-500 text-white rounded-full h-8 w-8 text-lg flex items-center justify-center mr-3">
              1
            </span>
            Your Documents
          </h2>
          <p className="text-slate-600 mb-6">
            Paste or upload your resume and the job description. We support PDF,
            DOCX, and TXT.
          </p>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-8">
            <div>
              <label
                htmlFor="resume-file-upload"
                className="block text-slate-700 text-sm font-bold mb-2"
              >
                Upload Resume:
              </label>
              <div className="file-input-wrapper mb-2">
                <input
                  type="file"
                  id="resume-file-upload"
                  className="file-input"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) =>
                    handleFileUpload(e, setResumeText, setResumeFileName)
                  }
                />
                <label
                  htmlFor="resume-file-upload"
                  className="file-input-label"
                >
                  Choose File
                </label>
                <span className="text-slate-600">
                  {resumeFileName || "No file chosen"}
                </span>
              </div>
              <label
                htmlFor="resume-input"
                className="block text-slate-700 text-sm font-bold mb-2 mt-4"
              >
                Or Paste Resume Text:
              </label>
              <textarea
                id="resume-input"
                className="shadow-sm appearance-none border border-slate-300 rounded-lg w-full py-3 px-4 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 text-area-scroll"
                rows="10"
                placeholder="Paste your resume text here..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              ></textarea>
            </div>
            <div>
              <label
                htmlFor="jd-file-upload"
                className="block text-slate-700 text-sm font-bold mb-2"
              >
                Upload Job Description:
              </label>
              <div className="file-input-wrapper mb-2">
                <input
                  type="file"
                  id="jd-file-upload"
                  className="file-input"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) =>
                    handleFileUpload(e, setJdText, setJdFileName)
                  }
                />
                <label htmlFor="jd-file-upload" className="file-input-label">
                  Choose File
                </label>
                <span className="text-slate-600">
                  {jdFileName || "No file chosen"}
                </span>
              </div>
              <label
                htmlFor="jd-input"
                className="block text-slate-700 text-sm font-bold mb-2 mt-4"
              >
                Or Paste Job Description Text:
              </label>
              <textarea
                id="jd-input"
                className="shadow-sm appearance-none border border-slate-300 rounded-lg w-full py-3 px-4 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 text-area-scroll"
                rows="10"
                placeholder="Paste the job description text here..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              ></textarea>
            </div>
          </div>
          <button
            onClick={processKeywords}
            className="mt-8 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-300 ease-in-out transform hover:-translate-y-1 shadow-lg hover:shadow-xl"
          >
            Analyze Keywords
          </button>
        </section>

        <hr className="my-8 border-slate-200" />

        <section className="mb-10">
          <h2 className="text-3xl font-semibold text-slate-800 mb-6 flex items-center">
            <span className="bg-indigo-500 text-white rounded-full h-8 w-8 text-lg flex items-center justify-center mr-3">
              2
            </span>
            Keyword Comparison
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-green-50 p-5 rounded-xl border border-green-200">
              <h3 className="text-xl font-semibold text-green-800 mb-3 flex items-center">
                <svg
                  className="w-6 h-6 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                Matched Keywords
              </h3>
              {matchedKeywords.length > 0 ? (
                <p className="text-green-800 leading-relaxed">
                  {matchedKeywords.join(", ")}
                </p>
              ) : (
                <p className="text-slate-500">
                  No common keywords found yet. Click 'Analyze Keywords'.
                </p>
              )}
            </div>
            <div className="bg-red-50 p-5 rounded-xl border border-red-200">
              <h3 className="text-xl font-semibold text-red-800 mb-3 flex items-center">
                <svg
                  className="w-6 h-6 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                Missing Keywords (from JD)
              </h3>
              {missingKeywords.length > 0 ? (
                <p className="text-red-800 leading-relaxed">
                  {missingKeywords.join(", ")}
                </p>
              ) : (
                <p className="text-slate-500">
                  No missing keywords found yet. Click 'Analyze Keywords'.
                </p>
              )}
            </div>
          </div>
        </section>

        <hr className="my-8 border-slate-200" />

        <section className="mb-10">
          <h2 className="text-3xl font-semibold text-slate-800 mb-6 flex items-center">
            <span className="bg-indigo-500 text-white rounded-full h-8 w-8 text-lg flex items-center justify-center mr-3">
              3
            </span>
            AI-Powered Suggestions
          </h2>
          <button
            onClick={getAiSuggestions}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg focus:outline-none focus:ring-4 focus:ring-purple-300 transition duration-300 ease-in-out transform hover:-translate-y-1 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoadingSuggestions}
          >
            {isLoadingSuggestions
              ? "Generating Suggestions..."
              : "Get AI Suggestions"}
          </button>

          {aiSuggestions && (
            <div className="mt-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                Suggested Improvements:
              </h3>
              <AiSuggestionsDisplay suggestions={aiSuggestions} />
            </div>
          )}
        </section>

        <hr className="my-8 border-slate-200" />

        <section>
          <h2 className="text-3xl font-semibold text-slate-800 mb-6 flex items-center">
            <span className="bg-indigo-500 text-white rounded-full h-8 w-8 text-lg flex items-center justify-center mr-3">
              4
            </span>
            Rewrite a Bullet Point
          </h2>
          <div className="mb-4">
            <label
              htmlFor="rewrite-input"
              className="block text-slate-700 text-sm font-bold mb-2"
            >
              Bullet point to rewrite:
            </label>
            <textarea
              id="rewrite-input"
              className="shadow-sm appearance-none border border-slate-300 rounded-lg w-full py-3 px-4 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 text-area-scroll"
              rows="3"
              placeholder="e.g., 'Worked on a fraud detection ML model'"
              value={bulletPointToRewrite}
              onChange={(e) => setBulletPointToRewrite(e.target.value)}
            ></textarea>
          </div>
          <button
            onClick={rewriteBulletPoint}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-300 ease-in-out transform hover:-translate-y-1 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoadingRewrite}
          >
            {isLoadingRewrite ? "Rewriting..." : "Rewrite Bullet Point"}
          </button>

          {rewrittenBulletPoint && (
  <div className="mt-6 bg-white p-6 rounded-xl border border-yellow-300 shadow-sm">
    <h3 className="text-2xl font-semibold text-yellow-600 mb-3">
      ✨ Rewritten Bullet Point Suggestions:
    </h3>
    <div className="space-y-2 text-slate-800 leading-normal">
      {rewrittenBulletPoint.split(/\*\*(.*?)\*\*/g).map((chunk, index) => {
        if (index % 2 === 1) {
          return (
            <p
              key={index}
              className="font-semibold text-indigo-600 text-base mt-1"
            >
              {chunk}
            </p>
          );
        } else {
          return chunk.split("\n").map((line, subIndex) => {
            const trimmed = line.trim();
            if (!trimmed) return null;

            if (/^(\*|-|•)\s+/.test(trimmed)) {
              return (
                <ul
                  key={`${index}-${subIndex}`}
                  className="list-disc list-inside pl-4 text-slate-700"
                >
                  <li className="ml-2">{trimmed.replace(/^(\*|-|•)\s+/, "")}</li>
                </ul>
              );
            }

            return (
              <p
                key={`${index}-${subIndex}`}
                className="pl-1 text-slate-700 text-sm"
              >
                {trimmed}
              </p>
            );
          });
        }
      })}
    </div>
  </div>
)}



        </section>
      </main>

      <footer className="w-full max-w-5xl text-center mt-8 text-slate-500 text-sm">
        <p>&copy; 2023 AI-Powered Resume Optimizer. All rights reserved.</p>
        {userId && <p>Your user ID: {userId}</p>}
      </footer>
    </div>
  );
}
