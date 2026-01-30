import * as pdfjsLib from 'pdfjs-dist';

// Use the worker from CDN with the exact version installed
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

/**
 * Extract text content from a PDF file
 * @param {File} file - The PDF file to parse
 * @returns {Promise<string>} - The extracted text content
 */
export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Extract text items and join them
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ');

    fullText += pageText + '\n';
  }

  return fullText;
}
