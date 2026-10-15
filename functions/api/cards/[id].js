/* =========================================================
   GET    /api/cards/:id    → 获取单条
   PUT    /api/cards/:id    → 修改
   DELETE /api/cards/:id    → 删除
   ========================================================= */

export async function onRequestGet(context) {
  const { params, request, env } = context;

  const auth = checkAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  try {
    const card = await env.DB.prepare(
      `SELECT id, section_id, no, category, read_min AS readMin,
              title, summary, quote, points, status, created_by AS createdBy,
              created_at AS createdAt, updated_at AS updatedAt
       FROM cards WHERE id = ?`
    ).bind(params.id).first();

    if (!card) return json({ ok: false, error: '卡片不存在' }, 404);

    return json({
      ok: true,
      card: { ...card, points: safeParse(card.points) }
    });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { params, request, env } = context;

  const auth = checkAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  try {
    const id = params.id;

    /* 检查卡片存在 */
    const existing = await env.DB.prepare(
      'SELECT id FROM cards WHERE id = ?'
    ).bind(id).first();
    if (!existing) return json({ ok: false, error: '卡片不存在' }, 404);

    const body = await request.json();
    const {
      category, read_min, title, summary, quote, points
    } = body;

    /* 校验 */
    if (!title || !title.trim()) return json({ ok: false, error: '标题不能为空' }, 400);
    if (!category || !category.trim()) return json({ ok: false, error: '分类不能为空' }, 400);
    if (!summary || !summary.trim()) return json({ ok: false, error: '摘要不能为空' }, 400);
    if (title.length > 200) return json({ ok: false, error: '标题过长' }, 400);
    if (summary.length > 500) return json({ ok: false, error: '摘要过长' }, 400);

    await env.DB.prepare(
      `UPDATE cards SET
        category = ?, read_min = ?, title = ?, summary = ?, quote = ?,
        points = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      category.trim(),
      Number(read_min) || 3,
      title.trim(),
      summary.trim(),
      (quote || '').trim(),
      JSON.stringify(points || []),
      id
    ).run();

    return json({ ok: true, message: '修改成功' });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { params, request, env } = context;

  const auth = checkAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  try {
    const id = params.id;

    const existing = await env.DB.prepare(
      'SELECT id FROM cards WHERE id = ?'
    ).bind(id).first();
    if (!existing) return json({ ok: false, error: '卡片不存在' }, 404);

    await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();

    return json({ ok: true, message: '删除成功' });
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
