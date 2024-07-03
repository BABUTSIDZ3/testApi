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
    let rounds = 0;

    const runLevelUp = async () => {
      try {
        rounds = 0;
        const sql_query =
          "SELECT id, balancetobecollected, paydonlevel, level, balance, payment_status, subscription FROM users";
        const results = await queryDatabase(sql_query);
        const filteredResult = results.filter(
          (response) => response.payment_status !== 0
        );

        const groupedResult = {};
        filteredResult.forEach((item) => {
          if (!groupedResult[item.level]) {
            groupedResult[item.level] = { paydonlevel0: [], paydonlevel1: [] };
          }
          if (item.paydonlevel === 0) {
            groupedResult[item.level].paydonlevel0.push(item);
          } else if (item.paydonlevel === 1) {
            groupedResult[item.level].paydonlevel1.push(item);
          }
        });

        console.log("Grouped Result:", groupedResult); // Debug statement

        for (const level of Object.keys(groupedResult)) {
          const response = groupedResult[level];
          if (response.paydonlevel0.length >= 2) {
            rounds++;
            const totalBalancetobecollected = response.paydonlevel0
              .slice(0, 2)
              .reduce(
                (total, user) => total + Number(user.balancetobecollected),
                0
              );
            const balancetobecollectedonlevel = totalBalancetobecollected * 0.8; // 80%
            const forbalancetobecollected = balancetobecollectedonlevel * 0.9; // 90%
            let forbalance = balancetobecollectedonlevel * 0.1; // 10%

            if (response.paydonlevel0[0].subscription === 0) {
              forbalance /= 2;
            }

            const userwhichincreasebalance = response.paydonlevel1.concat(
              response.paydonlevel0
            );
            const sortedUsers = userwhichincreasebalance.sort(
              (a, b) => a.id - b.id
            );

            const updatepaydonlevelQuery = `UPDATE users SET balancetobecollected = 0, paydonlevel = 1 WHERE id IN (${response.paydonlevel0
              .slice(0, 2)
              .map((user) => user.id)
              .join(",")})`;
            console.log("Executing SQL query:", updatepaydonlevelQuery); // Debug statement
            await queryDatabase(updatepaydonlevelQuery);

            const remainingBalance = forbalancetobecollected; // Define remainingBalance correctly

            const updateUserQuery = `UPDATE users SET balance = balance + ${forbalance}, balancetobecollected = balancetobecollected + ${remainingBalance}, paydonlevel = 0, level = ${
              response.paydonlevel0[0].level + 1
            } WHERE id = ${sortedUsers[0].id}`;
            console.log("Executing SQL query:", updateUserQuery); // Debug statement
            await queryDatabase(updateUserQuery);
          }
        }
      } catch (error) {
        console.error(`Error in runLevelUp: ${error.message}`); // Added error logging
        res.send(error.message);
      }

      if (rounds > 0) {
        await runLevelUp();
      }
    };

    await runLevelUp();
  } catch (error) {
    console.error(`Error in levelup function: ${error.message}`); // Added error logging
    res.send(error.message);
  }
}
