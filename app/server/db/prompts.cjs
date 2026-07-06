const { db } = require('./database.cjs');
const { v4: uuidv4 } = require('uuid');

function getAllPrompts() {
  return db.prepare(`
    SELECT p.*, u.username as created_by_username
    FROM prompts p
    LEFT JOIN users u ON p.created_by = u.id
    ORDER BY p.created_at DESC
  `).all();
}

function getPromptById(id) {
  return db.prepare(`
    SELECT p.*, u.username as created_by_username
    FROM prompts p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.id = ?
  `).get(id);
}

function getSystemPrompt() {
  return db.prepare(`
    SELECT * FROM prompts 
    WHERE is_system_prompt = 1 AND is_active = 1 
    LIMIT 1
  `).get();
}

function createPrompt(promptData) {
  const { name, content, description, createdBy } = promptData;
  
  if (!name || !content) {
    return { success: false, message: '名称和内容不能为空' };
  }

  const id = uuidv4();
  
  try {
    db.prepare(`
      INSERT INTO prompts (id, name, content, description, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, content, description || null, createdBy || null);

    return { success: true, promptId: id };
  } catch (error) {
    return { success: false, message: '创建失败: ' + error.message };
  }
}

function updatePrompt(id, promptData) {
  const { name, content, description, isActive } = promptData;
  
  const existing = db.prepare('SELECT id FROM prompts WHERE id = ?').get(id);
  if (!existing) {
    return { success: false, message: 'Prompt 不存在' };
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (content !== undefined) {
    updates.push('content = ?');
    params.push(content);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    return { success: false, message: '没有需要更新的字段' };
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  try {
    db.prepare(`UPDATE prompts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return { success: true };
  } catch (error) {
    return { success: false, message: '更新失败: ' + error.message };
  }
}

function deletePrompt(id) {
  const existing = db.prepare('SELECT id, is_system_prompt FROM prompts WHERE id = ?').get(id);
  if (!existing) {
    return { success: false, message: 'Prompt 不存在' };
  }

  if (existing.is_system_prompt === 1) {
    return { success: false, message: '不能删除当前系统 Prompt，请先设置其他 Prompt 为系统 Prompt' };
  }

  try {
    db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
    return { success: true };
  } catch (error) {
    return { success: false, message: '删除失败: ' + error.message };
  }
}

function setSystemPrompt(id) {
  const existing = db.prepare('SELECT id FROM prompts WHERE id = ?').get(id);
  if (!existing) {
    return { success: false, message: 'Prompt 不存在' };
  }

  try {
    db.prepare('UPDATE prompts SET is_system_prompt = 0').run();
    db.prepare(`
      UPDATE prompts 
      SET is_system_prompt = 1, is_active = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
    return { success: true };
  } catch (error) {
    return { success: false, message: '设置失败: ' + error.message };
  }
}

module.exports = {
  getAllPrompts,
  getPromptById,
  getSystemPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  setSystemPrompt,
};
