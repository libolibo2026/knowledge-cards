/* =========================================================
   GET  /api/cards     → 列出卡片（管理列表用，需密码）
   POST /api/cards     → 新增卡片（需密码）
   ========================================================= */

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = checkAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  try {
    const url = new URL(request.url);
    const sectionId = url.searchParams.get('section_id');
    const q = (url.searchParams.get('q') || '').trim();
    const category = url.searchParams.get('category') || '全部';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('page_size') || '50', 10)));
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];

    if (sectionId) {
      where += ' AND section_id = ?';
      params.push(sectionId);
    }
    if (category && category !== '全部') {
      where += ' AND category = ?';
      params.push(category);
    }
    if (q) {
      where += ' AND (title LIKE ? OR summary LIKE ? OR quote LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM cards ${where}`
    ).bind(...params).first();

    const { results } = await env.DB.prepare(
      `SELECT id, section_id, no, category, read_min AS readMin,
              title, summary, quote, points, status, created_by AS createdBy,
              created_at AS createdAt, updated_at AS updatedAt
       FROM cards
       ${where}
       ORDER BY no DESC
       LIMIT ? OFFSET ?`
    ).bind(...params, pageSize, offset).all();

    const cards = results.map(c => ({
      ...c,
      points: safeParse(c.points)
    }));

    return json({
      ok: true,
      total: countRow.total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(countRow.total / pageSize)),
      cards
    });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = checkAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  try {
    const body = await request.json();
    const {
      section_id, category, read_min, title, summary, quote, points
    } = body;

    /* 校验 */
    if (!section_id) return json({ ok: false, error: '缺少 section_id' }, 400);
    if (!title || !title.trim()) return json({ ok: false, error: '标题不能为空' }, 400);
    if (!category || !category.trim()) return json({ ok: false, error: '分类不能为空' }, 400);
    if (!summary || !summary.trim()) return json({ ok: false, error: '摘要不能为空' }, 400);
    if (title.length > 200) return json({ ok: false, error: '标题过长（200 字以内）' }, 400);
    if (summary.length > 500) return json({ ok: false, error: '摘要过长（500 字以内）' }, 400);

    /* 校验 section 是否存在 */
    const section = await env.DB.prepare(
      'SELECT id FROM sections WHERE id = ?'
    ).bind(section_id).first();
    if (!section) return json({ ok: false, error: '板块不存在' }, 404);

    /* 自动分配 no */
    const maxRow = await env.DB.prepare(
      'SELECT MAX(no) AS maxNo FROM cards WHERE section_id = ?'
    ).bind(section_id).first();
    const nextNo = (maxRow && maxRow.maxNo ? maxRow.maxNo : 0) + 1;

    /* 插入 */
    const result = await env.DB.prepare(
      `INSERT INTO cards
        (section_id, no, category, read_min, title, summary, quote, points,
         status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', 'admin', datetime('now'))`
    ).bind(
      section_id,
      nextNo,
      category.trim(),
      Number(read_min) || 3,
      title.trim(),
      summary.trim(),
      (quote || '').trim(),
      JSON.stringify(points || [])
    ).run();

    return json({
      ok: true,
      id: result.meta.last_row_id,
      no: nextNo,
      message: '保存成功'
    }, 201);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}

function checkAuth(request, env) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return { ok: false, error: '服务器未配置 ADMIN_TOKEN' };
  const token = request.headers.get('X-Admin-Token');
  if (!token || token !== expected) return { ok: false, error: '密码错误' };
  return { ok: true };
}

function safeParse(str) {
  try { return JSON.parse(str || '[]'); } catch (e) { return []; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Powered-By': 'KnowledgeCards-API',
      'X-Copyright': '© 2026 方塘 Mindfeed. All Rights Reserved.',
      'X-Owner': 'knowledge-cards'
    }
  });
}
