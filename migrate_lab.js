const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("database2.sqlite3");

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS register");
  db.run(
    "CREATE TABLE register (register_id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "dni VARCHAR(255), full_name VARCHAR(255), " +
      "username VARCHAR(255), role VARCHAR(255)," +
      "building VARCHAR(255), lab VARCHAR(255), admission_time VARCHAR(255), " +
      "departure_time VARCHAR(255))"
  );
});

db.close();
