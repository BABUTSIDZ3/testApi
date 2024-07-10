import express from "express";
import { queryDatabase } from "../utils/functions.js";

const resultsRouter = express.Router();

resultsRouter.get("/", async (req, res) => {
  const resultsQuery = `SELECT username, point FROM users ORDER BY point DESC`;
  const result = await queryDatabase(resultsQuery);
  res.send(result);
});

export default resultsRouter;
