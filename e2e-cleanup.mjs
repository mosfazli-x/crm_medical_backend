import pg from 'pg'
const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const r = await pool.query("DELETE FROM appointments WHERE patient_id=$1", ['92c396d3-0bdc-4d2b-8e51-21750cc2f942'])
console.log('deleted', r.rowCount)
await pool.end()
