export async function onRequestGet(context) {
  const { params, env } = context;
  const slug = params.slug;

  if (!slug) {
    return json({ ok: false, error: '缺少板块标识' }, 400);
  }

  try {
    const section = await env.DB.prepare(
      'SELECT id, slug, name, status FROM sections WHERE slug = ?'
    ).bind(slug).first();

    if (!section) {
      return json({ ok: false, error: '板块不存在' }, 404);
    }

    const { results } = await env.DB.prepare(
      `SELECT id, no, category,
              read_min AS readMin,
              title, summary, quote, points
       FROM cards
       WHERE section_id = ?
       ORDER BY no`
    ).bind(section.id).all();

    const cards = results.map(c => ({
      ...c,
      points: safeParse(c.points)
    }));

    return json({ ok: true, section, cards }, 200);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}

function safeParse(str) {
  try { return JSON.parse(str || '[]'); } catch (e) { return []; }
}

function json(data, status) {
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
