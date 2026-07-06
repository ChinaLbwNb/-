const { db } = require('./database.cjs');
const { v4: uuidv4 } = require('uuid');

function saveResume(userId, filename, originalName, filePath, fileSize, mimeType, content, parsedContent) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO resumes (id, user_id, filename, original_name, file_path, file_size, mime_type, content, parsed_content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return { success: true, resumeId: id };
  } catch (error) {
    return { success: false, message: '保存简历失败: ' + error.message };
  }
}

function getResumeByUserId(userId) {
  try {
    const resume = db.prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC').get(userId);
    return resume;
  } catch {
    return null;
  }
}

function updateResume(userId, data) {
  const { content, parsedContent } = data;
  const now = new Date().toISOString();
  
  try {
    const stmt = db.prepare(`
      UPDATE resumes 
      SET content = ?, parsed_content = ?, updated_at = ?
      WHERE user_id = ?
    `);
    
    return { success: true };
  } catch {
    return { success: false, message: '更新简历失败: ' + error.message };
  }
}

function deleteResume(userId) {
  try {
    const resume = getResumeByUserId(userId);
    if (resume && resume.file_path) {
      fs.unlinkSync(resume.file_path);
    }
    
    db.prepare('DELETE FROM resumes WHERE user_id = ?').run(userId);
    return { success: true };
  } catch {
    return { success: false, message: '删除简历失败: ' + error.message };
  }
}

function getResumeContent(userId) {
  const resume = getResumeByUserId(userId);
  if (resume) {
    return {
      content: resume.content,
      parsedContent: resume.parsed_content,
    };
  }
  return null;
}

module.exports = {
  saveResume,
  getResumeByUserId,
  updateResume,
  deleteResume,
  getResumeContent,
};
