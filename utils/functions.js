import { conection } from "../app.js";

// Function to handle database queries
export async function queryDatabase(sql, values) {
  try {
    const conn = await conection.getConnection();
    const rows = await conn.query(sql, values);
    conn.release(); // Release the connection back to the pool
    return rows;
  } catch (err) {
    console.error("Error executing SQL query:", err);
    throw err; // Re-throw the error for handling in the caller
  }
}

export async function levelup(req, res) {
  try {
    const runLevelUp = async () => {
      try {
        let round = 0;
        const sql_query =
          "SELECT id,balance,balancetobecollected,subscription,paydonlevel,level FROM users";
        const results = await queryDatabase(sql_query);
        const filteredResult = results.filter(
          (user) => user.payment_status !== 0
        );

        const groupedResult = {};
        filteredResult.forEach((user) => {
          if (!groupedResult[user.level]) {
            groupedResult[user.level] = [];
          }
          if (user.paydonlevel === 0 && user.balancetobecollected !== 0) {
            groupedResult[user.level].push(user);
          }
        });

        for (const level of Object.keys(groupedResult)) {
          const response = groupedResult[level];
          if (response.length === 2) {
            round = 1;
            const totalBalancetobecollected = response.reduce(
              (total, user) => total + Number(user.balancetobecollected),
              0
            );
            const balancetobecollectedonlevel = totalBalancetobecollected * 0.8;
            let forbalance = balancetobecollectedonlevel * 0.1;
            const forbalancetobecollected = balancetobecollectedonlevel * 0.9;
            const levelquerry = `SELECT id FROM users WHERE level=?`;
            const allUsersOnSameLevel = await queryDatabase(levelquerry, [
              level,
            ]);
            const userToLevelUp = response.sort((a, b) => a.id - b.id)[0];

            if (userToLevelUp.subscription === 0) {
              forbalance /= 2;
            }

            const updatepaydonlevelQuery = `UPDATE users SET balancetobecollected = 0, paydonlevel = 1 WHERE level = ${allUsersOnSameLevel[0].id} AND paydonlevel = 0`;
            await queryDatabase(updatepaydonlevelQuery);

            const updateUserQuery = `UPDATE users SET paydonlevel=0, balance = balance + ${forbalance}, balancetobecollected = balancetobecollected + ${forbalancetobecollected}, level = level + 1 WHERE id = ${userToLevelUp.id}`;
            await queryDatabase(updateUserQuery);
          }
        }
        if (round !== 0) await runLevelUp();
      } catch (error) {
        res.send(error.message);
      }
    };

    await runLevelUp();
  } catch (error) {
    res.send(error.message);
  }
}
