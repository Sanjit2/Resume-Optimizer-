import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import docx # python-docx

# --- PyMuPDF (fitz) Import Handling ---
# We'll try importing fitz, but add a fallback/warning if it fails
try:
    import fitz # PyMuPDF
    print("PyMuPDF (fitz) imported successfully.")
except ImportError as e:
    print(f"Warning: Could not import fitz (PyMuPDF). PDF parsing will not work. Error: {e}")
    fitz = None # Set fitz to None if import fails

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploadresume'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def extract_text_from_pdf(pdf_path):
    """
    Extracts text from a PDF file using PyMuPDF.
    Requires PyMuPDF (fitz) to be installed and imported successfully.
    """
    if fitz is None:
        return None, "PyMuPDF library is not available for PDF parsing."

    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            text += page.get_text()
        doc.close()
        return text, None
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return None, f"Error extracting text from PDF: {e}"

def extract_text_from_docx(docx_path):
    """
    Extracts text from a DOCX file using python-docx.
    """
    text = ""
    try:
        doc = docx.Document(docx_path)
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text, None
    except Exception as e:
        print(f"Error extracting text from DOCX: {e}")
        return None, f"Error extracting text from DOCX: {e}"

@app.route('/parse_document', methods=['POST'])
def parse_document():
    """
    API endpoint to receive a file, parse its text, and return it.
    Supports PDF, DOCX, and TXT files.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        filename = file.filename
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath) # Save the uploaded file temporarily

        extracted_text = None
        error_message = None

        if filename.lower().endswith('.pdf'):
            extracted_text, error_message = extract_text_from_pdf(filepath)
        elif filename.lower().endswith('.docx'):
            extracted_text, error_message = extract_text_from_docx(filepath)
        elif filename.lower().endswith('.txt'):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    extracted_text = f.read()
            except Exception as e:
                error_message = f"Error reading TXT file: {e}"
        else:
            os.remove(filepath) # Clean up unsupported file
            return jsonify({'error': 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.'}), 400

        os.remove(filepath) # Clean up the temporary file after processing

        if extracted_text:
            return jsonify({'parsedText': extracted_text}), 200
        else:
            return jsonify({'error': error_message or 'Failed to extract text from the document. The file might be corrupted or in an unsupported format.'}), 500

    return jsonify({'error': 'An unexpected error occurred.'}), 500

if __name__ == '__main__':
    # Run the Flask app
    # In a production environment, you would use a WSGI server like Gunicorn
    app.run(debug=True, port=5000)
