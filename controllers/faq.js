import express from "express";
import { queryDatabase } from "../utils/functions.js";

const faqRouter = express.Router();

faqRouter.post("/", async (req, res) => {
  const { language } = req.body;
  let faqQuerry = `SELECT question_en,answer_en FROM faq`;
  if (language == "GE") {
    faqQuerry = `SELECT question_ge,answer_ge FROM faq`;
  }
  const result = await queryDatabase(faqQuerry);
  res.send(result);
});

export default faqRouter;
