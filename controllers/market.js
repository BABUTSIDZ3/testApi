import express from "express";
import { queryDatabase } from "../utils/functions.js";

const marketRouter = express.Router();

// Function to generate the WHERE clause based on game status and excluded products
function generateWhereClause(gameStatus) {
  // If gameStatus is not 1, return an empty string for the WHERE clause
  if (gameStatus !== 1) {
    return "";
  }

  // If gameStatus is 1, construct the WHERE clause to exclude specific products
  const excludedProducts = [
    "exchange_to_money",
    "20$_amazon_gift_card",
    "30$_amazon_gift_card",
    "50$_amazon_gift_card",
  ];
  const excludedProductsString = excludedProducts
    .map((product) => `'${product}'`)
    .join(",");
  return ` WHERE product_name NOT IN (${excludedProductsString})`;
}

marketRouter.get("/", async (req, res) => {
  // Query to fetch the game status from the admin table
  const gameIsStartedQuery = `SELECT started_game FROM admin`;
  // Execute the query to get the game status
  const [gameStatusRow] = await queryDatabase(gameIsStartedQuery);
  // Extract the game status from the query result
  const gameStatus = gameStatusRow.started_game;

  let selectFields;
  // Determine which fields to select based on the game status
  if (gameStatus === 1) {
    selectFields = "product_name, product_image, product_price_in_usd";
  } else {
    selectFields = "product_name, product_image, product_price_in_coin";
  }

  // Construct the base query to select items from the market table
  let getItemsQuery = `SELECT ${selectFields} FROM market`;
  // Generate the WHERE clause based on the game status and excluded products
  const whereClause = generateWhereClause(gameStatus);
  // Append the WHERE clause to the base query
  getItemsQuery += whereClause;

  // Execute the final query to fetch items from the market table
  const result = await queryDatabase(getItemsQuery);
  // Send the result back as the response
  res.send(result);
});

marketRouter.post("/buy-gift-card", async (req, res) => {
  const { email, card_id } = req.body;
  const userinfoQuerry = `SELECT coin,gift_card_id FROM users WHERE email=?`;
  const cardInfoQuerry = `SELECT product_price_in_coin,product_quantity FROM market WHERE id=?`;
  const userUpdateQuerry = `UPDATE users SET gift_card_id=? WHERE email=?`;
  const updateQuantityQuerry = `UPDATE market set product_quantity=product_quantity-1 WHERE id=?`;
  const [{ coin, gift_card_id }] = await queryDatabase(userinfoQuerry, [email]);
  const [{ product_price_in_coin, product_quantity }] = await queryDatabase(
    cardInfoQuerry,
    [card_id]
  );
  if ((gift_card_id = 0)) {
    res.send("you alredy bought a gift card");
  } else {
    if (product_quantity > 0) {
      if (coin < product_price_in_coin) {
        res.send("you do not have enough coin");
      } else {
        await queryDatabase(userUpdateQuerry, [card_id, email]);
        await queryDatabase(updateQuantityQuerry, [card_id]);
        res.send(
          "You have successfully purchased a gift card to the email you are registered with. You will receive a message within 24 hours so that you can activate it."
        );
      }
    } else {
      res.send("The product is no longer in stock");
    }
  }
});

marketRouter.post("/buy-ticket", async (req, res) => {
  try {
    const gameIsStartedQuery = `SELECT started_game FROM admin`;
    const [gameStatus] = await queryDatabase(gameIsStartedQuery);

    if (gameStatus.started_game == 0) {
      const { email } = req.body;
      const userQuery = `SELECT coin, balance FROM users WHERE email=?`;
      const ticketQuery = `SELECT * FROM market WHERE product_name=?`;

      const [ticketInfo] = await queryDatabase(ticketQuery, ["ticket"]);
      const [userInfo] = await queryDatabase(userQuery, [email]);

      if (!userInfo || userInfo.coin < ticketInfo.product_price_in_coin) {
        return res.status(400).send("You don't have enough coins");
      }

      const userUpdateQuery = `UPDATE users SET tickets = tickets + ?, coin = coin - ? WHERE email=?`;
      await queryDatabase(userUpdateQuery, [
        1,
        Number(ticketInfo.product_price_in_coin),
        email,
      ]);

      res.send("You have successfully purchased a ticket");
    } else {
      const { email } = req.body;
      const userQuery = `SELECT balance FROM users WHERE email=?`;
      const ticketQuery = `SELECT * FROM market WHERE product_name=?`;

      const [ticketInfo] = await queryDatabase(ticketQuery, ["ticket"]);
      const [userInfo] = await queryDatabase(userQuery, [email]);

      if (!userInfo || userInfo.balance < ticketInfo.product_price_in_usd) {
        return res.status(400).send("You don't have enough balance");
      }

      const userUpdateQuery = `UPDATE users SET tickets = tickets + ?, balance = balance - ? WHERE email=?`;
      await queryDatabase(userUpdateQuery, [
        1,
        Number(ticketInfo.product_price_in_usd),
        email,
      ]);

      res.send("You have successfully purchased a ticket");
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});
// Assuming you have already defined and initialized your marketRouter and queryDatabase function

marketRouter.post("/exchange-to-money", async (req, res) => {
  const { email } = req.body;

  // Check if the user is already in the process of exchanging
  const checkExchangingQuery = `SELECT exchanging_to_money FROM users WHERE email=?`;
  const userExchangingInfo = await queryDatabase(checkExchangingQuery, [email]);

  // If exchanging_to_money is already 1, return an error message
  if (
    userExchangingInfo.length > 0 &&
    userExchangingInfo[0].exchanging_to_money === 1
  ) {
    return res.status(400).send("You have already activated this service");
  }

  // Continue with the exchange logic
  const getUserInfoQuery = `SELECT coin FROM users WHERE email=?`;
  const getMoneyInfoQuery = `SELECT product_price_in_coin FROM market WHERE product_name=?`;
  const productInfo = await queryDatabase(getMoneyInfoQuery, [
    "exchange_to_money",
  ]);
  const exchangingQuery = `UPDATE users SET exchanging_to_money=?, coin=coin-? WHERE email=?`;
  const userInfo = await queryDatabase(getUserInfoQuery, [email]);

  if (
    userInfo.length === 0 ||
    userInfo[0].coin < productInfo[0].product_price_in_coin
  ) {
    return res.status(400).send("You don't have enough coins");
  } else {
    await queryDatabase(exchangingQuery, [
      1,
      productInfo[0].product_price_in_coin,
      email,
    ]);
    return res.send(
      "You have successfully cashed out the coin, the amount will be reflected in the account within 24 hours"
    );
  }
});

marketRouter.post("/buy-health", async (req, res) => {
  try {
    const gameIsStartedQuery = `SELECT started_game FROM admin`;
    const [gameStatus] = await queryDatabase(gameIsStartedQuery);
    if (gameStatus.started_game == 0) {
      const { email } = req.body;
      const userQuery = `SELECT coin, balance,health_with_coin FROM users WHERE email=?`;
      const ticketQuery = `SELECT * FROM market WHERE product_name=?`;
      const [ticketInfo] = await queryDatabase(ticketQuery, ["health"]);
      const [userInfo] = await queryDatabase(userQuery, [email]);
      if (!userInfo || userInfo.coin < ticketInfo.product_price_in_coin) {
        return res.status(400).send("You don't have enough coins");
      }
      const userUpdateQuery = `UPDATE users SET health = health + ?, coin = coin - ?,health_with_coin=health_with_coin+1 WHERE email=?`;
      if (userInfo.health_with_coin > 9) {
        res.send(`you can't buy more health`);
      } else {
        await queryDatabase(userUpdateQuery, [
          1,
          Number(ticketInfo.product_price_in_coin),
          email,
        ]);
        res.send("You have successfully purchased a health");
      }
    } else {
      const { email } = req.body;
      const userQuery = `SELECT balance,health_with_money FROM users WHERE email=?`;
      const ticketQuery = `SELECT * FROM market WHERE product_name=?`;

      const [ticketInfo] = await queryDatabase(ticketQuery, ["health"]);
      const [userInfo] = await queryDatabase(userQuery, [email]);

      if (!userInfo || userInfo.balance < ticketInfo.product_price_in_usd) {
        return res.status(400).send("You don't have enough balance");
      }

      const userUpdateQuery = `UPDATE users SET health = health + ?, balance = balance - ?,health_with_money=health_with_money+1 WHERE email=?`;
      if (userInfo.health_with_money > 9) {
        res.send(`you can't buy more health`);
      } else {
        await queryDatabase(userUpdateQuery, [
          1,
          Number(ticketInfo.product_price_in_usd),
          email,
        ]);
        res.send("You have successfully purchased a health");
      }
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

marketRouter.post("/buy-help", async (req, res) => {
  try {
    const gameIsStartedQuery = `SELECT started_game FROM admin`;
    const [gameStatus] = await queryDatabase(gameIsStartedQuery);

    if (gameStatus.started_game == 0) {
      const { email } = req.body;
      const userQuery = `SELECT coin, balance,help_with_coin FROM users WHERE email=?`;
      const ticketQuery = `SELECT * FROM market WHERE product_name=?`;

      const [ticketInfo] = await queryDatabase(ticketQuery, ["help"]);
      const [userInfo] = await queryDatabase(userQuery, [email]);

      if (!userInfo || userInfo.coin < ticketInfo.product_price_in_coin) {
        return res.status(400).send("You don't have enough coins");
      }

      const userUpdateQuery = `UPDATE users SET help = help + ?, coin = coin - ? ,help_with_coin=help_with_coin+1 WHERE email=?`;
      if (userInfo.help_with_coin > 9) {
        res.send(`you can't buy more help`);
      } else {
        await queryDatabase(userUpdateQuery, [
          1,
          Number(ticketInfo.product_price_in_coin),
          email,
        ]);

        res.send("You have successfully purchased a help");
      }
    } else {
      const { email } = req.body;
      const userQuery = `SELECT balance,help_with_money FROM users WHERE email=?`;
      const ticketQuery = `SELECT * FROM market WHERE product_name=?`;

      const [ticketInfo] = await queryDatabase(ticketQuery, ["help"]);
      const [userInfo] = await queryDatabase(userQuery, [email]);

      if (!userInfo || userInfo.balance < ticketInfo.product_price_in_usd) {
        return res.status(400).send("You don't have enough balance");
      }

      const userUpdateQuery = `UPDATE users SET help = help + ?, balance = balance - ?,help_with_money=help_with_money+1 WHERE email=?`;
      if (userInfo.help_with_money > 9) {
        res.send(`you can't buy more help`);
      } else {
        await queryDatabase(userUpdateQuery, [
          1,
          Number(ticketInfo.product_price_in_usd),
          email,
        ]);

        res.send("You have successfully purchased a help");
      }
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

marketRouter.post("/buy-x-card", async (req, res) => {
  try {
    const gameIsStartedQuery = `SELECT started_game FROM admin`;
    const [gameStatus] = await queryDatabase(gameIsStartedQuery);

    if (gameStatus.started_game == 0) {
      const { email, which_x } = req.body; // Define which_x here
      const userQuery = `SELECT coin, x_card_with_coin FROM users WHERE email=?`;
      const ticketQuery = `SELECT * FROM market WHERE product_name=?`;

      const [ticketInfo] = await queryDatabase(ticketQuery, [which_x]);
      const [userInfo] = await queryDatabase(userQuery, [email]);

      if (!userInfo || userInfo.coin < ticketInfo.product_price_in_coin) {
        return res.status(400).send("You don't have enough coins");
      }
      const userUpdateQuery = `UPDATE users SET ${which_x} = ${which_x} + ?, coin = coin - ?,x_card_with_coin=x_card_with_coin+1 WHERE email=?`;
      if (userInfo.x_card_with_coin > 9) {
        res.send(`you can't buy more x-card`);
      } else {
        await queryDatabase(userUpdateQuery, [
          1,
          Number(ticketInfo.product_price_in_coin),
          email,
        ]);
        res.send(`You have successfully purchased a ${which_x} coins`);
      }
    } else {
      const { email, which_x } = req.body; // Define which_x here as well
      const userQuery = `SELECT balance,x_card_with_money FROM users WHERE email=?`;
      const ticketQuery = `SELECT * FROM market WHERE product_name=?`;

      const [ticketInfo] = await queryDatabase(ticketQuery, [which_x]);
      const [userInfo] = await queryDatabase(userQuery, [email]);

      if (!userInfo || userInfo.balance < ticketInfo.product_price_in_usd) {
        return res.status(400).send("You don't have enough balance");
      }
      if (userInfo.x_card_with_money > 9) {
        res.send(`you can't buy more x-card`);
      } else {
        const userUpdateQuery = `UPDATE users SET ${which_x} = ${which_x} + ?, balance = balance - ?,x_card_with_money=x_card_with_money+1 WHERE email=?`;
        await queryDatabase(userUpdateQuery, [
          1,
          Number(ticketInfo.product_price_in_usd),
          email,
        ]);
        res.send(`You have successfully purchased a ${which_x} coins`);
      }
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default marketRouter;
