const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database.cjs');
const { authMiddleware } = require('./auth.cjs');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

async function extractTextFromPDF(filePath) {
  try {
    const pdfjsLib = require('pdfjs-dist');
    const dataBuffer = fs.readFileSync(filePath);
    console.log('[Resume] PDF size:', dataBuffer.length, 'bytes');

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(dataBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;
    console.log('[Resume] PDF pages:', pdfDocument.numPages);

    let fullText = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    console.log('[Resume] PDF text length:', fullText.length);
    if (!fullText.trim()) {
      console.log('[Resume] PDF text is empty; OCR fallback has been removed.');
    }

    return fullText;
  } catch (error) {
    console.error('[Resume] PDF parse failed:', error.message);
    console.error('[Resume] Stack:', error.stack);
    return '';
  }
}

async function extractTextFromWord(filePath) {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    console.log('[Resume] Word text length:', result.value?.length || 0);
    return result.value || '';
  } catch (error) {
    console.error('[Resume] Word parse failed:', error.message);
    return '';
  }
}

function parseResumeInfo(content) {
  console.log('[Resume] Start parsing resume, length:', content.length);
  console.log('[Resume] Preview:', content.substring(0, 500));

  const info = {
    name: '',
    education: '',
    skills: [],
    workExperience: [],
    internshipExperience: [],
    projectExperience: [],
    schoolExperience: [],
  };

  if (!content || content.trim().length === 0) {
    console.log('[Resume] Empty content');
    return info;
  }

  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!info.name) {
      const nameMatch = line.match(/姓名\s*[:：]?\s*(.+)/i);
      if (nameMatch) {
        info.name = nameMatch[1].trim();
        continue;
      }
      if (i === 0 && line.length <= 10 && !/[:：]/.test(line)) {
        info.name = line;
        continue;
      }
    }

    if (/学历|学位|毕业院校|学校|院校/.test(line)) {
      const eduMatch = line.match(/[:：]?\s*(.+)/);
      if (eduMatch) {
        info.education = eduMatch[1].trim();
      } else if (line.length > 2) {
        info.education = line;
      }
      continue;
    }

    if (/技能|技术栈|专业技能|掌握|熟练|编程语言|开发工具/.test(line)) {
      currentSection = 'skills';
      const skillMatch = line.match(/[:：]?\s*(.+)/);
      if (skillMatch) {
        info.skills.push(skillMatch[1].trim());
      }
      continue;
    }

    if (/工作经历|工作经验|工作背景|职业经历|从业经历/.test(line)) {
      currentSection = 'workExperience';
      continue;
    }

    if (/实习经历|实习经验|实习/.test(line)) {
      currentSection = 'internshipExperience';
      continue;
    }

    if (/项目经历|项目经验|项目背景|项目描述|项目介绍/.test(line)) {
      currentSection = 'projectExperience';
      continue;
    }

    if (/校内经历|校园经历|社团|学生会|学生工作|校园活动/.test(line)) {
      currentSection = 'schoolExperience';
      continue;
    }

    if (/教育背景|教育经历|自我评价|个人优势|兴趣爱好|联系方式|基本信息/.test(line)) {
      currentSection = '';
      continue;
    }

    if (currentSection === 'skills' && line.length > 2) {
      const skillItems = line.split(/[,，、；;]/).map((item) => item.trim()).filter(Boolean);
      info.skills.push(...skillItems);
    } else if (currentSection === 'workExperience' && line.length > 5) {
      info.workExperience.push(line);
    } else if (currentSection === 'internshipExperience' && line.length > 5) {
      info.internshipExperience.push(line);
    } else if (currentSection === 'projectExperience' && line.length > 5) {
      info.projectExperience.push(line);
    } else if (currentSection === 'schoolExperience' && line.length > 5) {
      info.schoolExperience.push(line);
    }
  }

  info.skills = [...new Set(info.skills)];
  info.workExperience = [...new Set(info.workExperience)];
  info.internshipExperience = [...new Set(info.internshipExperience)];
  info.projectExperience = [...new Set(info.projectExperience)];
  info.schoolExperience = [...new Set(info.schoolExperience)];

  console.log('[Resume] Parsed result:', JSON.stringify(info, null, 2));
  return info;
}

router.post('/resume', authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Please select a file' });
    }

    const userId = req.user.id;
    const file = req.file;
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const mimeType = file.mimetype;
    const filePath = file.path;
    const fileSize = file.size;

    console.log('[Resume] Uploaded file:', originalName, mimeType, fileSize, 'bytes');
    console.log('[Resume] Path:', filePath);

    let content = '';

    if (mimeType === 'application/pdf') {
      content = await extractTextFromPDF(filePath);
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      content = await extractTextFromWord(filePath);
    }

    console.log('[Resume] Extracted text length:', content.length);

    const parsedInfo = parseResumeInfo(content);
    const parsedContent = JSON.stringify(parsedInfo);

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO resumes (id, user_id, filename, original_name, file_path, file_size, mime_type, content, parsed_content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, file.filename, originalName, filePath, fileSize, mimeType, content, parsedContent, now, now);

    console.log('[Resume] Saved, ID:', id);

    res.json({
      ok: true,
      message: 'Resume uploaded successfully',
      resume: {
        id,
        originalName,
        mimeType,
        fileSize,
        parsedInfo,
        contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
        createdAt: now,
      },
    });
  } catch (error) {
    console.error('[Resume] Upload failed:', error);
    res.status(500).json({ ok: false, message: 'Upload failed: ' + error.message });
  }
});

router.get('/resume', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    const resumes = db.prepare(`
      SELECT id, original_name, file_size, mime_type, parsed_content, created_at
      FROM resumes
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    const result = resumes.map((resume) => ({
      id: resume.id,
      originalName: resume.original_name,
      fileSize: resume.file_size,
      mimeType: resume.mime_type,
      parsedInfo: resume.parsed_content ? JSON.parse(resume.parsed_content) : null,
      createdAt: resume.created_at,
    }));

    res.json({ ok: true, resumes: result });
  } catch (error) {
    console.error('[Resume] Fetch failed:', error);
    res.status(500).json({ ok: false, message: 'Failed to fetch resumes' });
  }
});

router.get('/resume/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    const resume = db.prepare(`
      SELECT id, original_name, file_size, mime_type, content, parsed_content, created_at
      FROM resumes
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, userId);

    if (!resume) {
      return res.status(404).json({ ok: false, message: 'Resume not found' });
    }

    res.json({
      ok: true,
      resume: {
        id: resume.id,
        originalName: resume.original_name,
        fileSize: resume.file_size,
        mimeType: resume.mime_type,
        content: resume.content,
        parsedInfo: resume.parsed_content ? JSON.parse(resume.parsed_content) : null,
        createdAt: resume.created_at,
      },
    });
  } catch (error) {
    console.error('[Resume] Detail fetch failed:', error);
    res.status(500).json({ ok: false, message: 'Failed to fetch resume detail' });
  }
});

router.delete('/resume/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    const resume = db.prepare(`
      SELECT id, file_path FROM resumes WHERE id = ? AND user_id = ?
    `).get(req.params.id, userId);

    if (!resume) {
      return res.status(404).json({ ok: false, message: 'Resume not found' });
    }

    if (resume.file_path && fs.existsSync(resume.file_path)) {
      fs.unlinkSync(resume.file_path);
    }

    db.prepare('DELETE FROM resumes WHERE id = ?').run(req.params.id);

    res.json({ ok: true, message: 'Resume deleted' });
  } catch (error) {
    console.error('[Resume] Delete failed:', error);
    res.status(500).json({ ok: false, message: 'Failed to delete resume' });
  }
});

router.get('/resume/content/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    const resume = db.prepare(`
      SELECT content, parsed_content FROM resumes WHERE id = ? AND user_id = ?
    `).get(req.params.id, userId);

    if (!resume) {
      return res.status(404).json({ ok: false, message: 'Resume not found' });
    }

    res.json({
      ok: true,
      content: resume.content,
      parsedInfo: resume.parsed_content ? JSON.parse(resume.parsed_content) : null,
    });
  } catch (error) {
    console.error('[Resume] Content fetch failed:', error);
    res.status(500).json({ ok: false, message: 'Failed to fetch resume content' });
  }
});

module.exports = router;
