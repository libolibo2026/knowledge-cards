export async function onRequestGet(context) {
  const { env } = context;

  try {
    const { results } = await env.DB.prepare(
      `SELECT s.id, s.slug, s.name, s.status,
              COUNT(c.id) AS cardCount
       FROM sections s
       LEFT JOIN cards c ON c.section_id = s.id
       GROUP BY s.id
       ORDER BY s.sort_order`
    ).all();

    return json({ ok: true, sections: results }, 200);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
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
