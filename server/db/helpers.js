export async function columnExists(conn, dbName, table, column) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column],
  );
  return rows.length > 0;
}

export async function tableExists(conn, dbName, table) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, table],
  );
  return rows.length > 0;
}

/** Match an FK column to an existing referenced column (type + charset + collation). */
export async function referencedColumnSql(conn, dbName, table, column) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column],
  );
  const meta = rows[0];
  if (!meta) return "CHAR(36) NOT NULL";

  let sql = `${meta.COLUMN_TYPE} NOT NULL`;
  if (meta.CHARACTER_SET_NAME) {
    sql += ` CHARACTER SET ${meta.CHARACTER_SET_NAME}`;
  }
  if (meta.COLLATION_NAME) {
    sql += ` COLLATE ${meta.COLLATION_NAME}`;
  }
  return sql;
}

export async function addColumn(conn, table, column, definition) {
  const dbName = conn.config?.database || process.env.DB_NAME || "murandasishop_db";
  if (!(await columnExists(conn, dbName, table, column))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[Migrate] Added ${table}.${column}`);
    return true;
  }
  return false;
}
