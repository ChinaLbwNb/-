const fs = require('fs');
const path = require('path');

async function testPdfParse() {
  const pdfPath = path.join(__dirname, 'test', '杨鑫宇.pdf');
  
  console.log('测试文件:', pdfPath);
  console.log('文件存在:', fs.existsSync(pdfPath));
  
  // 方法1: 使用 pdf-parse
  console.log('\n=== 方法1: pdf-parse ===');
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    console.log('PDF页数:', pdfData.numpages);
    console.log('PDF文本长度:', pdfData.text?.length || 0);
    console.log('PDF文本内容预览:');
    console.log(pdfData.text?.substring(0, 1000) || '(空)');
  } catch (error) {
    console.error('pdf-parse 失败:', error.message);
    console.error(error.stack);
  }
  
  // 方法2: 使用 pdf.js (pdfjs-dist)
  console.log('\n=== 方法2: pdf.js (pdfjs-dist) ===');
  try {
    const pdfjsLib = require('pdfjs-dist');
    const dataBuffer = fs.readFileSync(pdfPath);
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(dataBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });
    
    const pdfDocument = await loadingTask.promise;
    console.log('PDF页数:', pdfDocument.numPages);
    
    let fullText = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    console.log('PDF文本长度:', fullText.length);
    console.log('PDF文本内容预览:');
    console.log(fullText.substring(0, 1000) || '(空)');
  } catch (error) {
    console.error('pdf.js 失败:', error.message);
    console.error(error.stack);
  }
}

testPdfParse().catch(console.error);
