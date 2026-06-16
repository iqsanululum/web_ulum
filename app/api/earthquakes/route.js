import { NextResponse } from 'next/server';

// Lazy import to prevent build-time execution
async function getPool() {
  const { getPool: _getPool } = await import('@/lib/db');
  return _getPool();
}

// Ensure the table exists on first use
async function ensureTable(pool) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS earthquakes (
      id         BIGINT       PRIMARY KEY,
      location   VARCHAR(255) NOT NULL,
      lat        DOUBLE       NOT NULL,
      lng        DOUBLE       NOT NULL,
      magnitude  FLOAT        NOT NULL,
      depth      INT          NOT NULL,
      vibration  FLOAT        NOT NULL DEFAULT 0,
      status     VARCHAR(20)  NOT NULL DEFAULT 'WASPADA',
      recorded_at DATETIME    NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

// GET /api/earthquakes — fetch all records, newest first (max 100)
export async function GET() {
  try {
    const pool = await getPool();
    await ensureTable(pool);

    const [rows] = await pool.execute(
      'SELECT * FROM earthquakes ORDER BY recorded_at DESC LIMIT 100'
    );

    // Format rows to match the shape the frontend expects
    const data = rows.map(row => {
      const d = new Date(row.recorded_at);
      return {
        id:        row.id,
        location:  row.location,
        lat:       row.lat,
        lng:       row.lng,
        magnitude: row.magnitude,
        depth:     row.depth,
        vibration: row.vibration,
        status:    row.status,
        time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: d.toLocaleDateString('id-ID'),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/earthquakes error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/earthquakes — save a new earthquake record
export async function POST(request) {
  try {
    const body = await request.json();
    const { id, location, lat, lng, magnitude, depth, vibration, status } = body;

    if (!id || !location || lat == null || lng == null || magnitude == null || depth == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = await getPool();
    await ensureTable(pool);

    await pool.execute(
      `INSERT IGNORE INTO earthquakes
         (id, location, lat, lng, magnitude, depth, vibration, status, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, location, lat, lng, magnitude, depth, vibration ?? 0, status ?? 'WASPADA']
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('POST /api/earthquakes error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/earthquakes — clear all records
export async function DELETE() {
  try {
    const pool = await getPool();
    await ensureTable(pool);
    await pool.execute('DELETE FROM earthquakes');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/earthquakes error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
