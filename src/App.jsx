import { useState } from 'react';
import FileUploader from './components/FileUploader';
import OpportunityInput from './components/OpportunityInput';
import StatusMessage from './components/StatusMessage';
import { extractTextFromPDF } from './services/pdfParser';
import { extractHeader, extractLineItems, extractBaseProductCode } from './services/dataExtractor';
import { transformData } from './services/dataTransformer';
import { generateCSV, generateFilename, downloadCSV } from './services/csvGenerator';

function App() {
  const [file, setFile] = useState(null);
  const [opportunityId, setOpportunityId] = useState('');
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');

  const isFormValid = file && opportunityId.length === 18;

  const handleConvert = async () => {
    if (!isFormValid) return;

    setStatus('processing');
    setMessage('Parsing PDF...');

    try {
      // Step 1: Extract text from PDF
      const pdfText = await extractTextFromPDF(file);
      console.log('Extracted PDF text:', pdfText.substring(0, 500));

      // Step 2: Extract structured data
      setMessage('Extracting data...');
      const header = extractHeader(pdfText);
      const lineItems = extractLineItems(pdfText);
      const baseProductCode = extractBaseProductCode(pdfText);

      console.log('Header:', header);
      console.log('Line items:', lineItems);
      console.log('Base product code:', baseProductCode);

      if (lineItems.length === 0) {
        throw new Error('No line items found in PDF. Please check the PDF format.');
      }

      // Step 3: Transform data with business logic
      setMessage('Applying business rules...');
      const rows = transformData(header, lineItems, opportunityId, baseProductCode);

      console.log('Transformed rows:', rows);

      // Step 4: Generate CSV
      setMessage('Generating CSV...');
      const csvContent = generateCSV(rows);
      const filename = generateFilename(header.quoteNumber || 'unknown');

      // Step 5: Download
      downloadCSV(csvContent, filename);

      setStatus('success');
      setMessage(`Successfully converted! Downloaded ${filename} with ${rows.length} rows.`);

    } catch (error) {
      console.error('Conversion error:', error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleReset = () => {
    setFile(null);
    setOpportunityId('');
    setStatus(null);
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header / Navigation */}
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="https://www.vdura.com/wp-content/uploads/2025/10/vdura-wordmark.svg"
              alt="VDURA"
              className="h-8"
            />
            <span className="text-sm text-gray-400 font-light tracking-wide">
              Velocity &bull; Durability
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Quotation to CSV Converter
          </h1>
          <p className="text-gray-600">
            Convert VDURA quotation PDFs to CSV format for import into your systems.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-8">
            <div className="space-y-8">
              {/* File Uploader */}
              <FileUploader file={file} onFileSelect={setFile} />

              {/* Opportunity ID Input */}
              <OpportunityInput
                value={opportunityId}
                onChange={setOpportunityId}
              />

              {/* Status Message */}
              {status && (
                <StatusMessage status={status} message={message} />
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  onClick={handleConvert}
                  disabled={!isFormValid || status === 'processing'}
                  className={`
                    flex-1 py-3 px-6 rounded-md font-medium text-white
                    transition-all duration-200
                    ${isFormValid && status !== 'processing'
                      ? 'bg-[#0066cc] hover:bg-[#0052a3] active:bg-[#004080]'
                      : 'bg-gray-300 cursor-not-allowed'
                    }
                  `}
                >
                  {status === 'processing' ? 'Converting...' : 'Convert to CSV'}
                </button>

                {(file || opportunityId || status) && (
                  <button
                    onClick={handleReset}
                    className="py-3 px-6 rounded-md font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-300"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <div className="flex gap-4">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Privacy First</h3>
              <p className="text-sm text-gray-600">
                All processing happens locally in your browser. No data is sent to any server.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Instant Conversion</h3>
              <p className="text-sm text-gray-600">
                Upload your PDF and get a formatted CSV ready for import in seconds.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <p className="text-sm text-gray-500 text-center">
            VDURA Quote2CSV &bull; Internal Tool
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
