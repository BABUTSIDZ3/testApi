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
//Get user id with email
export const getUserIdByEmail = async (email) => {
  try {
    const userId = await queryDatabase(`SELECT id FROM users WHERE email = ?`, [
      email,
    ]);
    if (userId[0]) {
      return userId[0].id;
    }
  } catch (error) {}
};

//Function for adding user transaction in database
export const addCustomerTransaction = async (
  userId,
  transactionType,
  amount,
  dateTime
) => {
  try {
    await queryDatabase(
      `INSERT INTO Transactions (user_id,transaction_type,amount,createdAt) VALUES (?,?,?,?)`,
      [userId, transactionType, amount / 100, dateTime]
    );
  } catch (error) {}
};

export async function levelup(req, res) {
  try {
    let rounds = 0;
    const runLevelUp = async () => {
      try {
        rounds = 0;
        const sql_query =
          "SELECT id,balancetobecollected,paydonlevel,level,balance,payment_status,subscription FROM users";
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
        for (const level of Object.keys(groupedResult)) {
          const response = groupedResult[level];
          if (response.paydonlevel0.length === 2) {
            rounds++;
            const totalBalancetobecollected = response.paydonlevel0.reduce(
              (total, user) => total + Number(user.balancetobecollected),
              0
            );
            const balancetobecollectedonlevel =
              totalBalancetobecollected - totalBalancetobecollected / 5;
            const forbalancetobecollected = balancetobecollectedonlevel * 0.9;
            let forbalance = balancetobecollectedonlevel * 0.1;
            if (response.paydonlevel0[0].subscription === 0) {
              forbalance = forbalance / 2;
            }
            const userwhichincreasebalance = response.paydonlevel1.concat(
              response.paydonlevel0
            );
            const test = userwhichincreasebalance.sort(function (a, b) {
              return a.id - b.id;
            });
            const updatepaydonlevel = `UPDATE users SET balancetobecollected = 0, paydonlevel = 1 WHERE level = ${response.paydonlevel0[0].level}`;
            await queryDatabase(updatepaydonlevel);
            // Distribute increment among users at level 1 with balancetobecollected as 0
            const level1Users = filteredResult.filter(
              (user) => user.level === 1 && user.balancetobecollected === 0
            );
            let distributedBalance = 0;
            let peopleOnFirstLevelToUpdate = 0;
            let testremainingBalance =
              forbalancetobecollected - distributedBalance;
            for (const user of level1Users) {
              testremainingBalance =
                forbalancetobecollected - distributedBalance;
              if (distributedBalance >= forbalancetobecollected) break;
              const increment = Math.min(
                forbalancetobecollected - distributedBalance,
                3
              );
              distributedBalance += increment;
              testremainingBalance =
                forbalancetobecollected - distributedBalance;
              if (
                testremainingBalance > test[0].balancetobecollected &&
                user.balancetobecollected == 0
              ) {
                peopleOnFirstLevelToUpdate = peopleOnFirstLevelToUpdate + 3;
                await queryDatabase(
                  `UPDATE users SET balancetobecollected = 3,paydonlevel = 0 WHERE id = ${user.id}`
                );
                if (peopleOnFirstLevelToUpdate == 6) {
                  await queryDatabase(
                    `UPDATE users SET balancetobecollected = 3,paydonlevel = 0 WHERE id = ${user.id}`
                  );
                  await runLevelUp();
                }
              }
            }
            const remainingBalance =
              forbalancetobecollected - peopleOnFirstLevelToUpdate;
            if (remainingBalance > 0) {
              await queryDatabase(
                `UPDATE users SET balance = balance + ${parseFloat(
                  forbalance
                ).toFixed(
                  2
                )}, balancetobecollected = balancetobecollected + ${parseFloat(
                  remainingBalance
                ).toFixed(2)}, paydonlevel = 0, level = ${
                  response.paydonlevel0[0].level + 1
                } WHERE id = ${test[0].id}`
              );
            }
          }
        }
      } catch (error) {
        res.send(error.message);
      }
      if (rounds > 0) {
        await runLevelUp();
      }
      return;
    };
    await runLevelUp();
  } catch (error) {
    res.send(error.message);
  }
}
