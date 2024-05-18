import express from "express";
import { queryDatabase } from "../utils/functions.js";

const resultsRouter = express.Router();

resultsRouter.get("/", async (req, res) => {
  const resultsQuery = `SELECT username, coin FROM users ORDER BY coin DESC`;
  const result = await queryDatabase(resultsQuery);
  res.send(result);
});

export default resultsRouter;
